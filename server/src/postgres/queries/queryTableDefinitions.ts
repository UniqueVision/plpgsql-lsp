import { Logger } from "vscode-languageserver"

import { PostgresPool } from "@/postgres"
import { makeSchemas } from "@/utilities/schema"

interface TableDefinition {
  schema: string
  tableName: string
  fields: {
    columnName: string,
    dataType: string,
    isNullable: boolean,
    columnDefault: string | null
  }[]
}

export async function queryTableDefinitions(
  pgPool: PostgresPool,
  schema: string | undefined,
  defaultSchema: string,
  logger: Logger,
  tableName?: string,
): Promise<TableDefinition[]> {
  let definitions: TableDefinition[] = []

  const pgClient = await pgPool.connect()
  try {
    const results = await pgClient.query(
      `
      SELECT
        t_columns.table_schema as schema,
        t_columns.table_name as table_name,
        json_agg(
          json_build_object(
            'columnName', t_columns.column_name,
            'dataType', t_columns.data_type,
            'isNullable', t_columns.is_nullable = 'YES',
            'columnDefault', t_columns.column_default
          )
          ORDER BY
            t_columns.ordinal_position
        ) AS fields
      FROM
        information_schema.columns AS t_columns
        INNER JOIN information_schema.tables AS t_tables ON
          t_columns.table_schema = t_tables.table_schema
          AND t_columns.table_name = t_tables.table_name
          AND t_tables.table_type = 'BASE TABLE'
          AND t_columns.table_schema = ANY($1)
          AND ($2::text IS NULL OR t_columns.table_name = $2::text)
      GROUP BY
        t_columns.table_schema,
        t_columns.table_name
      ORDER BY
        t_columns.table_schema,
        t_columns.table_name
      `,
      [makeSchemas(schema, defaultSchema), tableName?.toLowerCase()],
    )

    definitions = results.rows.map(
      (row) => ({
        schema: row.schema,
        tableName: row.table_name,
        fields: row.fields as {
          columnName: string,
          dataType: string,
          isNullable: boolean,
          columnDefault: string | null
        }[],
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


export function makeTableDefinitionText(definition: TableDefinition): string {
  const {
    schema, tableName, fields,
  } = definition

  let fieldsString = ""
  if (fields.length > 0) {
    fieldsString = "\n" + fields.map(
      ({ columnName, dataType, isNullable, columnDefault }) => {
        return "  " + [
          columnName,
          dataType,
          isNullable ? null : "not null",
          columnDefault ? `default ${columnDefault}` : null,
        ]
          .filter(elem => elem !== null)
          .join(" ")
      },
    ).join(",\n") + "\n"
  }

  return `Table ${schema}.${tableName}(${fieldsString})`
}
