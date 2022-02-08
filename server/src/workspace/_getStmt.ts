import { LocationLink } from "vscode-languageserver"

import { findIndexFromBuffer, getRangeFromBuffer } from "../helpers"
import { Statement } from "../postgres/statement"
import { DEFAULT_SCHEMA } from "../settings"
import { Resource } from "../space"
import { Candidate } from "../store/definitionMap"

export function getCreateStmts(
    fileText: string,
    stmt: Statement,
    resource: Resource,
    defaultSchema = DEFAULT_SCHEMA,
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

export function getViewStmts(
    fileText: string,
    stmt: Statement,
    resource: Resource,
    defaultSchema = DEFAULT_SCHEMA,
): Candidate[] {
    const createStmt = stmt?.stmt?.ViewStmt
    if (createStmt === undefined) {
        return []
    }

    const schemaname = createStmt.view.schemaname
    const relname = createStmt.view.relname
    const definitionLink = LocationLink.create(
        resource,
        getRangeFromBuffer(
            fileText,
            stmt.stmt_location,
            stmt.stmt_location + stmt.stmt_len,
        ),
        getRangeFromBuffer(
            fileText,
            createStmt.view.location,
            createStmt.view.location
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

export function getCompositeTypeStmts(
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

export function getCreateFunctionStmts(
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
