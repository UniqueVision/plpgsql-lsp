import { DatabaseError } from "pg"
import {
    Diagnostic, DiagnosticSeverity, Position, Range, uinteger,
} from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import {
    getLineRangeFromBuffer, getNonSpaceCharacter, getTextAllRange,
} from "../helpers"
import { Space } from "../space"
import { getFunctionList } from "../workspace/getFunctionList"
import { PostgresClient } from "./client"

export async function validateTextDocument(
    space: Space,
    textDocument: TextDocument,
): Promise<void> {
    const pgClient = await space.getPgClient(
        await space.getDocumentSettings(textDocument.uri),
    )

    if (pgClient === undefined) {
        return
    }

    let diagnostics: Diagnostic[] = []
    const fileText = textDocument.getText()

    try {
        await pgClient.query("BEGIN")
        // check syntax
        await checkSyntax(pgClient, fileText)

        diagnostics = await checkStaticAnalysis(pgClient, textDocument, space)
    }
    catch (error: unknown) {
        let errorRange: Range | undefined = undefined
        if (error instanceof DatabaseError && error.position !== undefined) {
            const errorPosition = Number(error.position)
            const errorLines = fileText.slice(0, errorPosition).split("\n")
            errorRange = Range.create(
                Position.create(
                    errorLines.length - 1,
                    getNonSpaceCharacter(errorLines[errorLines.length - 1]),
                ),
                Position.create(
                    errorLines.length - 1,
                    errorLines[errorLines.length - 1].length,
                ),
            )
        }
        else {
            errorRange = getTextAllRange(textDocument)
        }
        const diagnosic: Diagnostic = {
            severity: DiagnosticSeverity.Error,
            range: errorRange,
            message: `${error}`,
        }

        if (space.hasDiagnosticRelatedInformationCapability) {
            diagnosic.relatedInformation = [
                {
                    location: {
                        uri: textDocument.uri,
                        range: Object.assign({}, diagnosic.range),
                    },
                    message: "Syntax error",
                },
            ]
        }
        diagnostics = [diagnosic]
    }
    finally {
        await pgClient.query("ROLLBACK")
        pgClient.release()
    }

    // Send the computed diagnostics to VSCode.
    space.connection.sendDiagnostics({ uri: textDocument.uri, diagnostics })
}

async function checkSyntax(pgClient: PostgresClient, fileText: string) {
    await pgClient.query(fileText)
}

async function checkStaticAnalysis(
    pgClient: PostgresClient,
    textDocument: TextDocument,
    space: Space,
) {
    const diagnostics: Diagnostic[] = []
    const fileText = textDocument.getText()

    try {
        const extensionCheck = await pgClient.query(`
            SELECT
                extname
            FROM
                pg_extension
            WHERE
                extname = 'plpgsql_check'
        `)

        if (extensionCheck.rowCount === 0) {
            return []
        }

        const functionList = await getFunctionList(space, textDocument.uri)

        for (const { functionName, location } of functionList) {
            const result = await pgClient.query(`
                    SELECT
                        (pcf).functionid::regprocedure AS procedure,
                        (pcf).lineno AS lineno,
                        (pcf).statement AS statement,
                        (pcf).sqlstate AS sqlstate,
                        (pcf).message AS message,
                        (pcf).detail AS detail,
                        (pcf).hint AS hint,
                        (pcf).level AS level,
                        (pcf)."position" AS position,
                        (pcf).query AS query,
                        (pcf).context AS context
                    FROM
                        plpgsql_check_function_tb('${functionName}') AS pcf
                `,
            )
            const rows: StaticAnalysisItem[] = result.rows

            if (rows.length === 0) {
                continue
            }
            for (const row of rows) {
                let range: Range | undefined = undefined
                if (location === undefined) {
                    range = getTextAllRange(textDocument)
                }
                else {
                    range = getLineRangeFromBuffer(
                        fileText,
                        location,
                        row.lineno ? row.lineno - 1 : 0,
                    ) || getTextAllRange(textDocument)
                }

                const diagnosic: Diagnostic = {
                    severity: (
                        row.level === "warning"
                            ? DiagnosticSeverity.Warning
                            : DiagnosticSeverity.Error
                    ),
                    range,
                    message: row.message,
                }

                if (space.hasDiagnosticRelatedInformationCapability) {
                    diagnosic.relatedInformation = [
                        {
                            location: {
                                uri: textDocument.uri,
                                range: Object.assign({}, diagnosic.range),
                            },
                            message: `Static analysis ${row.level}`,
                        },
                    ]
                }
                diagnostics.push(diagnosic)
            }

        }
    }
    catch (error: unknown) {
        console.log(`StaticAnalysisError: ${JSON.stringify(error)}`)
        throw error
    }

    return diagnostics
}

interface StaticAnalysisItem {
    procedure: string
    lineno: uinteger
    statement: string
    sqlstate: string
    message: string
    detail: string
    hint: string
    level: string
    position: string
    query: string
    context: string
}
