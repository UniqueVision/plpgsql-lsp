import { Hover, HoverParams, Logger, MarkupKind } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { PostgresPool } from "@/postgres/pool"
import {
  getFunctionDefinitions, makeFunctionDefinitionText,
} from "@/postgres/queries/getFunctionDefinitions"
import {
  getTableDefinitions, makeTableDefinitionText,
} from "@/postgres/queries/getTableDefinitions"
import {
  getTypeDefinitions, makeTypeDefinitionText,
} from "@/postgres/queries/getTypeDefinitions"
import {
  getViewDefinitions, makeViewDefinitionText,
} from "@/postgres/queries/getViewDefinitions"
import {
  sanitizeWordCandidates,
} from "@/utilities/sanitizeWord"
import { separateSchemaFromCandidate } from "@/utilities/schema"
import { getWordRangeAtPosition, makePostgresCodeMarkdown } from "@/utilities/text"

export async function getHover(
  pgPool: PostgresPool,
  params: HoverParams,
  textDocument: TextDocument,
  defaultSchema: string,
  logger: Logger,
): Promise<Hover | undefined> {
  const wordRange = getWordRangeAtPosition(textDocument, params.position)
  if (wordRange === undefined) {
    return undefined
  }

  const word = textDocument.getText(wordRange)
  const sanitizedWordCandidates = sanitizeWordCandidates(word)

  for (const wordCandidate of sanitizedWordCandidates) {
    const schemaCandidate = separateSchemaFromCandidate(wordCandidate)
    if (schemaCandidate === undefined) {
      continue
    }
    const { schema, candidate } = schemaCandidate

    // Check as Table
    const tableHover = await getTableHover(
      pgPool, schema, candidate, defaultSchema, logger,
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
  }

  return undefined
}

async function getTableHover(
  pgPool: PostgresPool,
  schema: string | undefined,
  tableName: string,
  defaultSchema: string,
  logger: Logger,
): Promise<Hover | undefined> {
  const definitions = await getTableDefinitions(
    pgPool, schema, defaultSchema, logger, tableName,
  )

  if (definitions.length === 0) {
    return undefined
  }

  const code = definitions.map(
    (definition) => makeTableDefinitionText(definition),
  ).join("\n\n")

  return {
    contents: {
      kind: MarkupKind.Markdown,
      value: makePostgresCodeMarkdown(code),
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
  const definitions = await getViewDefinitions(
    pgPool, schema, defaultSchema, logger, tableName,
  )

  if (definitions.length === 0) {
    return undefined
  }

  const code = definitions.map(
    (definition) => makeViewDefinitionText(definition),
  ).join("\n\n")

  return {
    contents: {
      kind: MarkupKind.Markdown,
      value: makePostgresCodeMarkdown(code),
    },
  }
}

async function getFunctionHover(
  pgPool: PostgresPool,
  schema: string | undefined,
  functionName: string,
  defaultSchema: string,
  logger: Logger,
): Promise<Hover | undefined> {
  const definitions = await getFunctionDefinitions(
    pgPool, schema, defaultSchema, logger, functionName,
  )

  if (definitions.length === 0) {
    return undefined
  }

  const code = definitions.map(
    (definition) => makeFunctionDefinitionText(definition),
  ).join("\n\n")

  return {
    contents: {
      kind: MarkupKind.Markdown,
      value: makePostgresCodeMarkdown(code),
    },
  }
}

async function getTypeHover(
  pgPool: PostgresPool,
  schema: string | undefined,
  typeName: string,
  defaultSchema: string,
  logger: Logger,
): Promise<Hover | undefined> {
  const definitions = await getTypeDefinitions(
    pgPool, schema, defaultSchema, logger, typeName,
  )

  if (definitions.length === 0) {
    return undefined
  }

  const code = definitions.map(
    (definition) => makeTypeDefinitionText(definition),
  ).join("\n\n")

  return {
    contents: {
      kind: MarkupKind.Markdown,
      value: makePostgresCodeMarkdown(code),
    },
  }
}
