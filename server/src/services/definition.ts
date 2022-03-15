import {
  DefinitionLink,
  DefinitionParams,
  Logger,
} from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { DefinitionsManager } from "@/server/definitionsManager"
import { sanitizeWordCandidates } from "@/utilities/sanitizeWord"
import { getWordRangeAtPosition } from "@/utilities/text"


export async function getDefinitionLinks(
  definitionsManager: DefinitionsManager,
  params: DefinitionParams,
  textDocument: TextDocument,
  logger: Logger,
): Promise<DefinitionLink[] | undefined> {
  const wordRange = getWordRangeAtPosition(textDocument, params.position)
  if (wordRange === undefined) {
    return undefined
  }

  const word = textDocument.getText(wordRange)
  const sanitizedWordCandidates = sanitizeWordCandidates(word)

  for (const [index, wordCandidate] of sanitizedWordCandidates.entries()) {
    const definitionLinks = definitionsManager
      .getDefinitionLinks(wordCandidate)

    if (definitionLinks !== undefined) {
      logger.log(
        "Sanitized jump target word: "
        + [word]
          .concat(sanitizedWordCandidates.slice(0, index))
          .map((word) => JSON.stringify(word))
          .join(" => "),
      )

      return definitionLinks
    }
  }
}
