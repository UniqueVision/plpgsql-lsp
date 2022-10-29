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
    const singleQuotedRE = /'(.*?)'/g
    // avoid recognizing string contents as parameters
    const stmt = preparedStmts[i].replace(singleQuotedRE, "'string'")
    const queryParameterInfo = getQueryParameterInfo(
      document, stmt.replace(sqlCommentRE, ""), settings, logger,
    )
    if (queryParameterInfo !== null && !("type" in queryParameterInfo)) {
      continue
    }
    const currentPosition = preparedStmts.slice(0, i).join("").length
    if (options.statementSeparatorPattern && stmtSepRE?.test(stmt) ) {
      if (statementNames.includes(stmt)) {
        errors.push({
          range: getRange(doc, currentPosition),
          message: "Duplicated statement",
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

function getRange(doc: string, errorPosition: number) {
  const errorLines = doc.slice(0, errorPosition).split("\n")

  return Range.create(
    errorLines.length - 1,
    getNonSpaceCharacter(errorLines[errorLines.length - 1]),
    errorLines.length - 1,
    errorLines[errorLines.length - 1].length,
  )
}
