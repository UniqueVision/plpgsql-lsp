import {
  CompletionItem, CompletionItemKind, CompletionParams, Logger,
} from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { PostgresPool } from "@/postgres/pool"
import {
  getFunctionDefinitions, makeFunctionDefinitionText, makeInsertFunctionText,
} from "@/postgres/queries/getFunctionDefinitions"
import {
  getTableDefinitions, makeTableDefinitionText,
} from "@/postgres/queries/getTableDefinitions"
import {
  getTypeDefinitions, makeTypeDefinitionText,
} from "@/postgres/queries/getTypeDefinitions"
import { getWordRangeAtPosition } from "@/utilities/text"


export async function getCompletionItems(
  pgPool: PostgresPool,
  params: CompletionParams,
  textDocument: TextDocument,
  defaultSchema: string,
  logger: Logger,
): Promise<CompletionItem[] | undefined> {
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

async function getSchemaCompletionItems(
  pgPool: PostgresPool,
  logger: Logger,
): Promise<CompletionItem[]> {
  let completionItems: CompletionItem[] = []

  const pgClient = await pgPool.connect()
  try {
    const results = await pgClient.query(`
        SELECT
            DISTINCT schema_name
        FROM
            information_schema.schemata
        ORDER BY
            schema_name
    `)
    const formattedResults = results.rows.map(
      (row, index) => {
        const schemaName = `${row["schema_name"]}`

        return {
          label: schemaName,
          kind: CompletionItemKind.Module,
          data: index,
          detail: `SCHEMA ${schemaName}`,
        }
      },
    )
    completionItems = completionItems.concat(formattedResults)
  }
  catch (error: unknown) {
    logger.error(`${(error as Error).toString()}`)
  }
  finally {
    pgClient.release()
  }

  return completionItems
}

async function getTableCompletionItems(
  pgPool: PostgresPool,
  schema: string | undefined,
  defaultSchema: string,
  logger: Logger,
): Promise<CompletionItem[]> {
  const definitions = await getTableDefinitions(
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
  const definitions = await getFunctionDefinitions(
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
  const definition = await getTypeDefinitions(
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
