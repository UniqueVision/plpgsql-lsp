import { Logger } from "vscode-languageserver"

import { PostgresPool } from "@/postgres/pool"

interface TypeDefinition {
  schema: string
  typeName: string
  fields: {
    columnName: string,
    dataType: string,
  }[]
}

export async function queryTypeDefinitions(
  pgPool: PostgresPool,
  schema: string | undefined,
  defaultSchema: string,
  logger: Logger,
  typeName?: string,
): Promise<TypeDefinition[]> {
  let definitions: TypeDefinition[] = []

  let schemaCondition = ""
  if (schema === undefined) {
    schemaCondition = `n.nspname::text in ('${defaultSchema}', 'pg_catalog')`
  }
  else {
    schemaCondition = `n.nspname::text = '${schema.toLowerCase()}'`
  }

  let typeNameCondition = ""
  if (typeName !== undefined) {
    typeNameCondition =
      `AND pg_catalog.format_type(t.oid, NULL) = '${typeName.toLowerCase()}'`
  }

  const pgClient = await pgPool.connect()
  try {
    // https://stackoverflow.com/questions/3660787/how-to-list-custom-types-using-postgres-information-schema
    const results = await pgClient.query(`
      WITH types AS (
        SELECT
          n.nspname,
          pg_catalog.format_type(t.oid, NULL) AS obj_name,
          CASE
          WHEN t.typrelid != 0 THEN
            CAST('tuple' AS pg_catalog.text)
          WHEN t.typlen < 0 THEN
            CAST('var' AS pg_catalog.text)
          ELSE
            CAST(t.typlen AS pg_catalog.text)
          END AS obj_type,
          COALESCE(
            pg_catalog.obj_description (t.oid, 'pg_type'),
            ''
          ) AS description
        FROM
          pg_catalog.pg_type t
          JOIN pg_catalog.pg_namespace n ON
            n.oid = t.typnamespace
        WHERE (
          t.typrelid = 0
          OR (
            SELECT
              c.relkind = 'c'
            FROM
              pg_catalog.pg_class c
            WHERE
              c.oid = t.typrelid
          )
        )
        AND NOT EXISTS (
          SELECT
            1
          FROM
            pg_catalog.pg_type el
          WHERE
            el.oid = t.typelem
            AND el.typarray = t.oid
        )
        AND n.nspname <> 'pg_catalog'
        AND n.nspname <> 'information_schema'
        AND n.nspname !~ '^pg_toast'
      ),
      cols AS (
        SELECT
          n.nspname AS schema,
          pg_catalog.format_type(t.oid, NULL) AS type_name,
          a.attname::text AS column_name,
          pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
          a.attnum AS ordinal_position
        FROM
          pg_catalog.pg_attribute a
          JOIN pg_catalog.pg_type t ON
              a.attrelid = t.typrelid
          JOIN pg_catalog.pg_namespace n ON
              n.oid = t.typnamespace
          JOIN types ON
              types.nspname = n.nspname
              AND types.obj_name = pg_catalog.format_type(t.oid, NULL)
        WHERE
          a.attnum > 0
          AND NOT a.attisdropped
          AND ${schemaCondition}
          ${typeNameCondition}
      )
      SELECT
        cols.schema,
        cols.type_name,
        json_agg(
          json_build_object(
            'columnName', cols.column_name,
            'dataType', cols.data_type
          )
          ORDER BY
            cols.ordinal_position
        ) AS fields
      FROM
        cols
      GROUP BY
        cols.schema,
        cols.type_name
      ORDER BY
        cols.schema,
        cols.type_name
    `)

    definitions = results.rows.map(
      (row) => ({
        schema: row.schema,
        typeName: row.type_name,
        fields: row["fields"] as {
          columnName: string, dataType: string
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


export function makeTypeDefinitionText(definition: TypeDefinition): string {
  const {
    schema, typeName, fields,
  } = definition

  let fieldsString = ""
  if (fields.length > 0) {
    fieldsString = "\n" + fields.map(
      ({ columnName, dataType }) => `  ${columnName} ${dataType}`,
    ).join(",\n") + "\n"
  }

  return `TYPE ${schema}.${typeName}(${fieldsString})`
}
