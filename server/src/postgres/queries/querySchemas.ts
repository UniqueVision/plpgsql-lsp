import { Logger } from "vscode-languageserver"

import { PostgresPool } from "../pool"

export async function querySchemas(
  pgPool: PostgresPool, logger: Logger,
): Promise<string[]> {
  let schemas: string[] = []

  const pgClient = await pgPool.connect()
  try {
    const results = await pgClient.query(`
        SELECT
            DISTINCT schema_name
        FROM
            information_schema.schemata
        ORDER BY
            schema_name
    `)

    schemas = results.rows.map(row => `${row["schema_name"]}`)
  }
  catch (error: unknown) {
    logger.error(`${(error as Error).toString()}`)
  }
  finally {
    pgClient.release()
  }

  return schemas
}
