import dedent from "ts-dedent/dist"
import { Logger } from "vscode-languageserver"

import { PostgresPool } from "@/postgres"

interface TriggerDefinition {
  triggerName: string
  actionStatement: string
}

export async function queryTriggerDefinitions(
  pgPool: PostgresPool,
  schema: string | undefined,
  triggerName: string,
  defaultSchema: string,
  logger: Logger,
): Promise<TriggerDefinition[]> {
  let definitions: TriggerDefinition[] = []

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
        AND trigger_name = $2
      `,
      [schema || defaultSchema, triggerName?.toLowerCase()],
    )

    definitions = results.rows.map(
      (row) => ({
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

  return definitions
}

export function makeTriggerDefinitionText(definition: TriggerDefinition): string {
  const { triggerName } = definition

  return dedent`
      TRIGGER ${triggerName}
    `
}
