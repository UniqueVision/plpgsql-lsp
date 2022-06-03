import dedent from "ts-dedent/dist"
import { Logger } from "vscode-languageserver"

import { PostgresPool } from "@/postgres"
import { makeSchemas } from "@/utilities/schema"

export interface MaterializedViewDefinition {
  viewName: string
  schemaName: string
}

export async function queryMaterializedViewDefinitions(
  pgPool: PostgresPool,
  schema: string | undefined,
  viewName: string | undefined,
  defaultSchema: string,
  logger: Logger,
): Promise<MaterializedViewDefinition[]> {
  let definitions: MaterializedViewDefinition[] = []

  const pgClient = await pgPool.connect()
  try {
    const results = await pgClient.query(
      `
        SELECT
          schemaname AS schema_name,
          matviewname AS view_name
        FROM
          pg_matviews
        WHERE
          schemaname = ANY($1)
          AND ($2::text IS NULL OR matviewname = $2::text)
      `,
      [makeSchemas(schema, defaultSchema), viewName?.toLowerCase()],
    )

    definitions = results.rows.map(
      (row) => ({
        viewName: row.view_name,
        schemaName: row.schema_name,
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

export function makeMaterializedViewDefinitionText(
  definition: MaterializedViewDefinition,
): string {
  const { schemaName, viewName } = definition

  return dedent`
      MATERIALIZED VIEW ${schemaName}.${viewName}
    `
}
