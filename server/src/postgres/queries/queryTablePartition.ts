import { Logger } from "vscode-languageserver"

import { PostgresPool } from "@/postgres"

type TablePartitionKeyDefinition = string

export async function queryTablePartitionKeyDefinition(
  pgPool: PostgresPool,
  schema: string | undefined,
  tableName: string,
  defaultSchema: string,
  logger: Logger,
): Promise<TablePartitionKeyDefinition | null> {
  const pgClient = await pgPool.connect()
  let partitionKeyDefinition = null
  try {
    const results = await pgClient.query(
      `
      SELECT
        pg_get_partkeydef(pg_class.oid) AS partition_key_definition
      FROM
        pg_class
        JOIN pg_namespace ON
          pg_class.relnamespace = pg_namespace.oid
          AND pg_namespace.nspname = $1
          AND pg_class.relname = $2
      LIMIT 1
      `,
      [schema ?? defaultSchema, tableName.toLowerCase()],
    )

    partitionKeyDefinition = results.rows[0].partition_key_definition
  }
  catch (error: unknown) {
    logger.error(`${(error as Error).message}`)
  }
  finally {
    pgClient.release()
  }

  return partitionKeyDefinition
}


export function makeTablePartitionKeyDefinitionText(
  tablePartitionKeyDefinition: TablePartitionKeyDefinition | null,
): string | undefined {
  if (tablePartitionKeyDefinition === null) {
    return undefined
  }
  else {
    return `PARTITION BY ${tablePartitionKeyDefinition}`
  }
}
