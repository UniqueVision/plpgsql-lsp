import fs from "fs/promises"
import path from "path"
import { DatabaseError } from "pg"
import { Logger, Range } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { PostgresPool } from "@/postgres"
import { getQueryParameterInfo, QueryParameterInfo,
  sanitizeFileWithQueryParameters } from "@/postgres/parameters"
import { Settings } from "@/settings"
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

export type SyntaxAnalysisOptions = {
  isComplete: boolean;
  queryParameterInfo: QueryParameterInfo | null;
  statementSeparatorPattern?: string;
};

export async function queryFileSyntaxAnalysis(
  pgPool: PostgresPool,
  document: TextDocument,
  options: SyntaxAnalysisOptions,
  settings: Settings,
  logger: Logger,
): Promise<[SyntaxError[], SyntaxError[]]> {
  const errors = []
  const warnings = []
  const doc = document.getText()

  let preparedStatements = [doc]
  let statementSepRE: RegExp | undefined
  if (options.statementSeparatorPattern) {
    statementSepRE =new RegExp(`(${options.statementSeparatorPattern})`, "g")
    preparedStatements = doc.split(statementSepRE)
  }
  const migrations = settings.migrations

  const pgClient = await pgPool.connect()
  try {
	  await pgClient.query("BEGIN")

	  if (migrations) {
	    const upMigrationFiles = (await fs.readdir(migrations.folder))
	      .filter(file => file.endsWith(migrations.upFilePattern))
	      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
	      .map(file => path.join(migrations.folder, file))

	    const downMigrationFiles = (await fs.readdir(migrations.folder))
	      .filter(file => file.endsWith(migrations.downFilePattern))
	      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
	      .map(file => path.join(migrations.folder, file))

	    let shouldContinue = await runMigrations(
        downMigrationFiles, migrations.folder,
      )

	    if (shouldContinue) {
        shouldContinue = await runMigrations(upMigrationFiles, migrations.folder)
      }

      const postMigrations = migrations.postMigrations
      if (postMigrations && shouldContinue) {
        const postMigrationFiles = (await fs.readdir(postMigrations.folder))
          .filter(file => file.endsWith(postMigrations.filePattern))
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
          .map(file => path.join(postMigrations.folder, file))

	      await runMigrations(postMigrationFiles, postMigrations.folder)
      }
	  }

  } catch (error: unknown) {
    analyzeError(error, 0, "migration")
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

    if (DISABLE_STATEMENT_VALIDATION_RE.test(statement)) {
      warnings.push({
        range: getRange(doc, currentPosition),
        message: "Validation disabled",
		  })
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

    if (options.statementSeparatorPattern && statementSepRE?.test(statement) ) {
      if (statementNames.includes(statement)) {
        errors.push({
          range: getRange(doc, currentPosition),
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
      analyzeError(error, currentPosition, "statement")
    } finally {
      await pgClient.query("ROLLBACK TO migrations")
    }
  }
  await pgClient.query("ROLLBACK")
  pgClient.release()

  return [errors, warnings]


  function analyzeError(
    error: unknown,
    currentPosition: number,
    type: "statement" | "migration",
    file?: string,
  ) {
    const databaseError = error as DatabaseError
    const code = databaseError.code ?? "unknown"
    let message = databaseError.message
    if (type === "migration") {
      message = `Migrations (${file}): ${message}` // explicit error about what migration failed
    }

    if (options.isComplete) {
      logger.error(`SyntaxError ${code}: ${message} (${document.uri})`)
    }

    const range = (() => {
      if (
        error instanceof DatabaseError
        && error.position !== undefined
        && type !== "migration"
      ) {
        const errorPosition = Number(error.position) + currentPosition

        return getRange(doc, errorPosition)
      } else {
        return getTextAllRange(document)
      }
    })()

    errors.push({ range, message })
  }

  async function runMigrations(
    files: string[],
    folder: string,
  ) : Promise<boolean> {
    for await (const file of files) {
      try {
        if (document.uri.endsWith(path.relative(folder, file))) {
          // allow us to revisit and work on any migration/post-migration file
          logger.info("Stopping execution at the current file")

          return false
        }
        const migration = (await fs.readFile(file, { encoding: "utf8" }))
          .replace(BEGIN_RE, (m) => "-".repeat(m.length))
          .replace(COMMIT_RE, (m) => "-".repeat(m.length))
          .replace(ROLLBACK_RE, (m) => "-".repeat(m.length))

        await pgClient.query(migration)
      } catch (error: unknown) {
        analyzeError(error, 0, "migration", file)
        logger.error(`Stopping migration execution at ${
          path.basename(file)
        }: ${error}`)

        await pgClient.query("ROLLBACK")
        await pgClient.query("BEGIN")

        return false
      }
    }

    return true
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
        } )

        // remove parameters that were matched ignoring single quotes (can't replace
        // beforehand since given pattern may contain single quoted text)
        // to get all plausible params but don't exist after replacing
        queryParameterInfo.queryParameters =
        queryParameterInfo.queryParameters.filter((param) => statement.includes(param))

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

function getRange(doc: string, errorPosition: number) {
  const errorLines = doc.slice(0, errorPosition).split("\n")

  return Range.create(
    errorLines.length - 1,
    getNonSpaceCharacter(errorLines[errorLines.length - 1]),
    errorLines.length - 1,
    errorLines[errorLines.length - 1].length,
  )
}
