import { Hover, HoverParams } from "vscode-languageserver"

import { getSchemaCandidate, getWordRangeAtPosition } from "../helpers"
import {
    getFunctionDefinitions, makeFunctionDefinitionText,
} from "../postgres/queries/getFunctionDefinitions"
import {
    getTableDefinitions, makeTableDefinitionText,
} from "../postgres/queries/getTableDefinitions"
import {
    getTypeDefinitions, makeTypeDefinitionText,
} from "../postgres/queries/getTypeDefinitions"
import { LanguageServerSettings } from "../settings"
import { Space } from "../space"
import {
    sanitizeDynamicPartitionTable,
    sanitizeNumberPartitionTable,
    sanitizeQuotedTable,
    sanitizeUuidPartitionTable,
} from "./_sanitizeWord"

export async function getHover(
    space: Space,
    params: HoverParams,
): Promise<Hover | undefined> {
    const uri = params.textDocument.uri
    const settings = space.globalSettings
    const document = space.documents.get(uri)
    if (document === undefined) {
        return undefined
    }

    const wordRange = getWordRangeAtPosition(document, params.position)
    if (wordRange === undefined) {
        return undefined
    }

    const word = document.getText(wordRange)

    const sanitizedWordCandidates = [
        // General match.
        sanitizeQuotedTable(sanitizeDynamicPartitionTable(word)),
        // Specific partition table match.
        sanitizeUuidPartitionTable(sanitizeNumberPartitionTable(word)),
    ]

    for (const wordCandidate of
        sanitizedWordCandidates
    ) {
        const schemaCandidate = getSchemaCandidate(wordCandidate)
        if (schemaCandidate === undefined) {
            continue
        }
        const { schema, candidate } = schemaCandidate

        // Check as Table
        const tableHover = await getTableHover(
            space, schema, candidate, settings,
        )
        if (tableHover !== undefined) {
            return tableHover
        }

        // Check as Table
        const functionHover = await getFunctionHover(space, schema, candidate, settings)
        if (functionHover !== undefined) {
            return functionHover
        }

        // Check as Type
        const typeHover = await getTypeHover(space, schema, candidate, settings)
        if (typeHover !== undefined) {
            return typeHover
        }
    }

    return undefined
}

async function getTableHover(
    space: Space,
    schema: string | undefined,
    tableName: string,
    settings: LanguageServerSettings,
): Promise<Hover | undefined> {
    const pgClient = await space.getPgClient(settings)
    if (pgClient === undefined) {
        return undefined
    }

    const definitions = (await getTableDefinitions(
        pgClient, schema, settings.defaultSchema, tableName,
    )
    )
    if (definitions.length !== 0) {
        return {
            contents: {
                language: "postgres",
                value: makeTableDefinitionText(definitions[0]),
            },
        }
    }
    else {
        return undefined
    }
}

async function getFunctionHover(
    space: Space,
    schema: string | undefined,
    functionName: string,
    settings: LanguageServerSettings,
): Promise<Hover | undefined> {
    const pgClient = await space.getPgClient(settings)
    if (pgClient === undefined) {
        return undefined
    }

    const definitions = await getFunctionDefinitions(
        pgClient, schema, settings.defaultSchema, functionName,
    )

    if (definitions.length === 0) {
        return undefined
    }

    return {
        contents: {
            language: "postgres",
            value: definitions.map(
                definition => makeFunctionDefinitionText(definition),
            ).join("\n\n"),
        },
    }
}

async function getTypeHover(
    space: Space,
    schema: string | undefined,
    typeName: string,
    settings: LanguageServerSettings,
): Promise<Hover | undefined> {
    const pgClient = await space.getPgClient(settings)
    if (pgClient === undefined) {
        return undefined
    }

    const definitions = await getTypeDefinitions(
        pgClient, schema, settings.defaultSchema, typeName,
    )

    if (definitions.length === 0) {
        return undefined

    }

    return {
        contents: {
            language: "postgres",
            value: makeTypeDefinitionText(definitions[0])
            ,
        },
    }
}
