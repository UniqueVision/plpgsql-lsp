import { readFileSync } from "fs"
import { sync as glob } from "glob"
import { parseQuery } from "libpg-query"
import {
    DefinitionLink, DefinitionParams, LocationLink,
} from "vscode-languageserver"

import { findIndex, getRange, getWordRangeAtPosition } from "../helpers"
import { Statement } from "../postgres/statement"
import { console } from "../server"
import { Resource, Space } from "../space"
import { Candidate } from "../store/definitionMap"


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

        const files = [...new Set(settings.definitionFiles.flatMap(
            filePattern => { return glob(filePattern) },
        ))]

        for (const file of files) {
            resource = `${workspace.uri}/${file}`
            try {
                await updateFileDefinition(space, resource, settings.defaultSchema)
            }
            catch (error: unknown) {
                console.error(`${resource} cannot load the definitions. ${error}`)
            }
        }

        console.log("Definition files loaded!! 👍")
    }
}

export async function updateFileDefinition(
    space: Space, resource: Resource, defaultSchema?: string,
) {
    const _defaultSchema = await getDefaultSchema(space, resource, defaultSchema)

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
    fileText: string, stmt: Statement, resource: Resource, defaultSchema: string,
): Candidate[] {
    const createStmt = stmt?.stmt?.CreateStmt
    if (createStmt === undefined) {
        return []
    }

    const schemaname = createStmt.relation.schemaname
    const relname = createStmt.relation.relname
    const definitionLink = LocationLink.create(
        resource,
        getRange(
            fileText,
            stmt.stmt_location,
            stmt.stmt_location + stmt.stmt_len,
        ),
        getRange(
            fileText,
            createStmt.relation.location,
            createStmt.relation.location
            + (schemaname !== undefined ? (schemaname + ".").length : 0)
            + relname.length,
        ),
    )
    const candidates = [{
        definition: (schemaname || defaultSchema) + "." + relname,
        definitionLink,
    }]

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

    return [{
        definition,
        definitionLink: LocationLink.create(
            resource,
            getRange(
                fileText,
                stmt.stmt_location,
                stmt.stmt_location + stmt.stmt_len,
            ),
            getRange(
                fileText,
                compositTypeStmt.typevar.location,
                compositTypeStmt.typevar.location + definition.length,
            ),
        ),
    }]
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
        const functionNameLocation = findIndex(
            fileText, definition, stmt.stmt_location,
        )

        return [{
            definition,
            definitionLink: LocationLink.create(
                resource,
                getRange(
                    fileText,
                    stmt.stmt_location,
                    stmt.stmt_location + stmt.stmt_len,
                ),
                getRange(
                    fileText,
                    functionNameLocation,
                    functionNameLocation + definition.length,
                ),
            ),
        }]
    })
}

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

    // General match.
    const sanitizedWord = word
        // for dynamic partition table
        //   ex)
        //     public."table_name_$$ || partition_key || $$"
        //             "table_name_$$ || partition_key || $$"
        .replace(/"([a-zA-Z_]\w*)_\$\$$/, "$1")
        // for quoted table
        //   ex)
        //     public."table_name"
        //            "table_name"
        .replace(/(^[a-zA-Z_]\w*\.)?"([a-zA-Z_]\w*)"$/, "$1$2")

    const definitionLinks = space.definitionMap.getDefinitionLinks(sanitizedWord)
    if (definitionLinks !== undefined) {
        logSanitizedWord([word, sanitizedWord])

        return definitionLinks
    }

    // Specific partition table match.
    const sanitizedWord2 = word
        // for number partition table
        //   ex)
        //     public.table_name_1234
        //            table_name_1234
        //     public."table_name_1234"
        //            "table_name_1234"
        .replace(/"?([a-zA-Z_]\w*)_[0-9]+"?$/, "$1")
        // for uuid partition table
        //   ex)
        //     public."table_name_12345678-1234-1234-1234-123456789012"
        //            "table_name_12345678-1234-1234-1234-123456789012"
        .replace(
            /"([a-zA-Z_]\w*)_[0-9]{8}-[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{12}"$/, "$1",
        )

    logSanitizedWord([word, sanitizedWord, sanitizedWord2])

    return space.definitionMap.getDefinitionLinks(sanitizedWord2)
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

function logSanitizedWord(sanitizingWords: string[]) {
    console.log(
        "Sanitized jump target word: "
        + sanitizingWords.map(word => {
            return JSON.stringify(word)
        }).join(" => "),
    )
}
