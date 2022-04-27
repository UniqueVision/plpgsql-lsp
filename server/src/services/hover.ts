import dedent from "ts-dedent"
import {
  Hover,
  Logger,
  MarkupKind,
  Position,
} from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { PostgresPool } from "@/postgres"
import {
  makeFunctionDefinitionText,
  queryFunctionDefinitions,
} from "@/postgres/queries/queryFunctionDefinitions"
import {
  makeIndexDefinitionText,
  queryIndexDefinitions,
} from "@/postgres/queries/queryIndexDefinitions"
import {
  makeTableConastaintText,
  queryTableConstraints,
} from "@/postgres/queries/queryTableConstraints"
import {
  makeTableDefinitionText,
  queryTableDefinitions,
} from "@/postgres/queries/queryTableDefinitions"
import {
  makeTableIndexText,
  queryTableIndexes,
} from "@/postgres/queries/queryTableIndexes"
import {
  makeTablePartitionKeyDefinitionText,
  queryTablePartitionKeyDefinition,
} from "@/postgres/queries/queryTablePartition"
import {
  makeTableTriggerText,
  queryTableTriggers,
} from "@/postgres/queries/queryTableTriggers"
import {
  makeTriggerDefinitionText,
  queryTriggerDefinitions,
} from "@/postgres/queries/queryTriggerDefinitions"
import {
  makeTypeDefinitionText,
  queryTypeDefinitions,
} from "@/postgres/queries/queryTypeDefinitions"
import {
  makeViewDefinitionText,
  queryViewDefinitions,
} from "@/postgres/queries/queryViewDefinitions"
import { DefinitionsManager } from "@/server/definitionsManager"
import { asyncFlatMap } from "@/utilities/functool"
import { sanitizeWordCandidates } from "@/utilities/sanitizeWord"
import { separateSchemaFromCandidate } from "@/utilities/schema"
import {
  getWordRangeAtPosition,
  makeListMarkdown,
  makePostgresCodeMarkdown,
} from "@/utilities/text"

export async function getHover(
  pgPool: PostgresPool,
  definitionsManager: DefinitionsManager,
  document: TextDocument,
  position: Position,
  defaultSchema: string,
  logger: Logger,
): Promise<Hover | undefined> {
  const wordRange = getWordRangeAtPosition(document, position)
  if (wordRange === undefined) {
    return undefined
  }

  const word = document.getText(wordRange)
  const sanitizedWordCandidates = sanitizeWordCandidates(word)

  for (const wordCandidate of sanitizedWordCandidates) {
    const schemaCandidate = separateSchemaFromCandidate(wordCandidate)
    if (schemaCandidate === undefined) {
      continue
    }
    const { schema, candidate } = schemaCandidate

    // Check as Table
    const tableHover = await getTableHover(
      pgPool, definitionsManager, schema, candidate, defaultSchema, logger,
    )
    if (tableHover !== undefined) {
      return tableHover
    }

    // Check as View
    const viewHover = await getViewHover(
      pgPool, schema, candidate, defaultSchema, logger,
    )
    if (viewHover !== undefined) {
      return viewHover
    }

    // Check as Function
    const functionHover = await getFunctionHover(
      pgPool, schema, candidate, defaultSchema, logger,
    )
    if (functionHover !== undefined) {
      return functionHover
    }

    // Check as Type
    const typeHover = await getTypeHover(
      pgPool, schema, candidate, defaultSchema, logger,
    )
    if (typeHover !== undefined) {
      return typeHover
    }

    // Check as Index
    const indexHover = await getIndexHover(
      pgPool, schema, candidate, defaultSchema, logger,
    )
    if (indexHover !== undefined) {
      return indexHover
    }

    // Check as Trigger
    const triggerHover = await getTriggerHover(
      pgPool, schema, candidate, defaultSchema, logger,
    )
    if (triggerHover !== undefined) {
      return triggerHover
    }
  }

  return undefined
}

async function getTableHover(
  pgPool: PostgresPool,
  definitionsManager: DefinitionsManager,
  schema: string | undefined,
  tableName: string,
  defaultSchema: string,
  logger: Logger,
): Promise<Hover | undefined> {
  const definitions = await queryTableDefinitions(
    pgPool, schema, defaultSchema, logger, tableName,
  )
  if (definitions.length === 0) {
    return undefined
  }

  const tablePartitionKeyDefinition = await queryTablePartitionKeyDefinition(
    pgPool, schema, tableName, defaultSchema, logger,
  )
  const tableIndexes = await queryTableIndexes(
    pgPool, schema, tableName, defaultSchema, logger,
  )
  const tableConstraints = await queryTableConstraints(
    pgPool, schema, tableName, defaultSchema, logger,
  )
  const tableTriggers = await queryTableTriggers(
    pgPool, schema, tableName, defaultSchema, logger,
  )

  const definitionsTexts = await asyncFlatMap(
    definitions,
    async (definition) => {
      // Table definition
      let tableDefinitionText = makeTableDefinitionText(definition)

      // Partition
      if (tablePartitionKeyDefinition !== null) {
        tableDefinitionText += `\n  ${makeTablePartitionKeyDefinitionText(
          tablePartitionKeyDefinition,
        )}`
      }

      // Indexes
      let tableIndexesText
      const tableIndexTexts = tableIndexes.map(
        tableIndex => makeTableIndexText(tableIndex, definitionsManager),
      )

      if (tableIndexTexts.length !== 0) {
        tableIndexesText = dedent`
          ### Indexes:
          ${makeListMarkdown(tableIndexTexts)}
        `
      }

      // Constraints
      // Check constraints
      let tableCheckConstraintsText
      const tableCheckConstraintTexts = tableConstraints
        .filter(constraint => constraint.type === "check")
        .map(constraint => makeTableConastaintText(constraint, definitionsManager))

      if (tableCheckConstraintTexts.length !== 0) {
        tableCheckConstraintsText = dedent`
          ### Check constraints:
          ${makeListMarkdown(tableCheckConstraintTexts)}
        `
      }

      // Foreign key constraints
      let tableForeignKeyConstraintsText
      const tableForeignKeyConstraintTexts = tableConstraints
        .filter(constraint => constraint.type === "foreign_key")
        .map(constraint => makeTableConastaintText(constraint, definitionsManager))

      if (tableForeignKeyConstraintTexts.length !== 0) {
        tableForeignKeyConstraintsText = dedent`
          ### Foreign key constraints:
          ${makeListMarkdown(tableForeignKeyConstraintTexts)}
        `
      }

      // Triggers
      let tableTriggersText
      const tableTriggerTexts = tableTriggers
        .map(trigger => makeTableTriggerText(trigger, definitionsManager))

      if (tableTriggerTexts.length !== 0) {
        tableTriggersText = dedent`
          ### Triggers:
          ${makeListMarkdown(tableTriggerTexts)}
        `
      }

      // Table definition text
      let tableInfos = [
        tableIndexesText,
        tableCheckConstraintsText,
        tableForeignKeyConstraintsText,
        tableTriggersText,
      ].filter<string>((x): x is string => typeof x === "string")

      if (tableInfos.length !== 0) {
        tableInfos = ["----------------"].concat(tableInfos)
      }

      return [makePostgresCodeMarkdown(tableDefinitionText)]
        .concat(tableInfos).join("\n\n")
    },
  )

  return {
    contents: {
      kind: MarkupKind.Markdown,
      value: definitionsTexts.join("\n\n"),
    },
  }
}

async function getViewHover(
  pgPool: PostgresPool,
  schema: string | undefined,
  tableName: string,
  defaultSchema: string,
  logger: Logger,
): Promise<Hover | undefined> {
  const definitions = await queryViewDefinitions(
    pgPool, schema, defaultSchema, logger, tableName,
  )

  return await makeHover(
    definitions.map(
      (definition) => makeViewDefinitionText(definition),
    ),
  )
}

async function getFunctionHover(
  pgPool: PostgresPool,
  schema: string | undefined,
  functionName: string,
  defaultSchema: string,
  logger: Logger,
): Promise<Hover | undefined> {
  const definitions = await queryFunctionDefinitions(
    pgPool, schema, defaultSchema, logger, functionName,
  )

  return await makeHover(
    definitions.map(
      (definition) => makeFunctionDefinitionText(definition),
    ),
  )
}

async function getTypeHover(
  pgPool: PostgresPool,
  schema: string | undefined,
  typeName: string,
  defaultSchema: string,
  logger: Logger,
): Promise<Hover | undefined> {
  const definitions = await queryTypeDefinitions(
    pgPool, schema, defaultSchema, logger, typeName,
  )

  return await makeHover(
    definitions.map(
      (definition) => makeTypeDefinitionText(definition),
    ),
  )
}


async function getIndexHover(
  pgPool: PostgresPool,
  schema: string | undefined,
  triggerName: string,
  defaultSchema: string,
  logger: Logger,
): Promise<Hover | undefined> {
  const definitions = await queryIndexDefinitions(
    pgPool, schema, triggerName, defaultSchema, logger,
  )

  return await makeHover(
    definitions.map(
      (definition) => makeIndexDefinitionText(definition),
    ),
  )
}

async function getTriggerHover(
  pgPool: PostgresPool,
  schema: string | undefined,
  triggerName: string,
  defaultSchema: string,
  logger: Logger,
): Promise<Hover | undefined> {
  const definitions = await queryTriggerDefinitions(
    pgPool, schema, triggerName, defaultSchema, logger,
  )

  return await makeHover(
    definitions.map(
      (definition) => makeTriggerDefinitionText(definition),
    ),
  )
}

async function makeHover(
  definitionTexts: string[],
): Promise<Hover | undefined> {
  if (definitionTexts.length === 0) {
    return undefined
  }

  const code = definitionTexts.join("\n\n")

  return {
    contents: {
      kind: MarkupKind.Markdown,
      value: makePostgresCodeMarkdown(code),
    },
  }
}
