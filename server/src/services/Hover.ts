import { Hover, HoverParams } from "vscode-languageserver"

import { getSchemaCandidate, getWordRangeAtPosition } from "../helpers"
import { getFunctionDefinitions } from "../postgres/queries/getFunctionDefinitions"
import { getTableDefinitions } from "../postgres/queries/getTableDefinitions"
import { getTypeDefinitions } from "../postgres/queries/getTypeDefinitions"
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
        const { schema, tableName, fields } = definitions[0]

        let fieldsString = ""
        if (fields.length > 0) {
            fieldsString = "\n  " + fields.map(({ columnName, dataType }) => {
                return `${columnName} ${dataType}`
            }).join(",\n  ") + "\n"
        }

        return {
            contents: {
                language: "postgres",
                value: `TABLE ${schema}.${tableName}(${fieldsString})`,
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

    const values = []
    for (const {
        schema, functionName, fnctionArgs, returnType, isSetOf,
    } of definitions) {
        let argsString = ""
        if (fnctionArgs.length > 0) {
            argsString = "\n  " + fnctionArgs.join(",\n  ") + "\n"
        }

        let returnString = returnType
        if (isSetOf) {
            returnString = `SETOF ${returnType}`
        }

        values.push(
            `FUNCTION ${schema}.${functionName}(${argsString}) RETURNS ${returnString}`,
        )
    }

    return {
        contents: {
            language: "postgres",
            value: values.join("\n\n"),
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

    if (definitions.length !== 0) {
        const { schema, typeName, fields } = definitions[0]

        let fieldsString = ""
        if (fields.length > 0) {
            fieldsString = "\n  " + fields.map(({ columnName, dataType }) => {
                return `${columnName} ${dataType}`
            }).join(",\n  ") + "\n"
        }

        return {
            contents: {
                language: "postgres",
                value: `TYPE ${schema}.${typeName}(${fieldsString})`
                ,
            },

        }
    }
    else {
        return undefined
    }
}
