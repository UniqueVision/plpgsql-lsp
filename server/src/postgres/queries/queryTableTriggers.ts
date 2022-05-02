import { Logger } from "vscode-languageserver"

import { PostgresPool } from "@/postgres/pool"
import {
  DefinitionsManager,
  makeTargetRelatedTableLink,
} from "@/server/definitionsManager"

interface TableTrigger {
  tableSchemaName: string,
  tableName: string,
  triggerSchemaName: string,
  triggerName: string,
  actionStatement: string,
}

export async function queryTableTriggers(
  pgPool: PostgresPool,
  schema: string | undefined,
  tableName: string,
  defaultSchema: string,
  logger: Logger,
): Promise<TableTrigger[]> {
  let tableTriggers: TableTrigger[] = []
  const tableSchemaName = schema || defaultSchema

  const pgClient = await pgPool.connect()
  try {
    const results = await pgClient.query(
      `
        SELECT
          trigger_schema,
          trigger_name,
          action_statement
        FROM
          information_schema.triggers
        WHERE
          event_object_schema = $1
          AND event_object_table = $2
        ORDER BY
          trigger_name
      `,
      [tableSchemaName, tableName.toLowerCase()],
    )

    tableTriggers = results.rows.map(
      (row) => ({
        tableSchemaName,
        tableName,
        triggerSchemaName: row.trigger_schema,
        triggerName: row.trigger_name,
        actionStatement: row.action_statement,
      }),
    )
  }
  catch (error: unknown) {
    logger.error(`${(error as Error).message}`)
  }
  finally {
    pgClient.release()
  }

  return tableTriggers
}


export function makeTableTriggerText(
  tableIndex: TableTrigger, definitionsManager: DefinitionsManager,
): string {
  const {
    triggerName,
    tableSchemaName,
    tableName,
    actionStatement,
  } = tableIndex

  const targetLink = makeTargetRelatedTableLink(
    triggerName, tableSchemaName, tableName, definitionsManager,
  )

  return `${targetLink} ${actionStatement}`
}
