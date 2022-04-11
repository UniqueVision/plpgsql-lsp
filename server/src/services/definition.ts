import {
  DefinitionLink,
  Logger,
  Position,
} from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { DefinitionsManager } from "@/server/definitionsManager"
import { sanitizeWordCandidates } from "@/utilities/sanitizeWord"
import { getWordRangeAtPosition } from "@/utilities/text"


export async function getDefinitionLinks(
  definitionsManager: DefinitionsManager,
  document: TextDocument,
  position: Position,
  _logger: Logger,
): Promise<DefinitionLink[] | undefined> {
  const wordRange = getWordRangeAtPosition(document, position)
  if (wordRange === undefined) {
    return undefined
  }

  const word = document.getText(wordRange)
  const sanitizedWordCandidates = sanitizeWordCandidates(word)

  for (const wordCandidate of sanitizedWordCandidates) {
    const definitionLinks = definitionsManager
      .getDefinitionLinks(wordCandidate)

    if (definitionLinks !== undefined) {
      return definitionLinks
    }
  }

  return undefined
}
