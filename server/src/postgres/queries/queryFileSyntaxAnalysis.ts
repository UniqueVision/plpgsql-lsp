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

  let preparedStmts = [doc]
  let stmtSepRE: RegExp | undefined
  if (options.statementSeparatorPattern) {
    stmtSepRE =new RegExp(`(${options.statementSeparatorPattern})`, "g")
    preparedStmts = doc.split(stmtSepRE)
  }

  const statementNames: string[] = []
  for (let i = 0; i < preparedStmts.length; i++) {
    const sqlCommentRE = /\/\*[\s\S]*?\*\/|([^:]|^)--.*$/gm
    // const singleQuotedRE = /'(.*?)'/g
    const beginRE = /^([\s]*begin[\s]*;)/gm
    const commitRE = /^([\s]*commit[\s]*;)/gm

    let stmt = preparedStmts[i]
      // do not execute the current file (e.g. migrations)
      .replace(beginRE, (m) => "-".repeat(m.length))
      .replace(commitRE, (m) => "-".repeat(m.length))

    const queryParameterInfo = getQueryParameterInfo(
      document,
      stmt.replace(sqlCommentRE, ""), // ignore possible matches with comments
      settings,
      logger,
    )
    if (queryParameterInfo !== null && !("type" in queryParameterInfo)) {
      continue
    }

    stmt = sanitizeStatement(queryParameterInfo, stmt)

    logger.info(JSON.stringify(queryParameterInfo))
    logger.info(stmt)

    const currentPosition = preparedStmts.slice(0, i).join("").length

    if (options.statementSeparatorPattern && stmtSepRE?.test(stmt) ) {
      if (statementNames.includes(stmt)) {
        errors.push({
          range: getRange(doc, currentPosition),
          message: `Duplicated statement '${stmt}'`,
        })
        continue
      }
      statementNames.push(stmt)
    }
    const [fileText, parameterNumber] = sanitizeFileWithQueryParameters(
      stmt,
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
  stmt: string,
) {

  // replace inside single quotes only if any given pattern matches,
  // else we are overriding uuids, booleans in string form, etc.
  let re: RegExp
  switch (queryParameterInfo?.type) {
    case "default":
      re = makeParamPatternInStringPattern(queryParameterInfo.queryParameterPattern)
      stmt = stmt.replace(
        re,
        (m) => `'${"_".repeat(m.length - 2)}'`,
      )

      // remove parameters that were matched ignoring single quotes (can't replace
      // beforehand since given pattern may contain single quoted text)
      // to get all plausible params but don't exist after replacing
      queryParameterInfo.queryParameters =
        queryParameterInfo.queryParameters.filter((param) => stmt.includes(param))

      break
    case "keyword":
      queryParameterInfo.keywordQueryParameterPattern.map(p => {
        re = makeParamPatternInStringPattern(p)
        stmt = stmt.replace(
          re,
          (m) => `'${"_".repeat(m.length - 2)}'`,
        )
      })

      // remove parameters that were matched ignoring single quotes (can't replace
      // beforehand since given pattern may contain single quoted text)
      // to get all plausible params but don't exist after replacing
      queryParameterInfo.keywordParameters =
        queryParameterInfo.keywordParameters.filter((param) => stmt.includes(param))

      break
    default:
      break
  }

  return stmt
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
