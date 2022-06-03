import dedent from "ts-dedent"
import { Hover, Logger, MarkupKind, Position } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { PostgresDefinition, PostgresPool } from "@/postgres"
import {
  makeDomainDefinitionText,
  queryDomainDefinitions,
} from "@/postgres/queries/queryDomainDefinitions"
import {
  makeFunctionDefinitionText,
  queryFunctionDefinitions,
} from "@/postgres/queries/queryFunctionDefinitions"
import {
  makeIndexDefinitionText,
  queryIndexDefinitions,
} from "@/postgres/queries/queryIndexDefinitions"
import {
  makeMaterializedViewDefinitionText,
  queryMaterializedViewDefinitions,
} from "@/postgres/queries/queryMaterializedViewDefinitions"
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

type HoverHelperMethods<T> = {
  queryDefinitions: (
    pgPool: PostgresPool,
    schema: string | undefined,
    candidate: string,
    defaultSchema: string,
    logger: Logger
  ) => Promise<T[]>,

  makeDefininitionText: (
    definition: T
  ) => string,
}

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

    for (const hoverMethods of [
      {
        queryDefinitions: queryViewDefinitions,
        makeDefininitionText: makeViewDefinitionText,
      },
      {
        queryDefinitions: queryMaterializedViewDefinitions,
        makeDefininitionText: makeMaterializedViewDefinitionText,
      },
      {
        queryDefinitions: queryFunctionDefinitions,
        makeDefininitionText: makeFunctionDefinitionText,
      },
      {
        queryDefinitions: queryTypeDefinitions,
        makeDefininitionText: makeTypeDefinitionText,
      },
      {
        queryDefinitions: queryDomainDefinitions,
        makeDefininitionText: makeDomainDefinitionText,
      },
      {
        queryDefinitions: queryIndexDefinitions,
        makeDefininitionText: makeIndexDefinitionText,
      },
      {
        queryDefinitions: queryTriggerDefinitions,
        makeDefininitionText: makeTriggerDefinitionText,
      },
    ]) {
      const hover = await makeHover(
        pgPool,
        schema,
        candidate,
        defaultSchema,
        logger,
        hoverMethods as HoverHelperMethods<PostgresDefinition>,
      )
      if (hover !== undefined) {
        return hover
      }
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
    pgPool, schema, tableName, defaultSchema, logger,
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

async function makeHover(
  pgPool: PostgresPool,
  schema: string | undefined,
  candidate: string,
  defaultSchema: string,
  logger: Logger,
  { queryDefinitions, makeDefininitionText }: HoverHelperMethods<PostgresDefinition>,
): Promise<Hover | undefined> {
  const definitions = await queryDefinitions(
    pgPool, schema, candidate, defaultSchema, logger,
  )
  const definitionTexts = definitions.map(
    (definition) => makeDefininitionText(definition),
  )

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
