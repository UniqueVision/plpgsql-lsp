import fs from "fs/promises"
import glob from "glob-promise"
import path from "path"
import { DatabaseError } from "pg"
import {
  Diagnostic, DiagnosticSeverity, Logger, uinteger,
} from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { MigrationError } from "@/errors"
import { PostgresClient, PostgresPool } from "@/postgres"
import {
  getQueryParameterInfo, QueryParameterInfo,
  sanitizeFileWithQueryParameters,
} from "@/postgres/parameters"
import { MigrationsSettings, Settings, StatementsSettings } from "@/settings"
import { asyncFlatMap } from "@/utilities/functool"
import { neverReach } from "@/utilities/neverReach"
import { getCurrentLineFromIndex, getTextAllRange } from "@/utilities/text"

const SQL_COMMENT_RE = /\/\*[\s\S]*?\*\/|([^:]|^)--.*$/gm
const BEGIN_RE = /^([\s]*begin[\s]*;)/igm
const COMMIT_RE = /^([\s]*commit[\s]*;)/igm
const ROLLBACK_RE = /^([\s]*rollback[\s]*;)/igm

const DISABLE_STATEMENT_VALIDATION_RE = /^ *-- +plpgsql-language-server:disable *$/m

export type SyntaxAnalysisOptions = {
  isComplete: boolean
  queryParameterInfo: QueryParameterInfo | null
  statements?: StatementsSettings
};

export async function queryFileSyntaxAnalysis(
  pgPool: PostgresPool,
  document: TextDocument,
  options: SyntaxAnalysisOptions,
  settings: Settings,
  logger: Logger,
): Promise<Diagnostic[]> {
  const diagnostics: Diagnostic[] = []
  const documentText = document.getText()

  let preparedStatements = [documentText]
  let statementSepRE: RegExp | undefined
  if (options.statements) {
    statementSepRE = new RegExp(`(${options.statements.separatorPattern})`, "g")
    preparedStatements = documentText.split(statementSepRE)
  }
  const pgClient = await pgPool.connect()

  try {
    await pgClient.query("BEGIN")

    if (settings.migrations) {
      await runMigration(pgClient, document, settings.migrations, logger)
    }
  } catch (error: unknown) {
    if (error instanceof MigrationError) {
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: getTextAllRange(document),
        message: error.message,
      })
    }

    // Restart transaction.
    await pgClient.query("ROLLBACK")
    await pgClient.query("BEGIN")
  } finally {
    await pgClient.query("SAVEPOINT migrations")
  }

  const statementNames: string[] = []
  for (let i = 0; i < preparedStatements.length; i++) {
    // Query each statements.
    const currentTextIndex = preparedStatements.slice(0, i).join("").length
    const statement = queryStatement(
      document,
      preparedStatements[i],
      currentTextIndex,
      statementNames,
      options,
      settings,
      logger,
    )
    if ("message" in statement) {
      diagnostics.push(statement)
      continue
    }
    const { sanitizedStatement, parameterSize } = statement

    try {
      await pgClient.query(sanitizedStatement, Array(parameterSize).fill(null))
    } catch (error: unknown) {
      diagnostics.push(statementError(
        document,
        options,
        error as DatabaseError,
        currentTextIndex,
        logger,
      ))
    } finally {
      await pgClient.query("ROLLBACK TO migrations")
    }
  }
  await pgClient.query("ROLLBACK")
  pgClient.release()

  return diagnostics
}

function statementError(
  document: TextDocument,
  options: SyntaxAnalysisOptions,
  error: DatabaseError,
  currentTextIndex: number,
  logger: Logger,
): Diagnostic {
  const databaseError = error as DatabaseError
  const code = databaseError.code ?? "unknown"
  const message = databaseError.message
  if (options.isComplete) {
    logger.error(`SyntaxError ${code}: ${message} (${document.uri})`)
  }

  const range = (() => {
    if (error instanceof DatabaseError && error.position !== undefined) {
      const errorPosition = Number(error.position) + currentTextIndex

      return getCurrentLineFromIndex(document.getText(), errorPosition)
    } else {
      return getTextAllRange(document)
    }
  })()

  return {
    severity: DiagnosticSeverity.Error,
    range,
    message,
  }
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

  // NOTE: When the number of migration files is large, this process is too heavy.
  //       Ideally, it should be executed only when a migration file is being edited.
  //       This may not be what the proposer intended.
  //
  // if (upMigrationFiles.filter(file => document.uri.endsWith(file)).length
  //   + downMigrationFiles.filter(file => document.uri.endsWith(file)).length
  //   + postMigrationFiles.filter(file => document.uri.endsWith(file)).length === 0
  // ) {
  //   return false
  // }

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
      const errorMessage = (error as DatabaseError).message

      logger.error(
        `Stopping migration execution at ${path.basename(file)}: ${errorMessage}`,
      )

      throw new MigrationError(document, errorMessage)
    }
  }

  return true
}

function queryStatement(
  document: TextDocument,
  statement: string,
  currentTextIndex: number,
  statementNames: string[],
  options: SyntaxAnalysisOptions,
  settings: Settings,
  logger: Logger,
): {sanitizedStatement: string, parameterSize: uinteger} | Diagnostic {
  const maskedStatement = statement
    // do not execute the current file (e.g. migrations)
    .replace(BEGIN_RE, (m) => "-".repeat(m.length))
    .replace(COMMIT_RE, (m) => "-".repeat(m.length))
    .replace(ROLLBACK_RE, (m) => "-".repeat(m.length))

  if (options.statements
    && DISABLE_STATEMENT_VALIDATION_RE.test(maskedStatement)
    && options.statements?.diagnosticsLevels?.disableFlag === "warning"
  ) {
    return {
      severity: DiagnosticSeverity.Warning,
      range: getCurrentLineFromIndex(document.getText(), currentTextIndex),
      message: "Validation disabled",
    }
  }

  const queryParameterInfo = getQueryParameterInfo(
    document,
    maskedStatement.replace(SQL_COMMENT_RE, ""), // ignore possible matches with comments
    settings,
    logger,
  )

  if (queryParameterInfo !== null && !("type" in queryParameterInfo)) {
    return queryParameterInfo
  }

  const sanitized = sanitizeStatement(queryParameterInfo, maskedStatement)

  if (options.statements) {
    if (statementNames.includes(sanitized)) {
      return {
        severity: DiagnosticSeverity.Error,
        range: getCurrentLineFromIndex(document.getText(), currentTextIndex),
        message: `Duplicated statement '${sanitized}'`,
      }
    }
    statementNames.push(sanitized)
  }

  const [sanitizedStatement, parameterSize] = sanitizeFileWithQueryParameters(
    sanitized,
    queryParameterInfo,
    logger,
  )

  return {
    sanitizedStatement, parameterSize,
  }
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
