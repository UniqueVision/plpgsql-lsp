import dedent from "ts-dedent/dist"
import { Logger } from "vscode-languageserver"

import { PostgresPool } from "@/postgres"

export interface IndexDefinition {
  indexName: string
  tableName: string
  indexDefinition: string
}

export async function queryIndexDefinitions(
  pgPool: PostgresPool,
  schema: string | undefined,
  indexName: string,
  defaultSchema: string,
  logger: Logger,
): Promise<IndexDefinition[]> {
  let definitions: IndexDefinition[] = []

  const pgClient = await pgPool.connect()
  try {
    const results = await pgClient.query(
      `
      SELECT
        indexname,
        tablename,
        indexdef
      FROM
        pg_indexes
      WHERE
        schemaname = $1
        AND indexname = $2
      ORDER BY
        tablename,
        indexname
      `,
      [schema ?? defaultSchema, indexName?.toLowerCase()],
    )

    definitions = results.rows.map(
      (row) => ({
        indexName: row.indexname,
        tableName: row.tablename,
        indexDefinition: row.indexdef,
      }),
    )
  }
  catch (error: unknown) {
    logger.error(`${(error as Error).message}`)
  }
  finally {
    pgClient.release()
  }

  return definitions
}

export function makeIndexDefinitionText(definition: IndexDefinition): string {
  const { indexName } = definition

  return dedent`
      INDEX ${indexName}
    `
}
