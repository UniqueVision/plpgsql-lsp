import {
    CompletionItem, CompletionItemKind, CompletionParams,
} from "vscode-languageserver"

import { getWordRangeAtPosition } from "../helpers"
import { console } from "../server"
import { LanguageServerSettings } from "../settings"
import { Space } from "../space"


export async function getCompletionItems(
    space: Space, params: CompletionParams,
) {

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

    return schmaCompletionItems
        .concat(await getTableCompletionItems(space, schema, settings))
        .concat(await getStoredFunctionCompletionItems(space, schema, settings))
        .concat(await getTypeCompletionItems(space, schema, settings))
        .map((item, index) => {
            item.data = index

            return item
        })
}

function getSchema(word: string, schemas: string[], settings: LanguageServerSettings) {
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
) {
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
                document: schemaName,
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
) {
    const pgClient = await space.getPgClient(settings)
    if (pgClient === undefined) {
        return []
    }

    let completionItems: CompletionItem[] = []
    try {
        const results = await pgClient.query(`
            SELECT
                table_name,
                json_agg(
                    json_build_object(
                        'column_name', column_name,
                        'data_type', data_type
                    )
                    ORDER BY
                        ordinal_position
                ) AS fields
            FROM
                information_schema.columns
            WHERE
                table_schema = '${schema}'
            GROUP BY
                table_name
        `)
        const formattedResults = results.rows.map((row, index) => {
            const tableName = `${row["table_name"]}`
            const fields = (
                row["fields"] as { column_name: string, data_type: string }[]
            ).map(field => {
                return `${field["column_name"]} ${field["data_type"].toUpperCase()}`
            })

            return {
                label: tableName,
                kind: CompletionItemKind.Struct,
                data: index,
                detail: `TABLE ${schema}.${tableName}(\n  ${fields.join(",\n  ")}\n)`,
                document: `${schema}.${tableName}`,
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

async function getStoredFunctionCompletionItems(
    space: Space, schema: string, settings: LanguageServerSettings,
) {
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
                document: `${schema}.${proname}`,
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
) {
    const pgClient = await space.getPgClient(settings)
    if (pgClient === undefined) {
        return []
    }

    let completionItems: CompletionItem[] = []
    try {
        const results = await pgClient.query(`
            SELECT
                DISTINCT t.typname as type_name
            FROM
                pg_type t
                LEFT JOIN pg_catalog.pg_namespace n ON
                    n.oid = t.typnamespace
            WHERE
                (
                    t.typrelid = 0 OR (
                        SELECT
                            c.relkind = 'c'
                        FROM
                            pg_catalog.pg_class c
                        WHERE
                            c.oid = t.typrelid
                    )
                )
                AND NOT EXISTS(
                    SELECT
                        1
                    FROM
                        pg_catalog.pg_type el
                    WHERE
                        el.oid = t.typelem
                        AND el.typarray = t.oid
                )
                AND n.nspname = '${schema}'
            ORDER BY
                type_name
        `)
        const formattedResults = results.rows.map((row, index) => {
            const typeName = `${row["type_name"]}`

            return {
                label: typeName,
                kind: CompletionItemKind.Value,
                data: index,
                detail: `${schema}.${typeName}`,
                document: `${schema}.${typeName}`,
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
