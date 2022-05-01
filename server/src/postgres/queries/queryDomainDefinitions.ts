import { Logger } from "vscode-languageserver"

import { PostgresPool } from "@/postgres"
import { makeSchemas } from "@/utilities/schema"

interface DomainDefinition {
  schema: string
  domainName: string
  baseTypeName: string
}

export async function queryDomainDefinitions(
  pgPool: PostgresPool,
  schema: string | undefined,
  domainName: string | undefined,
  defaultSchema: string,
  logger: Logger,
): Promise<DomainDefinition[]> {
  let definitions: DomainDefinition[] = []

  const pgClient = await pgPool.connect()
  try {
    const results = await pgClient.query(
      `
        SELECT
          nspname AS schema,
          pg_type.typname AS domain_name,
          base_type.typname AS base_type_name
        FROM
          pg_catalog.pg_type AS pg_type
          JOIN pg_catalog.pg_namespace ON
            pg_namespace.oid = pg_type.typnamespace
          INNER JOIN pg_catalog.pg_type base_type ON
            pg_type.typtype = 'd'
            AND base_type.oid = pg_type.typbasetype
        WHERE
          nspname::text = ANY($1)
          AND $2::text IS NULL OR pg_type.typname = $2::text
      `,
      [makeSchemas(schema, defaultSchema), domainName?.toLowerCase()],
    )

    definitions = results.rows.map(
      (row) => ({
        schema: row.schema,
        domainName: row.domain_name,
        baseTypeName: row.base_type_name,
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

export function makeDomainDefinitionText(definition: DomainDefinition): string {
  const { schema, domainName, baseTypeName } = definition

  return `Domain ${schema}.${domainName} AS ${baseTypeName}`
}
