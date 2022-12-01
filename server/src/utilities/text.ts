import { existsSync, promises as fs } from "fs"
import glob from "glob-promise"
import { Position, Range, uinteger, URI, WorkspaceFolder } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { DefinitionName, DefinitionsManager } from "@/server/definitionsManager"
import { Settings } from "@/settings"

import { asyncFlatMap } from "./functool"

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

export function getCurrentLineFromIndex(fileText: string, index: number) {
  const rangeLines = fileText.slice(0, index).split("\n")
  const lineSize = rangeLines.length - 1

  return Range.create(
    lineSize,
    getNonSpaceCharacter(rangeLines[lineSize]),
    lineSize,
    rangeLines[lineSize].length,
  )
}

export function findIndexFromBuffer(
  fileText: string, searchWord: string, byteOffset?: uinteger,
): number {
  const index = Buffer.from(fileText).indexOf(
    searchWord, byteOffset,
  )
  if (index !== -1) {
    return index
  }
  else {
    return Buffer.from(fileText.toLowerCase()).indexOf(
      searchWord, byteOffset,
    )
  }
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
    .subarray(0, index)
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

export function makeListMarkdown(items: string[]): string {
  return items.map(item => `- ${item}`).join("\n")
}

export function makeDefinitionLinkMarkdown(
  target: string,
  definitionsManager: DefinitionsManager,
  definitionName?: DefinitionName,
): string | undefined {
  if (definitionName === undefined) {
    definitionName = target
  }
  const definitionLinks = definitionsManager.getDefinitionLinks(definitionName)
  if (definitionLinks && definitionLinks.length >= 1) {
    const link = [
      definitionLinks[0].targetUri,
      definitionLinks[0].targetSelectionRange.start.line + 1,
    ].join("#L")

    return `["${target}"](${link})`
  }
  else {
    return undefined
  }
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

export async function readFileFromUri(uri: URI): Promise<string | null> {
  const filePath = uri.replace(/^file:\/\//, "")
  if (existsSync(filePath)) {
    return (await fs.readFile(filePath)).toString()
  }
  else {
    return null
  }
}

export async function readTextDocumentFromUri(uri: URI): Promise<TextDocument> {
  return TextDocument.create(
    uri, "postgres", 1, await readFileFromUri(uri) ?? "",
  )
}

export async function loadDefinitionFiles(
  _workspaceFolder: WorkspaceFolder, settings: Settings,
) {
  return [
    ...new Set(
      await asyncFlatMap(
        settings.definitionFiles,
        (filePattern) => glob.promise(filePattern),
      ),
    ),
  ]
}

export async function loadWorkspaceValidationTargetFiles(
  _workspaceFolder: WorkspaceFolder, settings: Settings,
) {
  return [
    ...new Set(
      await asyncFlatMap(
        settings.workspaceValidationTargetFiles,
        (filePattern) => glob.promise(filePattern),
      ),
    ),
  ]
}
