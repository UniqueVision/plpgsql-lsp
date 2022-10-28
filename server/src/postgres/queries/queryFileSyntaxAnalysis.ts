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
};

export async function queryFileSyntaxAnalysis(
  pgPool: PostgresPool,
  document: TextDocument,
  options: SyntaxAnalysisOptions,
  logger: Logger,
): Promise<SyntaxError[]> {
  const errors = []
  const doc = document.getText()
  const re = /(--[\s]?name[\s]?:.*)/g

  const preparedStmts = doc.split(re)

  for (let i = 0; i < preparedStmts.length; i++) {
    const stmt = preparedStmts[i]
    const currentPosition = preparedStmts.slice(0, i).join("").length
    const [fileText, parameterNumber] = sanitizeFileWithQueryParameters(
      stmt,
      options.queryParameterInfo,
      logger,
    )
    //  TODOs:
    // add flag to enable multiple statements per file analysis
    // separate into different statements by conf defined regex: /--[\s]?name[\s]?:.*/gi
    // loop through and replace all parameter regexes with $1,$2...: sqlc.arg\(.*\), @(.*)...

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
          const errorLines = doc.slice(0, errorPosition).split("\n")

          return Range.create(
            errorLines.length - 1,
            getNonSpaceCharacter(errorLines[errorLines.length - 1]),
            errorLines.length - 1,
            errorLines[errorLines.length - 1].length,
          )
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
