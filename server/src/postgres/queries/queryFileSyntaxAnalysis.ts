import { DatabaseError } from "pg"
import { Logger, Range } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { PostgresPool } from "@/postgres"
import { QueryParameterInfo,
  sanitizeFileWithQueryParameters } from "@/postgres/parameters"
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
  logger: Logger,
): Promise<SyntaxError[]> {
  const errors = []
  const doc = document.getText()

  let preparedStmts = [doc]
  let stmtRE: RegExp | undefined
  if (options.statementSeparatorPattern) {
    // const stmtRE = /(--[\s]?name[\s]?:.*)/g
    stmtRE =new RegExp(options.statementSeparatorPattern, "g")
    preparedStmts = doc.split(stmtRE)
  }

  const statementNames: string[] = []

  for (let i = 0; i < preparedStmts.length; i++) {
    const stmt = preparedStmts[i]
    const currentPosition = preparedStmts.slice(0, i).join("").length
    if (options.statementSeparatorPattern && stmtRE?.test(stmt) ) {
      if (statementNames.includes(stmt)) {
        errors.push({
          range: getRange(doc, currentPosition),
          message: "Duplicated statement",
        })
        continue
      }
      statementNames.push(stmt)
    }
    // TODO replace all matches with $*, we don't care if its a wrong parameter match
    // inside a string, etc. Ultimately nothing gets executed.
    // (@\b\w+\b)
    const [fileText, parameterNumber] = sanitizeFileWithQueryParameters(
      stmt,
      options.queryParameterInfo,
      logger,
    )
    //  TODOs:
    // loop through and replace all found parameter regexes with $1,$2...: sqlc.arg\(.*\), @(.*)... see server/src/postgres/parameters/keywordParameters.ts

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
          const rg = getRange(doc, errorPosition)

          return rg
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
