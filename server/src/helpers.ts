import { Range } from "vscode-languageserver"
import {
    Position, TextDocument,
} from "vscode-languageserver-textdocument"

export const PLPGSQL_LANGUAGE_SERVER_SECTION = "plpgsqlLanguageServer"

export function getWordRangeAtPosition(document: TextDocument, position: Position): Range | undefined {
    const lines = document.getText().split("\n")
    const line = Math.min(lines.length - 1, Math.max(0, position.line))
    const lineText = lines[line]
    const character = Math.min(lineText.length - 1, Math.max(0, position.character))
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
