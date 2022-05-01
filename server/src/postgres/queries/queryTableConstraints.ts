import { Logger } from "vscode-languageserver"

import { PostgresPool } from "@/postgres/pool"
import {
  DefinitionsManager,
  makeTargetRelatedTableLink,
} from "@/server/definitionsManager"

interface TableConstraint {
  type: "foreign_key" | "check",
  schemaName: string,
  tableName: string,
  constraintName: string,
  definition: string,
}

export async function queryTableConstraints(
  pgPool: PostgresPool,
  schema: string | undefined,
  tableName: string,
  defaultSchema: string,
  logger: Logger,
): Promise<TableConstraint[]> {
  let tableConstraints: TableConstraint[] = []
  const schemaName = schema || defaultSchema

  const pgClient = await pgPool.connect()
  try {
    const results = await pgClient.query(
      `
      WITH t_table_constraints AS (
        SELECT
          DISTINCT
          CASE pg_constraint.contype
            WHEN 'f' THEN
              'foreign_key'
            WHEN 'c' THEN
              'check'
          END AS type,
          pg_constraint.conname AS name,
          pg_get_constraintdef(pg_constraint.oid, true) AS definition
        FROM
          pg_constraint
          INNER JOIN pg_namespace ON
            pg_namespace.oid = pg_constraint.connamespace
            AND pg_constraint.contype IN ('f', 'c')
            AND pg_namespace.nspname = $1
          JOIN pg_class ON
            pg_constraint.conrelid = pg_class.oid
            AND pg_class.relname = $2
          LEFT JOIN information_schema.constraint_column_usage ON
            pg_constraint.conname = constraint_column_usage.constraint_name
            AND pg_namespace.nspname = constraint_column_usage.constraint_schema
      )
      SELECT
        *
      FROM
        t_table_constraints
      ORDER BY
        type,
        name
      `,
      [schemaName, tableName.toLowerCase()],
    )

    tableConstraints = results.rows.map(
      (row) => ({
        type: row.type,
        schemaName,
        tableName,
        constraintName: row.name,
        definition: row.definition,
      }),
    )
  }
  catch (error: unknown) {
    logger.error(`${(error as Error).message}`)
  }
  finally {
    pgClient.release()
  }

  return tableConstraints
}


export function makeTableConastaintText(
  tableConstraint: TableConstraint, definitionsManager: DefinitionsManager,
): string {
  const { schemaName, tableName, constraintName, definition } = tableConstraint

  const targetLink = makeTargetRelatedTableLink(
    constraintName, schemaName, tableName, definitionsManager,
  )

  return `${targetLink} ${definition}`
}
