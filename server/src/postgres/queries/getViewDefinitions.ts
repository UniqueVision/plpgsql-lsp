import { Logger } from "vscode-languageserver"

import { PostgresPool } from "@/postgres/pool"

interface ViewDefinition {
  schema: string
  viewName: string
}

export async function getViewDefinitions(
  pgPool: PostgresPool,
  schema: string | undefined,
  defaultSchema: string,
  logger: Logger,
  viewName?: string,
): Promise<ViewDefinition[]> {
  let definitions: ViewDefinition[] = []

  let schemaCondition = ""
  if (schema === undefined) {
    schemaCondition = `table_schema in ('${defaultSchema}', 'pg_catalog')`
  }
  else {
    schemaCondition = `table_schema = '${schema.toLowerCase()}'`
  }

  let viewNameCondition = ""
  if (viewName !== undefined) {
    viewNameCondition = `AND table_name = '${viewName.toLowerCase()}'`
  }

  const pgClient = await pgPool.connect()
  try {
    const results = await pgClient.query(`
      SELECT
        table_schema as schema,
        table_name
      FROM
        information_schema.views
      WHERE
        ${schemaCondition}
        ${viewNameCondition}
      ORDER BY
        table_schema,
        table_name
    `)

    definitions = results.rows.map(
      (row) => ({
        schema: row.schema,
        viewName: row.table_name,
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


export function makeViewDefinitionText(definition: ViewDefinition): string {
  const { schema, viewName } = definition

  return `VIEW ${schema}.${viewName}`
}
