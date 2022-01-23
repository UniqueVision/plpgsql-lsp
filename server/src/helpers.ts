import { Position, Range, uinteger } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

export const PLPGSQL_LANGUAGE_SERVER_SECTION = "plpgsqlLanguageServer"

export function getWordRangeAtPosition(
    document: TextDocument, position: Position,
): Range | undefined {
    const lines = document.getText().split("\n")
    const line = Math.min(lines.length - 1, Math.max(0, position.line))
    const lineText = lines[line]
    const character = Math.min(
        lineText.length - 1, Math.max(0, position.character),
    )
    const separator = /[\s,()':=;]/
    let startChar = character
    while (startChar > 0 && !separator.test(lineText.charAt(startChar - 1)))
        --startChar
    let endChar = character
    while (endChar < lineText.length && !separator.test(lineText.charAt(endChar)))
        ++endChar
    if (startChar === endChar)
        return undefined
    else
        return Range.create(line, startChar, line, endChar)
}

export function findIndexFromBuffer(
    fileText: string, searchWord: string, byteOffset?: uinteger,
) {
    return Buffer.from(fileText).indexOf(
        searchWord, byteOffset,
    )
}

export function getPositionFromBuffer(fileText: string, index: uinteger) {
    const textLines = Buffer.from(fileText)
        .slice(0, index)
        .toString()
        .split("\n")

    return Position.create(
        textLines.length - 1,
        textLines[textLines.length - 1].length,
    )
}

export function getRangeFromBuffer(
    fileText: string, startIndex: uinteger, endIndex: uinteger,
) {
    return Range.create(
        getPositionFromBuffer(fileText, startIndex),
        getPositionFromBuffer(fileText, endIndex),
    )
}

export function getLineRangeFromBuffer(
    fileText: string, index: uinteger, offsetLine: uinteger = 0,
) {
    const textLines = Buffer.from(fileText)
        .slice(0, index)
        .toString()
        .split("\n")

    let line: uinteger | undefined = undefined
    let startCharacter: uinteger | undefined = undefined
    let endCharacter: uinteger | undefined = undefined
    if (offsetLine !== 0) {
        const allTextLines = Buffer.from(fileText)
            .toString()
            .split("\n")
        line = textLines.length - 1 + offsetLine
        startCharacter = getNonSpaceCharacter(allTextLines[line])
        endCharacter = Math.max(startCharacter, allTextLines[line]?.length)
    }
    else {
        line = textLines.length - 1
        startCharacter = getNonSpaceCharacter(textLines[line])
        endCharacter = Math.max(startCharacter, textLines[line]?.length)
    }

    if (
        startCharacter !== undefined
        && endCharacter !== undefined
        && !isNaN(endCharacter)
    ) {
        return Range.create(
            Position.create(line, startCharacter),
            Position.create(line, endCharacter),
        )

    }
    else {
        return undefined
    }
}

export function getTextAllRange(textDocument: TextDocument) {
    return Range.create(
        textDocument.positionAt(0),
        textDocument.positionAt(textDocument.getText().length - 1),
    )
}

export function getNonSpaceCharacter(lineText: string) {
    for (let index = 0; index < lineText.length; index++) {
        if (lineText[index] !== " ") {
            return index
        }
    }

    return lineText.length
}
