import {
    CompletionItem, CompletionItemKind, CompletionParams,
} from "vscode-languageserver"

import { getWordRangeAtPosition } from "../helpers"
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

    const schmaCompletionItems = await getSchemaCompletionItems(space, settings)

    const schema = getSchema(
        textDocument.getText(wordRange),
        schmaCompletionItems.map(item => {
            return item.label
        }),
        settings,
    )

    const completionItems = schmaCompletionItems
        .concat(await getTableCompletionItems(space, schema, settings))
        .concat(await getFunctionCompletionItems(space, schema, settings))
        .concat(await getTypeCompletionItems(space, schema, settings))

    return completionItems
        .concat(await getKeywordCompletionItems(
            textDocument.getText(), completionItems,
        ))
        .map((item, index) => {
            item.data = index

            return item
        })
}

function getSchema(
    word: string, schemas: string[], settings: LanguageServerSettings,
): string {
    const schemaMatch = word.match(`^(${schemas.join("|")})."?`)

    if (schemaMatch === null) {
        return settings.defaultSchema
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
    space: Space, schema: string, settings: LanguageServerSettings,
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
    space: Space, schema: string, settings: LanguageServerSettings,
): Promise<CompletionItem[]> {
    const pgClient = await space.getPgClient(settings)
    if (pgClient === undefined) {
        return []
    }

    let completionItems: CompletionItem[] = []
    try {
        // https://dataedo.com/kb/query/postgresql/list-stored-procedures
        const results = await pgClient.query(`
            SELECT
                DISTINCT t_pg_proc.proname,
                CASE
                WHEN t_pg_language.lanname = 'internal' THEN
                    t_pg_proc.prosrc
                ELSE
                    pg_get_functiondef(t_pg_proc.oid)
                END AS definition
            FROM
                pg_proc AS t_pg_proc
            LEFT JOIN pg_language AS t_pg_language ON (
                t_pg_proc.prolang = t_pg_language.oid
            )
            WHERE
                t_pg_proc.pronamespace::regnamespace::TEXT = '${schema}'
            ORDER BY
                proname
        `)

        const formattedResults = results.rows.map((row, index) => {
            const proname = `${row["proname"]}`
            const definition = `${row["definition"]}`

            // definitionから引数リストをとります
            const funcParams = definition.match(/\(.*\)/g)
            const funcParam = funcParams ? funcParams[0] : ""
            const funcParamItems = funcParam.match(/\(\w*\s|,\s\w*\s/g) || []

            // 引数リストからクエリーを生成します
            let paramsCustomize = "("
            funcParamItems.forEach((item, index) => {
                paramsCustomize += "\n\t"

                const paramName = item
                    .replace("(", "")
                    .replace(/\s/g, "")
                    .replace(",", "")

                paramsCustomize += (
                    `${index === 0 ? "" : ","}${paramName} := ${paramName}`
                )
            })
            paramsCustomize += `${funcParamItems.length > 0 ? "\n" : ""})`

            // CompletionItem返します
            return {
                label: proname,
                kind: CompletionItemKind.Function,
                data: index,
                detail: definition,
                insertText: proname + paramsCustomize,
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

async function getTypeCompletionItems(
    space: Space, schema: string, settings: LanguageServerSettings,
): Promise<CompletionItem[]> {
    const pgClient = await space.getPgClient(settings)
    if (pgClient === undefined) {
        return []
    }

    return (await getTypeDefinitions(pgClient, schema, settings.defaultSchema))
        .map(({ typeName, fields }, index) => {
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
    text: string, completionItems: CompletionItem[],
): Promise<CompletionItem[]> {
    const completionNames = new Set(completionItems.map(item => {
        return item.label
    }))

    const keywords = text
        .split(/[\s,.():="'-]+/)
        .filter(x => { return x.length >= 4 && !completionNames.has(x) })

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
