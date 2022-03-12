import { Logger, Range, uinteger } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { PostgresPool } from "@/postgres/pool"
import { getLineRangeFromBuffer, getTextAllRange } from "@/utilities/text"

import { FunctionInfo } from "../parsers/getFunctionList"

export interface StaticAnalysisErrorRow {
  procedure: string
  lineno: uinteger
  statement: string
  sqlstate: string
  message: string
  detail: string
  hint: string
  level: string
  position: string
  query: string
  context: string
}

export interface StaticAnalysisError {
  level: string
  range: Range
  message: string
}

export async function queryFileFunctionsAnalysis(
  pgPool: PostgresPool,
  textDocument: TextDocument,
  functionInfos: FunctionInfo[],
  isComplete = false,
  logger: Logger,
): Promise<StaticAnalysisError[] | undefined> {
  const analysisInfos: StaticAnalysisError[] = []
  const fileText = textDocument.getText()

  const pgClient = await pgPool.connect()
  try {
    await pgClient.query("BEGIN")
    await pgClient.query(fileText)
    const extensionCheck = await pgClient.query(`
      SELECT
        extname
      FROM
        pg_extension
      WHERE
        extname = 'plpgsql_check'
    `)

    if (extensionCheck.rowCount === 0) {
      return undefined
    }

    for (const { functionName, location } of functionInfos) {
      const result = await pgClient.query(`
        SELECT
          (pcf).functionid::regprocedure AS procedure,
          (pcf).lineno AS lineno,
          (pcf).statement AS statement,
          (pcf).sqlstate AS sqlstate,
          (pcf).message AS message,
          (pcf).detail AS detail,
          (pcf).hint AS hint,
          (pcf).level AS level,
          (pcf)."position" AS position,
          (pcf).query AS query,
          (pcf).context AS context
        FROM
          plpgsql_check_function_tb('${functionName}') AS pcf
      `)
      const rows: StaticAnalysisErrorRow[] = result.rows

      if (rows.length === 0) {
        continue
      }

      rows.forEach(
        (row) => {
          let range: Range | undefined = undefined
          if (location === undefined) {
            range = getTextAllRange(textDocument)
          }
          else {
            range = getLineRangeFromBuffer(
              fileText,
              location,
              row.lineno ? row.lineno - 1 : 0,
            ) || getTextAllRange(textDocument)
          }

          analysisInfos.push({
            level: row.level, range, message: row.message,
          })
        },
      )
    }
  }
  catch (error: unknown) {
    if (isComplete) {
      logger.error(`StaticAnalysisError: ${(error as Error).toString()}`)
    }

    return undefined
  }
  finally {
    await pgClient.query("ROLLBACK")
    pgClient.release()
  }

  return analysisInfos
}
