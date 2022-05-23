import dedent from "ts-dedent"
import {
  CompletionItem,
  CompletionItemKind,
  InsertTextFormat,
  Logger,
  Position,
} from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { PostgresPool } from "@/postgres"
import { PostgresKind } from "@/postgres/kind"
import {
  makeDomainDefinitionText,
  queryDomainDefinitions,
} from "@/postgres/queries/queryDomainDefinitions"
import {
  makeFunctionDefinitionText,
  makeInsertFunctionText,
  queryFunctionDefinitions,
} from "@/postgres/queries/queryFunctionDefinitions"
import {
  makeMaterializedViewDefinitionText,
  queryMaterializedViewDefinitions,
} from "@/postgres/queries/queryMaterializedViewDefinitions"
import { querySchemas } from "@/postgres/queries/querySchemas"
import {
  makeTableDefinitionText,
  queryTableDefinitions,
} from "@/postgres/queries/queryTableDefinitions"
import {
  makeTypeDefinitionText,
  queryTypeDefinitions,
} from "@/postgres/queries/queryTypeDefinitions"
import {
  makeViewDefinitionText,
  queryViewDefinitions,
} from "@/postgres/queries/queryViewDefinitions"
import { neverReach } from "@/utilities/neverReach"
import {
  getWordRangeAtPosition,
  isFirstCommentLine,
} from "@/utilities/text"

export async function getCompletionItems(
  pgPool: PostgresPool,
  document: TextDocument,
  position: Position,
  defaultSchema: string,
  logger: Logger,
): Promise<CompletionItem[] | undefined> {
  if (isFirstCommentLine(document, position)) {
    return getLanguageServerCommentCompletionItems()
  }

  const wordRange = getWordRangeAtPosition(document, position)
  if (wordRange === undefined) {
    return undefined
  }
  const word = document.getText(wordRange)

  const schmaCompletionItems = await getSchemaCompletionItems(pgPool, logger)

  const schema = findSchema(
    word,
    schmaCompletionItems.map((item) => item.label),
  )

  const completionItems = schmaCompletionItems
    .concat(await getTableCompletionItems(pgPool, schema, defaultSchema, logger))
    .concat(await getViewCompletionItems(pgPool, schema, defaultSchema, logger))
    .concat(
      await getMaterializedViewCompletionItems(pgPool, schema, defaultSchema, logger),
    )
    .concat(await getFunctionCompletionItems(pgPool, schema, defaultSchema, logger))
    .concat(await getTypeCompletionItems(pgPool, schema, defaultSchema, logger))
    .concat(await getDomainCompletionItems(pgPool, schema, defaultSchema, logger))
    .concat(getBuiltinFunctionCompletionItems())

  return completionItems
    .concat(getKeywordCompletionItems(
      word, document.getText(), completionItems,
    ))
    .map(
      (item, index) => {
        item.data = index

        return item
      },
    )
}

function convertToCompletionItemKind(kind: PostgresKind): CompletionItemKind {
  switch (kind) {
    case PostgresKind.Schema:
      return CompletionItemKind.Module
    case PostgresKind.Table:
      return CompletionItemKind.Class
    case PostgresKind.View:
      return CompletionItemKind.Class
    case PostgresKind.MaterializedView:
      return CompletionItemKind.Class
    case PostgresKind.Type:
      return CompletionItemKind.Struct
    case PostgresKind.Domain:
      return CompletionItemKind.Struct
    case PostgresKind.Index:
      return CompletionItemKind.Struct
    case PostgresKind.Function:
      return CompletionItemKind.Function
    case PostgresKind.Trigger:
      return CompletionItemKind.Event
    default: {
      const unknownKind: never = kind
      neverReach( `"${unknownKind}" is unknown "PostgresKind".` )
    }
  }
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

export function getLanguageServerCommentCompletionItems(): CompletionItem[] {
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
    {
      label: "plpgsql-language-server:use-query-parameter",
      kind: CompletionItemKind.Text,
      data: 0,
      detail: "Use query parameter.",
    },
    {
      label: "plpgsql-language-server:use-positional-query-parameter",
      kind: CompletionItemKind.Text,
      data: 0,
      detail: "Use positional query parameter.",
    },
    {
      label: "plpgsql-language-server:use-positional-query-parameter number=1",
      kind: CompletionItemKind.Text,
      data: 0,
      detail: "Use positional query parameter with number.",
    },
    {
      label: "plpgsql-language-server:use-keyword-query-parameter",
      kind: CompletionItemKind.Text,
      data: 0,
      detail: "Use keyword query parameter.",
    },
    {
      label: "plpgsql-language-server:use-keyword-query-parameter keywords=[id, name]",
      kind: CompletionItemKind.Text,
      data: 0,
      detail: "Use keyword query parameter with keywords.",
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
        kind: convertToCompletionItemKind(PostgresKind.Schema),
        data: index,
        detail: `Schema ${schema}`,
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
    pgPool, schema, undefined, defaultSchema, logger,
  )

  return definitions
    .map(
      (definition, index) => ({
        label: definition.tableName,
        kind: convertToCompletionItemKind(PostgresKind.Table),
        data: index,
        detail: makeTableDefinitionText(definition),
      }),
    )
}

async function getViewCompletionItems(
  pgPool: PostgresPool,
  schema: string | undefined,
  defaultSchema: string,
  logger: Logger,
): Promise<CompletionItem[]> {
  const definitions = await queryViewDefinitions(
    pgPool, schema, undefined, defaultSchema, logger,
  )

  return definitions
    .map(
      (definition, index) => ({
        label: definition.viewName,
        kind: convertToCompletionItemKind(PostgresKind.View),
        data: index,
        detail: makeViewDefinitionText(definition),
      }),
    )
}

async function getMaterializedViewCompletionItems(
  pgPool: PostgresPool,
  schema: string | undefined,
  defaultSchema: string,
  logger: Logger,
): Promise<CompletionItem[]> {
  const definitions = await queryMaterializedViewDefinitions(
    pgPool, schema, undefined, defaultSchema, logger,
  )

  return definitions
    .map(
      (definition, index) => ({
        label: definition.viewName,
        kind: convertToCompletionItemKind(PostgresKind.MaterializedView),
        data: index,
        detail: makeMaterializedViewDefinitionText(definition),
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
    pgPool, schema, undefined, defaultSchema, logger,
  )

  return definitions
    .map(
      (definition, index) => ({
        label: definition.functionName,
        kind: convertToCompletionItemKind(PostgresKind.Function),
        data: index,
        detail: makeFunctionDefinitionText(definition),
        insertText: makeInsertFunctionText(definition),
        insertTextFormat: InsertTextFormat.Snippet,
      }),
    )
}

function getBuiltinFunctionCompletionItems(): CompletionItem[] {
  return ["COALESCE", "GREATEST", "LEAST"]
    .map(
      (functionName, index) => ({
        label: functionName,
        kind: convertToCompletionItemKind(PostgresKind.Function),
        data: index,
        detail: dedent`
          FUNCTION ${functionName}(value [, ...])
            LANGUAGE built-in
        `,
        insertText: `${functionName}($\{1:value}, $\{2:...})`,
        insertTextFormat: InsertTextFormat.Snippet,
      }),
    ).concat(["NULLIF"]
      .map(
        (functionName, index) => ({
          label: functionName,
          kind: convertToCompletionItemKind(PostgresKind.Function),
          data: index,
          detail: dedent`
          FUNCTION ${functionName}(value1, value2)
            LANGUAGE built-in
          `,
          insertText: `${functionName}($\{1:value1}, $\{2:value2})`,
          insertTextFormat: InsertTextFormat.Snippet,
        }),
      ))
}

async function getDomainCompletionItems(
  pgPool: PostgresPool,
  schema: string | undefined,
  defaultSchema: string,
  logger: Logger,
): Promise<CompletionItem[]> {
  const definition = await queryDomainDefinitions(
    pgPool, schema, undefined, defaultSchema, logger,
  )

  return definition
    .map(
      (definition, index) => ({
        label: definition.domainName,
        kind: convertToCompletionItemKind(PostgresKind.Domain),
        data: index,
        detail: makeDomainDefinitionText(definition),
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
    pgPool, schema, undefined, defaultSchema, logger,
  )

  return definition
    .map(
      (definition, index) => ({
        label: definition.typeName,
        kind: convertToCompletionItemKind(PostgresKind.Type),
        data: index,
        detail: makeTypeDefinitionText(definition),
      }),
    )
}

function getKeywordCompletionItems(
  word: string, documentText: string, completionItems: CompletionItem[],
): CompletionItem[] {
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
