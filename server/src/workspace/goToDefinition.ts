import { readFileSync } from "fs"
import { sync as glob } from "glob"
import { parseQuery } from "libpg-query"
import {
    DefinitionLink, DefinitionParams, LocationLink,
} from "vscode-languageserver"

import {
    findIndexFromBuffer,
    getRangeFromBuffer,
    getWordRangeAtPosition,
} from "../helpers"
import { Statement } from "../postgres/statement"
import { console } from "../server"
import { Resource, Space } from "../space"
import { Candidate } from "../store/definitionMap"
import {
    sanitizeDynamicPartitionTable,
    sanitizeNumberPartitionTable,
    sanitizeQuotedTable,
    sanitizeUuidPartitionTable,
} from "./sanitizeWord"

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

    for (const { index, wordCandidate } of sanitizedWordCandidates.map(
        (wordCandidate, index) => { return { index, wordCandidate } },
    )
    ) {
        const definitionLinks = space
            .definitionMap
            .getDefinitionLinks(wordCandidate)

        if (definitionLinks !== undefined) {
            logSanitizedWord(word, sanitizedWordCandidates.slice(0, index))

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
        else if (stmt?.stmt?.CompositeTypeStmt !== undefined) {
            return getCompositeTypeStmts(fileText, stmt, resource)
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

function getCreateStmts(
    fileText: string,
    stmt: Statement,
    resource: Resource,
    defaultSchema: string,
): Candidate[] {
    const createStmt = stmt?.stmt?.CreateStmt
    if (createStmt === undefined) {
        return []
    }

    const schemaname = createStmt.relation.schemaname
    const relname = createStmt.relation.relname
    const definitionLink = LocationLink.create(
        resource,
        getRangeFromBuffer(
            fileText,
            stmt.stmt_location,
            stmt.stmt_location + stmt.stmt_len,
        ),
        getRangeFromBuffer(
            fileText,
            createStmt.relation.location,
            createStmt.relation.location
            + (schemaname !== undefined ? (schemaname + ".").length : 0)
            + relname.length,
        ),
    )
    const candidates = [
        {
            definition: (schemaname || defaultSchema) + "." + relname,
            definitionLink,
        },
    ]

    // When default schema, add raw relname candidate.
    if (schemaname === undefined || schemaname === defaultSchema) {
        candidates.push({
            definition: relname,
            definitionLink,
        })
    }

    return candidates
}

function getCompositeTypeStmts(
    fileText: string, stmt: Statement, resource: Resource,
): Candidate[] {
    const compositTypeStmt = stmt?.stmt?.CompositeTypeStmt
    if (compositTypeStmt === undefined) {
        return []
    }
    const definition = compositTypeStmt.typevar.relname

    return [
        {
            definition,
            definitionLink: LocationLink.create(
                resource,
                getRangeFromBuffer(
                    fileText,
                    stmt.stmt_location,
                    stmt.stmt_location + stmt.stmt_len,
                ),
                getRangeFromBuffer(
                    fileText,
                    compositTypeStmt.typevar.location,
                    compositTypeStmt.typevar.location + definition.length,
                ),
            ),
        },
    ]
}

function getCreateFunctionStmts(
    fileText: string, stmt: Statement, resource: Resource,
): Candidate[] {
    const createFunctionStmt = stmt?.stmt?.CreateFunctionStmt
    if (createFunctionStmt === undefined) {
        return []
    }

    return createFunctionStmt.funcname.flatMap(funcname => {
        const definition = funcname.String.str
        if (definition === undefined) {
            return []
        }
        const functionNameLocation = findIndexFromBuffer(
            fileText, definition, stmt.stmt_location,
        )

        return [
            {
                definition,
                definitionLink: LocationLink.create(
                    resource,
                    getRangeFromBuffer(
                        fileText,
                        stmt.stmt_location,
                        stmt.stmt_location + stmt.stmt_len,
                    ),
                    getRangeFromBuffer(
                        fileText,
                        functionNameLocation,
                        functionNameLocation + definition.length,
                    ),
                ),
            },
        ]
    })
}

async function getDefaultSchema(
    space: Space, resource: Resource, defaultSchema?: string,
) {
    if (defaultSchema === undefined) {
        const settings = await space.getDocumentSettings(resource)

        return settings.defaultSchema
    }
    else {
        return defaultSchema
    }
}

function logSanitizedWord(word: string, sanitizingWords: string[]) {
    console.log(
        "Sanitized jump target word: "
        + [word].concat(sanitizingWords).map(word => {
            return JSON.stringify(word)
        }).join(" => "),
    )
}
