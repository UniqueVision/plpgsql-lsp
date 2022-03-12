import {
  CompletionItem,
  CompletionItemKind,
  CompletionParams,
  Logger,
} from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { PostgresPool } from "@/postgres/pool"
import {
  makeFunctionDefinitionText,
  makeInsertFunctionText,
  queryFunctionDefinitions,
} from "@/postgres/queries/queryFunctionDefinitions"
import { querySchemas } from "@/postgres/queries/querySchemas"
import {
  makeTableDefinitionText,
  queryTableDefinitions,
} from "@/postgres/queries/queryTableDefinitions"
import {
  makeTypeDefinitionText,
  queryTypeDefinitions,
} from "@/postgres/queries/queryTypeDefinitions"
import { getWordRangeAtPosition, isFirstCommentLine } from "@/utilities/text"


export async function getCompletionItems(
  pgPool: PostgresPool,
  params: CompletionParams,
  textDocument: TextDocument,
  defaultSchema: string,
  logger: Logger,
): Promise<CompletionItem[] | undefined> {
  if (isFirstCommentLine(textDocument, params.position)) {
    return getDisableCommentCompletionItems()
  }

  const wordRange = getWordRangeAtPosition(textDocument, params.position)
  if (wordRange === undefined) {
    return undefined
  }
  const word = textDocument.getText(wordRange)

  const schmaCompletionItems = await getSchemaCompletionItems(pgPool, logger)

  const schema = findSchema(
    word,
    schmaCompletionItems.map((item) => item.label),
  )

  const completionItems = schmaCompletionItems
    .concat(await getTableCompletionItems(pgPool, schema, defaultSchema, logger))
    .concat(await getFunctionCompletionItems(pgPool, schema, defaultSchema, logger))
    .concat(await getTypeCompletionItems(pgPool, schema, defaultSchema, logger))

  return completionItems
    .concat(await getKeywordCompletionItems(
      word, textDocument.getText(), completionItems,
    ))
    .map(
      (item, index) => {
        item.data = index

        return item
      },
    )
}

function findSchema(
  word: string, schemas: string[],
): string | undefined {
  const schemaMatch = word.match(`^(${schemas.join("|")})."?`)

  if (schemaMatch === null) {
    return undefined
  }
  else {
    return schemaMatch[1]
  }
}

function getDisableCommentCompletionItems(): CompletionItem[] {
  return [
    {
      label: "plpgsql-language-server:disable",
      kind: CompletionItemKind.Text,
      data: 0,
      detail: "Disable all features.",
    },
    {
      label: "plpgsql-language-server:disable validation",
      kind: CompletionItemKind.Text,
      data: 0,
      detail: "Disable validation feature only.",
    },
  ]
}

async function getSchemaCompletionItems(
  pgPool: PostgresPool,
  logger: Logger,
): Promise<CompletionItem[]> {
  const schemas = await querySchemas(pgPool, logger)

  return schemas.map(
    (schema, index) => {
      return {
        label: schema,
        kind: CompletionItemKind.Module,
        data: index,
        detail: `SCHEMA ${schema}`,
      }
    },
  )
}

async function getTableCompletionItems(
  pgPool: PostgresPool,
  schema: string | undefined,
  defaultSchema: string,
  logger: Logger,
): Promise<CompletionItem[]> {
  const definitions = await queryTableDefinitions(
    pgPool, schema, defaultSchema, logger,
  )

  return definitions
    .map(
      (definition, index) => ({
        label: definition.tableName,
        kind: CompletionItemKind.Struct,
        data: index,
        detail: makeTableDefinitionText(definition),
      }),
    )
}

async function getFunctionCompletionItems(
  pgPool: PostgresPool,
  schema: string | undefined,
  defaultSchema: string,
  logger: Logger,
): Promise<CompletionItem[]> {
  const definitions = await queryFunctionDefinitions(
    pgPool, schema, defaultSchema, logger,
  )

  return definitions
    .map(
      (definition, index) => ({
        label: definition.functionName,
        kind: CompletionItemKind.Value,
        data: index,
        detail: makeFunctionDefinitionText(definition),
        insertText: makeInsertFunctionText(definition),
      }),
    )
}

async function getTypeCompletionItems(
  pgPool: PostgresPool,
  schema: string | undefined,
  defaultSchema: string,
  logger: Logger,
): Promise<CompletionItem[]> {
  const definition = await queryTypeDefinitions(
    pgPool, schema, defaultSchema, logger,
  )

  return definition
    .map(
      (definition, index) => ({
        label: definition.typeName,
        kind: CompletionItemKind.Value,
        data: index,
        detail: makeTypeDefinitionText(definition),
      }),
    )
}

async function getKeywordCompletionItems(
  word: string, documentText: string, completionItems: CompletionItem[],
): Promise<CompletionItem[]> {
  const completionNames = new Set(completionItems.map((item) => item.label))

  const keywords = documentText
    .split(/[\s,.();:="'-]+/)
    .filter(
      (keyword) => (
        keyword.length >= 4
        && !completionNames.has(keyword)
        && keyword !== word
      ),
    )

  return Array.from(new Set(keywords))
    .sort()
    .map(
      (keyword, index) => ({
        label: keyword,
        kind: CompletionItemKind.Keyword,
        data: index,
      }),
    )
}
