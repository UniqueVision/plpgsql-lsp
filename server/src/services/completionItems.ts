import {
    CompletionItem, CompletionItemKind, CompletionParams,
} from "vscode-languageserver"

import { getWordRangeAtPosition } from "../helpers"
import {
    getFunctionDefinitions, makeFunctionDefinitionText, makeInsertFunctionText,
} from "../postgres/queries/getFunctionDefinitions"
import {
    getTableDefinitions, makeTableDefinitionText,
} from "../postgres/queries/getTableDefinitions"
import {
    getTypeDefinitions, makeTypeDefinitionText,
} from "../postgres/queries/getTypeDefinitions"
import { console } from "../server"
import { LanguageServerSettings } from "../settings"
import { Space } from "../space"


export async function getCompletionItems(
    space: Space, params: CompletionParams,
): Promise<CompletionItem[] | undefined> {

    const settings = await space.getDocumentSettings(
        params.textDocument.uri,
    )

    const textDocument = space.documents.get(
        params.textDocument.uri,
    )
    if (textDocument === undefined) {
        return undefined
    }

    const wordRange = getWordRangeAtPosition(textDocument, params.position)
    if (wordRange === undefined) {
        return undefined
    }
    const word = textDocument.getText(wordRange)

    const schmaCompletionItems = await getSchemaCompletionItems(space, settings)

    const schema = findSchema(
        word,
        schmaCompletionItems.map(item => {
            return item.label
        }),
    )

    const completionItems = schmaCompletionItems
        .concat(await getTableCompletionItems(space, schema, settings))
        .concat(await getFunctionCompletionItems(space, schema, settings))
        .concat(await getTypeCompletionItems(space, schema, settings))

    return completionItems
        .concat(await getKeywordCompletionItems(
            word, textDocument.getText(), completionItems,
        ))
        .map((item, index) => {
            item.data = index

            return item
        })
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
    space: Space, settings: LanguageServerSettings,
): Promise<CompletionItem[]> {
    const pgClient = await space.getPgClient(settings)
    if (pgClient === undefined) {
        return []
    }

    let completionItems: CompletionItem[] = []
    try {
        const results = await pgClient.query(`
            SELECT
                DISTINCT schema_name
            FROM
                information_schema.schemata
            ORDER BY
                schema_name
        `)
        const formattedResults = results.rows.map((row, index) => {
            const schemaName = `${row["schema_name"]}`

            return {
                label: schemaName,
                kind: CompletionItemKind.Module,
                data: index,
                detail: `SCHEMA ${schemaName}`,
            }
        })
        completionItems = completionItems.concat(formattedResults)
    }
    catch (error: unknown) {
        console.error(`${error}`)
    }
    finally {
        pgClient.release()
    }

    return completionItems
}

async function getTableCompletionItems(
    space: Space,
    schema: string | undefined,
    settings: LanguageServerSettings,
): Promise<CompletionItem[]> {
    const pgClient = await space.getPgClient(settings)
    if (pgClient === undefined) {
        return []
    }

    return (await getTableDefinitions(pgClient, schema, settings.defaultSchema))
        .map((definition, index) => {
            return {
                label: definition.tableName,
                kind: CompletionItemKind.Struct,
                data: index,
                detail: makeTableDefinitionText(definition),
            }
        })
}

async function getFunctionCompletionItems(
    space: Space,
    schema: string | undefined,
    settings: LanguageServerSettings,
): Promise<CompletionItem[]> {
    const pgClient = await space.getPgClient(settings)
    if (pgClient === undefined) {
        return []
    }

    return (await getFunctionDefinitions(pgClient, schema, settings.defaultSchema))
        .map((definition, index) => {
            return {
                label: definition.functionName,
                kind: CompletionItemKind.Value,
                data: index,
                detail: makeFunctionDefinitionText(definition),
                insertText: makeInsertFunctionText(definition),
            }
        })
}

async function getTypeCompletionItems(
    space: Space, schema: string | undefined, settings: LanguageServerSettings,
): Promise<CompletionItem[]> {
    const pgClient = await space.getPgClient(settings)
    if (pgClient === undefined) {
        return []
    }

    return (await getTypeDefinitions(pgClient, schema, settings.defaultSchema))
        .map((definition, index) => {
            return {
                label: definition.typeName,
                kind: CompletionItemKind.Value,
                data: index,
                detail: makeTypeDefinitionText(definition),
            }
        })
}

async function getKeywordCompletionItems(
    word: string, documentText: string, completionItems: CompletionItem[],
): Promise<CompletionItem[]> {
    const completionNames = new Set(completionItems.map(item => {
        return item.label
    }))

    const keywords = documentText
        .split(/[\s,.():="'-]+/)
        .filter(x => { return x.length >= 4 && !completionNames.has(x) && x !== word })

    return Array.from(new Set(keywords))
        .sort()
        .map((keyword, index) => {
            return {
                label: keyword,
                kind: CompletionItemKind.Keyword,
                data: index,
            }
        })
}
