import { readFileSync } from "fs"
import { sync as glob } from "glob"
import { parseQuery } from "libpg-query"
import { DefinitionLink, DefinitionParams } from "vscode-languageserver"

import { getDefaultSchema, getWordRangeAtPosition } from "../helpers"
import { Statement } from "../postgres/statement"
import { console } from "../server"
import { Resource, Space } from "../space"
import {
    getCompositeTypeStmts, getCreateFunctionStmts, getCreateStmts, getViewStmts,
} from "./_getStmt"
import {
    sanitizeDynamicPartitionTable,
    sanitizeNumberPartitionTable,
    sanitizeQuotedTable,
    sanitizeUuidPartitionTable,
} from "./_sanitizeWord"

export function getDefinitionLinks(
    space: Space,
    params: DefinitionParams,
): DefinitionLink[] | undefined {
    const uri = params.textDocument.uri
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

    for (const { index, wordCandidate } of
        sanitizedWordCandidates.map(
            (wordCandidate, index) => { return { index, wordCandidate } },
        )
    ) {
        const definitionLinks = space
            .definitionMap
            .getDefinitionLinks(wordCandidate)

        if (definitionLinks !== undefined) {
            console.log(
                "Sanitized jump target word: "
                + [word]
                    .concat(sanitizedWordCandidates.slice(0, index))
                    .map(word => { return JSON.stringify(word) })
                    .join(" => "),
            )

            return definitionLinks
        }
    }

    return []
}

export async function loadDefinitionFilesInWorkspace(
    space: Space, resource: Resource,
) {
    const settings = await space.getDocumentSettings(resource)
    const workspace = await space.getWorkSpaceFolder(resource)
    if (workspace === undefined) {
        return
    }

    if (settings.definitionFiles) {
        console.log("Definition files loading...")

        const files = [
            ...new Set(settings.definitionFiles.flatMap(
                filePattern => { return glob(filePattern) },
            )),
        ]

        for (const file of files) {
            resource = `${workspace.uri}/${file}`
            try {
                await updateFileDefinition(
                    space, resource, settings.defaultSchema,
                )
            }
            catch (error: unknown) {
                console.error(
                    `${resource} cannot load the definitions. ${error}`,
                )
            }
        }

        console.log("Definition files loaded!! 👍")
    }
}

export async function updateFileDefinition(
    space: Space, resource: Resource, defaultSchema?: string,
) {
    const _defaultSchema = await getDefaultSchema(
        space, resource, defaultSchema,
    )

    const fileText = readFileSync(resource.replace(/^file:\/\//, "")).toString()
    const query = await parseQuery(fileText)

    const stmts: Statement[] | undefined = query?.["stmts"]
    if (stmts === undefined) {
        return
    }
    const candidates = stmts.flatMap(stmt => {
        if (stmt?.stmt?.CreateStmt !== undefined) {
            return getCreateStmts(fileText, stmt, resource, _defaultSchema)
        }
        else if (stmt?.stmt?.ViewStmt !== undefined) {
            return getViewStmts(fileText, stmt, resource, _defaultSchema)
        }
        else if (stmt?.stmt?.CompositeTypeStmt !== undefined) {
            return getCompositeTypeStmts(fileText, stmt, resource, _defaultSchema)
        }
        else if (stmt?.stmt?.CreateFunctionStmt !== undefined) {
            return getCreateFunctionStmts(fileText, stmt, resource)
        }
        else {
            return []
        }
    })

    space.definitionMap.updateCandidates(resource, candidates)

    return candidates
}
