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

    return (await getTableCompletionItems(space, settings))
        .concat(await getStoredProcedureCompletionItems(space, settings))
        .map((item, index) => {
            item.data = index

            return item
        })
}

async function getStoredProcedureCompletionItems(
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
                relnamespace::regnamespace::TEXT || '.' || relname AS table_name
            FROM
                pg_class
            WHERE
                relkind = 'p' OR (relkind = 'r' AND NOT relispartition)
            UNION
            SELECT
                relname AS table_name
            FROM
                pg_class
            WHERE
                relkind = 'p' OR (relkind = 'r' AND NOT relispartition)
                AND relnamespace::regnamespace::TEXT = '${settings.defaultSchema}'
            ORDER BY
                table_name
        `)
        const formattedResults = results.rows.map((row, index) => {
            const tableName = `${row["table_name"]}`

            return {
                label: tableName,
                kind: CompletionItemKind.Struct,
                data: index,
                detail: tableName,
                document: tableName,
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
