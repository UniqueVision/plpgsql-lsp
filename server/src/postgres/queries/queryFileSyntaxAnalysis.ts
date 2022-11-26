import fs from "fs/promises"
import glob from "glob-promise"
import path from "path"
import { DatabaseError } from "pg"
import { Logger, Range } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { PostgresClient, PostgresPool } from "@/postgres"
import {
  getQueryParameterInfo, QueryParameterInfo,
  sanitizeFileWithQueryParameters,
} from "@/postgres/parameters"
import { MigrationsSettings, Settings, StatementsSettings } from "@/settings"
import { asyncFlatMap } from "@/utilities/functool"
import { neverReach } from "@/utilities/neverReach"
import { getNonSpaceCharacter, getTextAllRange } from "@/utilities/text"

const SQL_COMMENT_RE = /\/\*[\s\S]*?\*\/|([^:]|^)--.*$/gm
const BEGIN_RE = /^([\s]*begin[\s]*;)/igm
const COMMIT_RE = /^([\s]*commit[\s]*;)/igm
const ROLLBACK_RE = /^([\s]*rollback[\s]*;)/igm

const DISABLE_STATEMENT_VALIDATION_RE = /^ *-- +plpgsql-language-server:disable *$/m

export interface SyntaxError {
  range: Range;
  message: string;
}

export interface SyntaxWarning {
  range: Range;
  message: string;
}

export type SyntaxAnalysisOptions = {
  isComplete: boolean;
  queryParameterInfo: QueryParameterInfo | null;
  statements?: StatementsSettings;
};

export async function queryFileSyntaxAnalysis(
  pgPool: PostgresPool,
  document: TextDocument,
  options: SyntaxAnalysisOptions,
  settings: Settings,
  logger: Logger,
): Promise<[SyntaxError[], SyntaxWarning[]]> {
  const errors = []
  const warnings = []
  const documentText = document.getText()

  let preparedStatements = [documentText]
  let statementSepRE: RegExp | undefined
  if (options.statements) {
    statementSepRE = new RegExp(`(${options.statements.separatorPattern})`, "g")
    preparedStatements = documentText.split(statementSepRE)
  }
  const migrations = settings.migrations

  const pgClient = await pgPool.connect()

  try {
    await pgClient.query("BEGIN")

    if (migrations) {
      await runMigration(pgClient, document, migrations, logger)
    }
  } catch (error: unknown) {
    // Restart transaction.
    await pgClient.query("ROLLBACK")
    await pgClient.query("BEGIN")
  } finally {
    await pgClient.query("SAVEPOINT migrations")
  }

  const statementNames: string[] = []
  for (let i = 0; i < preparedStatements.length; i++) {
    const currentPosition = preparedStatements.slice(0, i).join("").length

    let statement = preparedStatements[i]
      // do not execute the current file (e.g. migrations)
      .replace(BEGIN_RE, (m) => "-".repeat(m.length))
      .replace(COMMIT_RE, (m) => "-".repeat(m.length))
      .replace(ROLLBACK_RE, (m) => "-".repeat(m.length))

    if (options.statements && DISABLE_STATEMENT_VALIDATION_RE.test(statement)) {
      if (options.statements?.diagnosticsLevels?.disableFlag === "warning") {
        warnings.push({
          range: getRange(documentText, currentPosition),
          message: "Validation disabled",
        })
      }

      continue
    }

    const queryParameterInfo = getQueryParameterInfo(
      document,
      statement.replace(SQL_COMMENT_RE, ""), // ignore possible matches with comments
      settings,
      logger,
    )
    if (queryParameterInfo !== null && !("type" in queryParameterInfo)) {
      continue
    }

    statement = sanitizeStatement(queryParameterInfo, statement)

    if (options.statements && statementSepRE?.test(statement)) {
      if (statementNames.includes(statement)) {
        errors.push({
          range: getRange(documentText, currentPosition),
          message: `Duplicated statement '${statement}'`,
        })
        continue
      }
      statementNames.push(statement)
    }
    const [fileText, parameterNumber] = sanitizeFileWithQueryParameters(
      statement,
      queryParameterInfo,
      logger,
    )

    try {
      await pgClient.query(fileText, Array(parameterNumber).fill(null))
    } catch (error: unknown) {
      errors.push(statementError(
        document,
        options,
        error as DatabaseError,
        currentPosition,
        logger,
      ))
    } finally {
      await pgClient.query("ROLLBACK TO migrations")
    }
  }
  await pgClient.query("ROLLBACK")
  pgClient.release()

  return [errors, warnings]
}

function migrationError(
  document: TextDocument,
  error: DatabaseError,
  file: string,
) : SyntaxError {
  return {
    range: getTextAllRange(document),
    message: `Migrations (${file}): ${error.message}`,
  }
}

function statementError(
  document: TextDocument,
  options: SyntaxAnalysisOptions,
  error: DatabaseError,
  currentPosition: number,
  logger: Logger,
): SyntaxError {
  const databaseError = error as DatabaseError
  const code = databaseError.code ?? "unknown"
  const message = databaseError.message
  if (options.isComplete) {
    logger.error(`SyntaxError ${code}: ${message} (${document.uri})`)
  }

  const range = (() => {
    if (
      error instanceof DatabaseError
        && error.position !== undefined
    ) {
      const errorPosition = Number(error.position) + currentPosition

      return getRange(document.getText(), errorPosition)
    } else {
      return getTextAllRange(document)
    }
  })()

  return { range, message }
}

async function runMigration(
  pgClient: PostgresClient,
  document: TextDocument,
  migrations: MigrationsSettings,
  logger: Logger,
) {
  const upMigrationFiles = (
    await asyncFlatMap(
      migrations.upFiles,
      (filePattern) => glob.promise(filePattern),
    ))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

  const downMigrationFiles = (
    await asyncFlatMap(
      migrations.downFiles,
      (filePattern) => glob.promise(filePattern),
    ))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))

  const postMigrationFiles = (
    await asyncFlatMap(
      migrations.postMigrationFiles ?? [],
      (filePattern) => glob.promise(filePattern),
    ))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

  if (upMigrationFiles.filter(file => document.uri.endsWith(file)).length
    + downMigrationFiles.filter(file => document.uri.endsWith(file)).length
    + postMigrationFiles.filter(file => document.uri.endsWith(file)).length === 0
  ) {
    return false
  }

  let shouldContinue = true

  if (shouldContinue) {
    shouldContinue = await queryMigrations(
      pgClient, document, downMigrationFiles, logger,
    )
  }

  if (shouldContinue) {
    shouldContinue = await queryMigrations(
      pgClient, document, upMigrationFiles, logger,
    )
  }

  if (shouldContinue) {
    shouldContinue = await queryMigrations(
      pgClient, document, postMigrationFiles, logger,
    )
  }
}

async function queryMigrations(
  pgClient: PostgresClient,
  document: TextDocument,
  files: string[],
  logger: Logger,
): Promise<boolean> {
  for await (const file of files) {
    try {
      if (document.uri.endsWith(file)) {
        // allow us to revisit and work on any migration/post-migration file
        logger.info("Stopping migration execution at the current file")

        return false
      }

      logger.info(`Migration ${file}`)

      const migration = (await fs.readFile(file, { encoding: "utf8" }))
        .replace(BEGIN_RE, (m) => "-".repeat(m.length))
        .replace(COMMIT_RE, (m) => "-".repeat(m.length))
        .replace(ROLLBACK_RE, (m) => "-".repeat(m.length))

      await pgClient.query(migration)
    } catch (error: unknown) {
      migrationError(document, error as DatabaseError, file)

      logger.error(
        `Stopping migration execution at ${path.basename(file)}: ${error}`,
      )

      await pgClient.query("ROLLBACK")
      await pgClient.query("BEGIN")

      return false
    }
  }

  return true
}

function sanitizeStatement(
  queryParameterInfo: QueryParameterInfo | null,
  statement: string,
) {

  // replace inside single quotes only if any given pattern matches,
  // else we are overriding uuids, booleans in string form, etc.
  let re: RegExp
  if (queryParameterInfo) {
    const parameterInfoType = queryParameterInfo.type
    switch (parameterInfoType) {
      case undefined:
        break

      case "default":
        queryParameterInfo.queryParameterPattern.map(pattern => {
          re = makeParamPatternInStringPattern(pattern)
          statement = statement.replace(
            re, (match) => `${"_".repeat(match.length)}`,
          )
        })

        // remove parameters that were matched ignoring single quotes (can't replace
        // beforehand since given pattern may contain single quoted text)
        // to get all plausible params but don't exist after replacing
        queryParameterInfo.queryParameters =
          queryParameterInfo.queryParameters.filter(
            (param) => statement.includes(param),
          )

        break

      case "keyword":
        queryParameterInfo.keywordQueryParameterPattern.map(pattern => {
          re = makeParamPatternInStringPattern(pattern)
          statement = statement.replace(
            re, (match) => `${"_".repeat(match.length)}`,
          )
        })

        // remove parameters that were matched ignoring single quotes (can't replace
        // beforehand since given pattern may contain single quoted text)
        // to get all plausible params but don't exist after replacing
        queryParameterInfo.keywordParameters =
          queryParameterInfo.keywordParameters.filter(
            (param) => statement.includes(param),
          )

        break

      case "position":
        break

      default: {
        const unknwonType: never = parameterInfoType
        neverReach(`"${unknwonType}" is unknown "queryParameterInfo.type".`)
      }
    }
  }

  return statement
}

function makeParamPatternInStringPattern(
  paramPattern: string,
): RegExp {
  return new RegExp(
    "(?<=')[^']*.?"
    + paramPattern.replace("{keyword}", "[^']*?")
    + "(?='(?:[^']*'[^']*')*[^']*$)",
    "g",
  )
}

function getRange(documentTextx: string, errorPosition: number) {
  const errorLines = documentTextx.slice(0, errorPosition).split("\n")

  return Range.create(
    errorLines.length - 1,
    getNonSpaceCharacter(errorLines[errorLines.length - 1]),
    errorLines.length - 1,
    errorLines[errorLines.length - 1].length,
  )
}
