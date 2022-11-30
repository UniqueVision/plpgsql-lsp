import { Logger, Range, uinteger } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { PostgresPool } from "@/postgres"
import {
  QueryParameterInfo,
  sanitizeFileWithQueryParameters,
} from "@/postgres/parameters"
import { FunctionInfo, TriggerInfo } from "@/postgres/parsers/parseFunctions"
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
  plpgsqlCheckSchema?: string
}

export async function queryFileStaticAnalysis(
  pgPool: PostgresPool,
  document: TextDocument,
  functionInfos: FunctionInfo[],
  triggerInfos: TriggerInfo[],
  options: StaticAnalysisOptions,
  logger: Logger,
): Promise<StaticAnalysisError[]> {
  const errors: StaticAnalysisError[] = []
  const [fileText, parameterNumber] = sanitizeFileWithQueryParameters(
    document.getText(), options.queryParameterInfo, logger,
  )

  const plpgsqlCheckSchema = options.plpgsqlCheckSchema

  const pgClient = await pgPool.connect()
  if (plpgsqlCheckSchema) {
    await pgClient.query(`
    SELECT
    set_config(
      'search_path',
      current_setting('search_path') || ',${plpgsqlCheckSchema}',
      false
    )
    WHERE current_setting('search_path') !~ '(^|,)${plpgsqlCheckSchema}(,|$)'
    `)
  }

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
      logger.warn("plpgsql_check is not installed in the database.")

      return []
    }

    for (const { functionName, location } of functionInfos) {
      const result = await pgClient.query(
        `
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
          plpgsql_check_function_tb($1) AS pcf
        `,
        [functionName],
      )

      const rows: StaticAnalysisErrorRow[] = result.rows
      if (rows.length === 0) {
        continue
      }

      extractError(rows, location)
    }
  }
  catch (error: unknown) {
    await pgClient.query("ROLLBACK")
    await pgClient.query("BEGIN")
    if (options.isComplete) {
      const message = (error as Error).message
      logger.error(`StaticAnalysisError: ${message} (${document.uri})`)
    }
  }

  try {
    for (const { functionName, location, relname } of triggerInfos) {
      logger.warn(`trigger::: relname: ${relname} -- functionName: ${functionName}`)

      const result = await pgClient.query(
        `
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
          plpgsql_check_function_tb($1, $2) AS pcf
        `,
        [functionName, relname],
      )

      const rows: StaticAnalysisErrorRow[] = result.rows
      if (rows.length === 0) {
        continue
      }

      extractError(rows, location)
    }
  }
  catch (error: unknown) {
    await pgClient.query("ROLLBACK")
    await pgClient.query("BEGIN")
    if (options.isComplete) {
      const message = (error as Error).message
      logger.error(`StaticAnalysisError: ${message} (${document.uri})`)
    }
  }
  finally {
    await pgClient.query("ROLLBACK")
    pgClient.release()
  }

  return errors

  function extractError(rows: StaticAnalysisErrorRow[], location: number | undefined) {
    rows.forEach(
      (row) => {
        const range = (() => {
          return (location === undefined)
            ? getTextAllRange(document)
            : getLineRangeFromBuffer(
              fileText,
              location,
              row.lineno ? row.lineno - 1 : 0,
            ) ?? getTextAllRange(document)
        })()

        errors.push({
          level: row.level, range, message: row.message,
        })
      },
    )
  }
}
