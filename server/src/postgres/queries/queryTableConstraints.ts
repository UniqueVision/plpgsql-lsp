import { Logger } from "vscode-languageserver"

import { PostgresPool } from "@/postgres/pool"

interface TableConstraint {
  type: "foreign_key" | "check",
  name: string,
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

  const pgClient = await pgPool.connect()
  try {
    const results = await pgClient.query(`
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
            AND pg_namespace.nspname = '${schema || defaultSchema}'
          JOIN pg_class ON
            pg_constraint.conrelid = pg_class.oid
            AND pg_class.relname = '${tableName.toLowerCase()}'
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
      ;
    `)

    tableConstraints = results.rows.map(
      (row) => ({
        type: row.type,
        name: row.name,
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


export function makeTableConastaintText(tableConstraint: TableConstraint): string {
  const { name, definition } = tableConstraint

  return `"${name}" ${definition}`
}
