import { Logger } from "vscode-languageserver"

import { PostgresPool } from "@/postgres"
import { makeSchemas } from "@/utilities/schema"

export interface ViewDefinition {
  schema: string
  viewName: string
}

export async function queryViewDefinitions(
  pgPool: PostgresPool,
  schema: string | undefined,
  viewName: string | undefined,
  defaultSchema: string,
  logger: Logger,
): Promise<ViewDefinition[]> {
  let definitions: ViewDefinition[] = []

  const pgClient = await pgPool.connect()
  try {
    const results = await pgClient.query(
      `
      SELECT
        table_schema as schema,
        table_name
      FROM
        information_schema.views
      WHERE
        table_schema = ANY($1)
        AND ($2::text IS NULL OR table_name = $2::text)
      ORDER BY
        table_schema,
        table_name
      `,
      [makeSchemas(schema, defaultSchema), viewName?.toLowerCase()],
    )

    definitions = results.rows.map(
      (row) => ({
        schema: row.schema,
        viewName: row.table_name,
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


export function makeViewDefinitionText(definition: ViewDefinition): string {
  const { schema, viewName } = definition

  return `VIEW ${schema}.${viewName}`
}
