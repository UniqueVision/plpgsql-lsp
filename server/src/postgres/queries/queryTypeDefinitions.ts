import dedent from "ts-dedent/dist"
import { Logger } from "vscode-languageserver"

import { PostgresPool } from "@/postgres"
import { makeSchemas } from "@/utilities/schema"

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

  const pgClient = await pgPool.connect()
  try {
    // https://stackoverflow.com/questions/3660787/how-to-list-custom-types-using-postgres-information-schema
    const results = await pgClient.query(
      `
        WITH t_types AS (
          SELECT
            t.typrelid,
            n.nspname AS schema,
            pg_catalog.format_type(t.oid, NULL) AS type_name
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
          AND n.nspname <> 'information_schema'
          AND n.nspname !~ '^pg_toast'
          AND n.nspname::text = ANY($1)
          AND ($2::text IS NULL OR pg_catalog.format_type(t.oid, NULL) = $2::text)
        )
        SELECT
          t_types.schema,
          t_types.type_name,
          COALESCE(
            json_agg(
              json_build_object(
                'columnName', t_attributes.attname::text,
                'dataType', pg_catalog.format_type(
                  t_attributes.atttypid,
                  t_attributes.atttypmod
                )
              )
              ORDER BY
                t_attributes.attnum
            )
            FILTER (WHERE t_attributes.attname::text IS NOT NULL),
            '[]'
          ) AS fields
        FROM
          t_types
          LEFT OUTER JOIN pg_catalog.pg_attribute AS t_attributes ON
            t_attributes.attrelid = t_types.typrelid
            AND t_attributes.attnum > 0
            AND NOT t_attributes.attisdropped
        GROUP BY
          t_types.schema,
          t_types.type_name
        ORDER BY
          t_types.schema,
          t_types.type_name
      `,
      [makeSchemas(schema, defaultSchema), typeName?.toLowerCase()],
    )

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

  if (fields.length === 0) {
    return `Type ${schema}.${typeName}()`
  }
  else {
    const typeFields = fields.map(
      ({ columnName, dataType }) => `${columnName} ${dataType}`,
    )

    return dedent`
      Type ${schema}.${typeName}(
        ${typeFields.join(",\n")}
      )
    `
  }
}
