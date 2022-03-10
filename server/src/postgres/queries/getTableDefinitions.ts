import { Logger } from "vscode-languageserver"

import { PostgresPool } from "@/postgres/pool"

interface TableDefinition {
  schema: string
  tableName: string
  fields: {
    columnName: string,
    dataType: string,
  }[]
}

export async function getTableDefinitions(
  pgPool: PostgresPool,
  schema: string | undefined,
  defaultSchema: string,
  logger: Logger,
  tableName?: string,
): Promise<TableDefinition[]> {
  let definitions: TableDefinition[] = []

  let schemaCondition = ""
  if (schema === undefined) {
    schemaCondition = `t_columns.table_schema in ('${defaultSchema}', 'pg_catalog')`
  }
  else {
    schemaCondition = `t_columns.table_schema = '${schema.toLowerCase()}'`
  }

  let tableNameCondition = ""
  if (tableName !== undefined) {
    tableNameCondition = `AND t_columns.table_name = '${tableName.toLowerCase()}'`
  }

  const pgClient = await pgPool.connect()
  try {
    const results = await pgClient.query(`
      SELECT
        t_columns.table_schema as schema,
        t_columns.table_name as table_name,
        json_agg(
          json_build_object(
            'columnName', t_columns.column_name,
            'dataType', t_columns.data_type
          )
          ORDER BY
            t_columns.ordinal_position
        ) AS fields
      FROM
        information_schema.columns AS t_columns
        INNER JOIN information_schema.tables AS t_tables
        ON t_columns.table_schema = t_tables.table_schema
        AND t_columns.table_name = t_tables.table_name
        AND t_tables.table_type = 'BASE TABLE'
      WHERE
        ${schemaCondition}
        ${tableNameCondition}
      GROUP BY
        t_columns.table_schema,
        t_columns.table_name
      ORDER BY
        t_columns.table_schema,
        t_columns.table_name
    `)
    definitions = results.rows.map(
      (row) => ({
        schema: row.schema,
        tableName: row.table_name,
        fields: row.fields as { columnName: string, dataType: string }[],
      }),
    )
  }
  catch (error: unknown) {
    logger.error(`${(error as Error).toString()}`)
  }
  finally {
    pgClient.release()
  }

  return definitions
}


export function makeTableDefinitionText(definition: TableDefinition): string {
  const {
    schema, tableName, fields,
  } = definition

  let fieldsString = ""
  if (fields.length > 0) {
    fieldsString = "\n" + fields.map(
      ({ columnName, dataType }) => `  ${columnName} ${dataType}`,
    ).join(",\n") + "\n"
  }

  return `TABLE ${schema}.${tableName}(${fieldsString})`
}
