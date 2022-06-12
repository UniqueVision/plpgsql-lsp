import { Logger } from "vscode-languageserver"

import { PostgresPool } from "@/postgres/pool"
import {
  DefinitionsManager,
  makeTargetRelatedTableLink,
} from "@/server/definitionsManager"

interface TableIndex {
  schemaName: string,
  tableName: string,
  indexName: string,
  accessMethodName: string,
  columnNames: string[]
  isPrimaryKey: boolean,
  isUnique: boolean,
  isExcludeUsing: boolean,
}

export async function queryTableIndexes(
  pgPool: PostgresPool,
  schema: string | undefined,
  tableName: string,
  defaultSchema: string,
  logger: Logger,
): Promise<TableIndex[]> {
  let tableIndexes: TableIndex[] = []
  const schemaName = schema ?? defaultSchema

  const pgClient = await pgPool.connect()
  try {
    const results = await pgClient.query(
      `
      WITH t_table_indexes AS (
        SELECT
          DISTINCT
          index_class.relname AS index_name,
          pg_index.indisprimary AS is_primary_key,
          pg_index.indisunique AS is_unique,
          pg_index.indisexclusion AS is_exclude_using,
          pg_am.amname AS access_method_name,
          string_agg(pg_attribute.attname, ',') AS column_names
        FROM
          pg_class AS index_class
          JOIN pg_namespace ON
            index_class.relnamespace = pg_namespace.oid
            AND pg_namespace.nspname = $1
          JOIN pg_index ON
            index_class.oid = pg_index.indexrelid
            AND index_class.relkind = 'i'
            AND index_class.relname NOT LIKE 'pg_%'
          JOIN pg_class AS table_class ON
            table_class.oid = pg_index.indrelid
            AND table_class.relname = $2
          JOIN pg_am ON
            pg_am.oid=index_class.relam
          LEFT JOIN pg_attribute ON
            pg_attribute.attrelid = table_class.oid
            AND pg_attribute.attnum = ANY(pg_index.indkey)
        GROUP BY
          index_class.relname,
          pg_index.indisprimary,
          pg_index.indisunique,
          pg_index.indisexclusion,
          pg_am.amname
      )
      SELECT
        *
      FROM
        t_table_indexes
      ORDER BY
        is_primary_key DESC,
        index_name
      `,
      [schemaName, tableName.toLowerCase()],
    )

    tableIndexes = results.rows.map(
      (row) => ({
        schemaName,
        tableName,
        indexName: row.index_name,
        accessMethodName: row.access_method_name,
        columnNames: row.column_names.split(","),
        isPrimaryKey: row.is_primary_key,
        isUnique: row.is_unique,
        isExcludeUsing: row.is_exclude_using,
      }),
    )
  }
  catch (error: unknown) {
    logger.error(`${(error as Error).message}`)
  }
  finally {
    pgClient.release()
  }

  return tableIndexes
}


export function makeTableIndexText(
  tableIndex: TableIndex, definitionsManager: DefinitionsManager,
): string {
  const {
    schemaName,
    tableName,
    indexName,
    accessMethodName,
    columnNames,
    isPrimaryKey,
    isUnique,
    isExcludeUsing,
  } = tableIndex

  const targetLink = makeTargetRelatedTableLink(
    indexName, schemaName, tableName, definitionsManager,
  )

  return [
    targetLink,
    isPrimaryKey ? "PRIMARY KEY," : null,
    !isPrimaryKey && isUnique ? "UNIQUE," : null,
    isExcludeUsing ? "EXCLUDE USING" : null,
    accessMethodName,
    `(${columnNames.join(", ")})`,
  ]
    .filter(elem => elem !== null)
    .join(" ")
}
