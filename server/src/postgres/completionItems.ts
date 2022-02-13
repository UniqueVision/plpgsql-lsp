import {
    CompletionItem, CompletionItemKind, TextDocumentIdentifier,
} from "vscode-languageserver"

import { console } from "../server"
import { LanguageServerSettings } from "../settings"
import { Space } from "../space"


export async function getCompletionItems(
    space: Space, textDocument: TextDocumentIdentifier,
) {
    const settings = await space.getDocumentSettings(
        textDocument.uri,
    )

    return ([] as CompletionItem[])
        .concat(await getSchemaCompletionItems(space, settings))
        .concat(await getTableCompletionItems(space, settings))
        .concat(await getStoredFunctionCompletionItems(space, settings))
        .concat(await getTypeCompletionItems(space, settings))
        .map((item, index) => {
            item.data = index

            return item
        })
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
                schema_name
            FROM
                information_schema.schemata
        `)
        const formattedResults = results.rows.map((row, index) => {
            const schemaName = `${row["schema_name"]}`

            return {
                label: schemaName,
                kind: CompletionItemKind.Module,
                data: index,
                detail: schemaName,
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
                relname AS table_name,
                relnamespace::regnamespace::TEXT AS schema_name
            FROM
                pg_class
            WHERE
                relkind = 'p' OR (relkind = 'r' AND NOT relispartition)
            ORDER BY
                table_name
        `)
        const formattedResults = results.rows.map((row, index) => {
            const tableName = `${row["table_name"]}`
            const schemaName = `${row["schema_name"]}`

            return {
                label: tableName,
                kind: CompletionItemKind.Struct,
                data: index,
                detail: schemaName || "." || tableName,
                document: schemaName || "." || tableName,
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
    space: Space, settings: LanguageServerSettings,
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
                t_pg_proc.proname
                ,CASE
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
                document: proname,
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
                n.nspname as schema_name,
                t.typname as type_name
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
                AND n.nspname NOT IN ('pg_catalog', 'information_schema')
            ORDER BY
                type_name
        `)
        const formattedResults = results.rows.map((row, index) => {
            const typeName = `${row["type_name"]}`
            const schemaName = `${row["schema_name"]}`

            return {
                label: typeName,
                kind: CompletionItemKind.Value,
                data: index,
                detail: schemaName || "." || typeName,
                document: schemaName || "." || typeName,
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
