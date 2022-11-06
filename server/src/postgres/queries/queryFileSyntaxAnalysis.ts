import { DatabaseError } from "pg"
import { Logger, Range } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { PostgresPool } from "@/postgres"
import { getQueryParameterInfo, QueryParameterInfo,
  sanitizeFileWithQueryParameters } from "@/postgres/parameters"
import { Settings } from "@/settings"
import { getNonSpaceCharacter, getTextAllRange } from "@/utilities/text"

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
): Promise<SyntaxError[]> {
  const errors = []
  const doc = document.getText()

  let preparedStatements = [doc]
  let statementSepRE: RegExp | undefined
  if (options.statementSeparatorPattern) {
    statementSepRE =new RegExp(`(${options.statementSeparatorPattern})`, "g")
    preparedStatements = doc.split(statementSepRE)
  }

  const statementNames: string[] = []
  for (let i = 0; i < preparedStatements.length; i++) {
    const sqlCommentRE = /\/\*[\s\S]*?\*\/|([^:]|^)--.*$/gm
    // const singleQuotedRE = /'(.*?)'/g
    const beginRE = /^([\s]*begin[\s]*;)/igm
    const commitRE = /^([\s]*commit[\s]*;)/igm

    let statement = preparedStatements[i]
      // do not execute the current file (e.g. migrations)
      .replace(beginRE, (m) => "-".repeat(m.length))
      .replace(commitRE, (m) => "-".repeat(m.length))

    const queryParameterInfo = getQueryParameterInfo(
      document,
      statement.replace(sqlCommentRE, ""), // ignore possible matches with comments
      settings,
      logger,
    )
    if (queryParameterInfo !== null && !("type" in queryParameterInfo)) {
      continue
    }

    statement = sanitizeStatement(queryParameterInfo, statement)

    logger.info(JSON.stringify(queryParameterInfo))
    logger.info(statement)

    const currentPosition = preparedStatements.slice(0, i).join("").length

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

    const pgClient = await pgPool.connect()
    try {
      await pgClient.query("BEGIN")
      await pgClient.query(fileText, Array(parameterNumber).fill(null))
    } catch (error: unknown) {
      const databaseError = error as DatabaseError
      const code = databaseError.code ?? "unknown"
      const message = databaseError.message

      if (options.isComplete) {
        logger.error(`SyntaxError ${code}: ${message} (${document.uri})`)
      }

      const range = (() => {
        if (error instanceof DatabaseError && error.position !== undefined) {
          const errorPosition = Number(error.position) + currentPosition

          return getRange(doc, errorPosition)
        } else {
          return getTextAllRange(document)
        }
      })()

      errors.push({ range, message })

    } finally {
      await pgClient.query("ROLLBACK")
      pgClient.release()
    }
  }

  return errors
}

function sanitizeStatement(
  queryParameterInfo: QueryParameterInfo | null,
  statement: string,
) {

  // replace inside single quotes only if any given pattern matches,
  // else we are overriding uuids, booleans in string form, etc.
  let re: RegExp
  switch (queryParameterInfo?.type) {
    case "default":
      re = makeParamPatternInStringPattern(queryParameterInfo.queryParameterPattern)
      statement = statement.replace(
        re,
        (m) => `'${"_".repeat(m.length - 2)}'`,
      )

      // remove parameters that were matched ignoring single quotes (can't replace
      // beforehand since given pattern may contain single quoted text)
      // to get all plausible params but don't exist after replacing
      queryParameterInfo.queryParameters =
        queryParameterInfo.queryParameters.filter((param) => statement.includes(param))

      break
    case "keyword":
      queryParameterInfo.keywordQueryParameterPattern.map(p => {
        re = makeParamPatternInStringPattern(p)
        statement = statement.replace(
          re,
          (m) => `'${"_".repeat(m.length - 2)}'`,
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
    default:
      break
  }

  return statement
}

function makeParamPatternInStringPattern(
  paramPattern: string,
): RegExp {
  return new RegExp(
    "'.*?"
     + paramPattern.replace("{keyword}", "[A-Za-z_][A-Za-z0-9_]*?")
     + ".*?'",
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
