import { Logger, Range, uinteger } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { PostgresPool } from "@/postgres"
import {
  QueryParameterInfo,
  sanitizeFileWithQueryParameters,
} from "@/postgres/parameters"
import { FunctionInfo } from "@/postgres/parsers/getFunctions"
import { getLineRangeFromBuffer, getTextAllRange } from "@/utilities/text"

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

export type StaticAnalysisOptions = {
  isComplete: boolean,
  queryParameterInfo: QueryParameterInfo | null
}

export async function queryFileStaticAnalysis(
  pgPool: PostgresPool,
  document: TextDocument,
  functionInfos: FunctionInfo[],
  options: StaticAnalysisOptions,
  logger: Logger,
): Promise<StaticAnalysisError[]> {
  const errors: StaticAnalysisError[] = []
  const [fileText, parameterNumber] = sanitizeFileWithQueryParameters(
    document.getText(), options.queryParameterInfo, logger,
  )

  const pgClient = await pgPool.connect()
  try {
    await pgClient.query("BEGIN")
    await pgClient.query(
      fileText, Array(parameterNumber).fill(null),
    )
    const extensionCheck = await pgClient.query(`
      SELECT
        extname
      FROM
        pg_extension
      WHERE
        extname = 'plpgsql_check'
    `)

    if (extensionCheck.rowCount === 0) {
      return []
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
            range = getTextAllRange(document)
          }
          else {
            range = getLineRangeFromBuffer(
              fileText,
              location,
              row.lineno ? row.lineno - 1 : 0,
            ) || getTextAllRange(document)
          }

          errors.push({
            level: row.level, range, message: row.message,
          })
        },
      )
    }
  }
  catch (error: unknown) {
    if (options.isComplete) {
      logger.error(`StaticAnalysisError: ${(error as Error).message}`)
    }
  }
  finally {
    await pgClient.query("ROLLBACK")
    pgClient.release()
  }

  return errors
}
