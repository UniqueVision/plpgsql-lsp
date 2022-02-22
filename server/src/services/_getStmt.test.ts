import { readFileSync } from "fs"
import { parseQuery } from "libpg-query"
import path from "path"
import { Position, Range, uinteger } from "vscode-languageserver"

import {
    getCompositeTypeStmts, getCreateFunctionStmts, getCreateStmts, getViewStmts,
} from "./_getStmt"

test.each(
    [
        ["create_table.sql", Array(2).fill(range(0, 13, 0, 18))],
        [
            "create_table_with_default_schema.sql",
            Array(2).fill(range(0, 13, 0, 25)),
        ],
        ["create_table_with_schema.sql", [range(0, 13, 0, 26)]],
    ],
)(
    'getCreateStmts <- "%s"', async (file, expected) => {
        const fileText = getFileText(file)
        const stmts = getCreateStmts(
            fileText, await getStmt(fileText), `file://${file}`, "public",
        )

        expect(stmts.length).toBe(expected.length)
        for (let i = 0; i < stmts.length; i++) {
            expect(stmts[i].definitionLink.targetSelectionRange)
                .toStrictEqual(expected[i])
        }
    },
)

test.each(
    [
        ["create_view.sql", Array(2).fill(range(0, 12, 0, 25))],
        [
            "create_view_with_default_schema.sql",
            Array(2).fill(range(0, 12, 0, 32)),
        ],
        ["create_view_with_schema.sql", [range(0, 12, 0, 33)]],
    ],
)(
    'getViewStmts <- "%s"', async (file, expected) => {
        const fileText = getFileText(file)
        const stmts = getViewStmts(
            fileText, await getStmt(fileText), `file://${file}`, "public",
        )

        expect(stmts.length).toBe(expected.length)
        for (let i = 0; i < stmts.length; i++) {
            expect(stmts[i].definitionLink.targetSelectionRange)
                .toStrictEqual(expected[i])
        }
    },
)

test.each(
    [["create_type.sql", Array(2).fill(range(0, 12, 0, 21))]],
)(
    'getCompositeTypeStmts <- "%s"', async (file, expected) => {
        const fileText = getFileText(file)
        const stmts = getCompositeTypeStmts(
            fileText, await getStmt(fileText), `file://${file}`, "public",
        )

        expect(stmts.length).toBe(expected.length)
        for (let i = 0; i < stmts.length; i++) {
            expect(stmts[i].definitionLink.targetSelectionRange)
                .toStrictEqual(expected[i])
        }
    },
)

test.each(
    [
        ["create_procedure.plpgsql.sql", range(0, 17, 0, 22)],
        ["create_function.plpgsql.sql", range(0, 27, 0, 36)],
        ["create_function.sql.sql", range(0, 16, 0, 19)],
    ],
)(
    'getCreateFunctionStmts <- "%s"', async (file, expected) => {
        const fileText = getFileText(file)
        const stmts = getCreateFunctionStmts(
            fileText, await getStmt(fileText), `file://${file}`, "public",
        )

        expect(stmts.length).toBe(1)
        expect(stmts[0].definitionLink.targetSelectionRange)
            .toStrictEqual(expected)
    },
)

function range(
    startLine: uinteger,
    startChar: uinteger,
    endLine: uinteger,
    endChar: uinteger,
) {
    return Range.create(
        Position.create(startLine, startChar),
        Position.create(endLine, endChar),
    )
}

function getFileText(file: string) {
    return readFileSync(
        path.join(__dirname, "__fixtures__", file),
    ).toString()
}

async function getStmt(fileText: string) {
    return (await parseQuery(fileText))["stmts"][0]
}
