import {
    CompletionItem, CompletionItemKind, CompletionParams,
} from "vscode-languageserver"

import { getWordRangeAtPosition } from "../helpers"
import { getFunctionDefinitions } from "../postgres/queries/getFunctionDefinitions"
import { getTableDefinitions } from "../postgres/queries/getTableDefinitions"
import { getTypeDefinitions } from "../postgres/queries/getTypeDefinitions"
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
        .map(({ tableName, fields }, index) => {
            let fieldsString = ""
            if (fields.length > 0) {
                fieldsString = "\n  " + fields.map(({ columnName, dataType }) => {
                    return `${columnName} ${dataType}`
                }).join(",\n  ") + "\n"
            }

            return {
                label: tableName,
                kind: CompletionItemKind.Struct,
                data: index,
                detail: `TABLE ${schema}.${tableName}(${fieldsString})`,
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
    let schemaString = ""
    if (schema !== undefined) {
        schemaString = `${schema}.`
    }

    return (await getFunctionDefinitions(pgClient, schema, settings.defaultSchema))
        .map(({
            schema,
            functionName,
            functionArgs,
            functionIdentityArgs,
            returnType,
            isSetOf,
            volatile,
            parallel,
        }, index) => {
            let argsString = ""
            if (functionArgs.length > 0) {
                argsString = "\n  " + functionArgs.join(",\n  ") + "\n"
            }

            let callArgsString = ""
            if (functionIdentityArgs.length > 0) {
                callArgsString = "\n  " + functionIdentityArgs.map(arg => {
                    const splitted = arg.split(" ")
                    if (splitted.length === 1 || splitted[1] === '"any"') {
                        // argument
                        return splitted[0]
                    }
                    else {
                        // keyword argument
                        return `${splitted[0]} := ${splitted[0]}`
                    }
                }).join(",\n  ") + "\n"
            }

            let returnString = returnType
            if (isSetOf) {
                returnString = `SETOF ${returnType}`
            }
            let detail = (
                `FUNCTION ${schema}.${functionName}(${argsString})\n`
                + `RETURNS ${returnString}`
            )

            const functionInfos = []
            if (volatile !== undefined) {
                functionInfos.push(volatile)
            }
            if (parallel !== undefined) {
                functionInfos.push(parallel)
            }
            if (functionInfos.length !== 0) {
                detail += `\n${functionInfos.join(" ")}`
            }

            return {
                label: functionName,
                kind: CompletionItemKind.Value,
                data: index,
                detail,
                insertText: `${schemaString}${functionName}(${callArgsString})`,
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
        .map(({ schema, typeName, fields }, index) => {
            let fieldsString = ""
            if (fields.length > 0) {
                fieldsString = "\n  " + fields.map(({ columnName, dataType }) => {
                    return `${columnName} ${dataType}`
                }).join(",\n  ") + "\n"
            }

            return {
                label: typeName,
                kind: CompletionItemKind.Value,
                data: index,
                detail: `TYPE ${schema}.${typeName}(${fieldsString})`,
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
