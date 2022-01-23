import { DatabaseError } from "pg"
import { Diagnostic, DiagnosticSeverity, Position, Range } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { PgClient, Space } from "../space"

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

    const diagnostics = await validateSyntax(pgClient, space, textDocument)

    // Send the computed diagnostics to VSCode.
    space.connection.sendDiagnostics({ uri: textDocument.uri, diagnostics })
}

async function validateSyntax(
    pgClient: PgClient,
    space: Space,
    textDocument: TextDocument,
) {
    const diagnostics: Diagnostic[] = []
    const fileText = textDocument.getText()

    try {
        await pgClient.query("BEGIN")
        await pgClient.query(fileText)
    }
    catch (error: unknown) {
        let errorRange: Range | undefined = undefined
        if (error instanceof DatabaseError && error.position !== undefined) {
            const errorPosition = Number(error.position)
            const errorLines = fileText.slice(0, errorPosition).split("\n")
            errorRange = Range.create(
                Position.create(errorLines.length - 1, 0),
                Position.create(
                    errorLines.length - 1,
                    errorLines[errorLines.length - 1].length,
                ),
            )
        }
        else {
            errorRange = Range.create(
                textDocument.positionAt(0),
                textDocument.positionAt(fileText.length - 1),
            )
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
                    message: "Syntax errors",
                },
            ]
        }
        diagnostics.push(diagnosic)
    }
    finally {
        await pgClient.query("ROLLBACK")
        pgClient.release()
    }

    return diagnostics
}
