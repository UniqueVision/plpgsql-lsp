import { Logger } from "vscode-languageserver"

import { PostgresPool } from "@/postgres/pool"
import {
  DefinitionsManager,
  makeTargetRelatedTableLink,
} from "@/server/definitionsManager"

interface TableTrigger {
  schemaName: string,
  tableName: string,
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
  const schemaName = schema || defaultSchema

  const pgClient = await pgPool.connect()
  try {
    const results = await pgClient.query(
      `
        SELECT
          trigger_name,
          action_statement
        FROM
          information_schema.triggers
        WHERE
          trigger_schema = $1
          AND event_object_table = $2
        ORDER BY
          trigger_name
      `,
      [schemaName, tableName.toLowerCase()],
    )

    tableTriggers = results.rows.map(
      (row) => ({
        schemaName,
        tableName,
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
    schemaName,
    tableName,
    triggerName,
    actionStatement,
  } = tableIndex

  const targetLink = makeTargetRelatedTableLink(
    triggerName, tableName, schemaName, definitionsManager,
  )

  return `${targetLink} ${actionStatement}`
}
