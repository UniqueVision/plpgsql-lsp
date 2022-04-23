import { existsSync, readFileSync } from "fs"
import { Position, Range, uinteger, URI } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

export function getWordRangeAtPosition(
  document: TextDocument, position: Position,
): Range | undefined {
  const lines = document.getText().split("\n")
  const line = Math.max(0, Math.min(lines.length - 1, position.line))
  const lineText = lines[line]
  const character = Math.max(0, Math.min(lineText.length - 1, position.character))
  const separator = /[\s,()':=;]/

  let startChar = character
  while (startChar > 0 && !separator.test(lineText.charAt(startChar - 1))) {
    --startChar
  }

  let endChar = character
  while (
    endChar < lineText.length && !separator.test(lineText.charAt(endChar))
  ) {
    ++endChar
  }

  if (startChar === endChar)
    return undefined
  else
    return Range.create(line, startChar, line, endChar)
}

export function findIndexFromBuffer(
  fileText: string, searchWord: string, byteOffset?: uinteger,
): number {
  return Buffer.from(fileText).indexOf(
    searchWord, byteOffset,
  )
}

export function getPositionFromBuffer(fileText: string, index: uinteger): Position {
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
): Range {
  return Range.create(
    getPositionFromBuffer(fileText, startIndex),
    getPositionFromBuffer(fileText, endIndex),
  )
}

export function getLineRangeFromBuffer(
  fileText: string, index: uinteger, offsetLine: uinteger = 0,
): Range | undefined {
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

export function getTextAllRange(document: TextDocument): Range {
  return Range.create(
    document.positionAt(0),
    document.positionAt(document.getText().length - 1),
  )
}

export function getNonSpaceCharacter(lineText: string): number {
  for (let index = 0; index < lineText.length; index++) {
    if (lineText[index] !== " ") {
      return index
    }
  }

  return lineText.length
}

export function makePostgresCodeMarkdown(code: string): string {
  return `\`\`\`postgres\n${code}\n\`\`\``
}

export function getFirstLine(document: TextDocument): string {
  return document.getText(Range.create(0, 0, 1, 0)).split("\n")[0]
}

export function getTextAfterFirstLine(document: TextDocument): string {
  return document.getText(
    Range.create(
      Position.create(1, 0),
      document.positionAt(document.getText().length - 1),
    ),
  )
}


export function isFirstCommentLine(
  document: TextDocument,
  position: Position,
): boolean {
  const line = position.line

  if (line !== 0) {
    return false
  }

  const firstLine = getFirstLine(document)

  return (
    firstLine.match(/^ *-- +.*$/) !== null
    || firstLine.match(/^ *\/\* +.*$/) !== null
  )
}

export function readFileFromUri(uri: URI): string | null {
  const filePath = uri.replace(/^file:\/\//, "")
  if (existsSync(filePath)) {
    return readFileSync(filePath).toString()
  }
  else {
    return null
  }
}

export function readTextDocumentFromUri(uri: URI): TextDocument {
  return TextDocument.create(
    uri, "postgres", 1, readFileFromUri(uri) || "",
  )
}
