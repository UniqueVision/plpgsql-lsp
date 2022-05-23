import {
  DefinitionLink,
  LocationLink,
  Logger,
  Position,
  URI,
} from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { parseCreateStatements } from "@/postgres/parsers/parseCreateStatements"
import { parseStmtements } from "@/postgres/parsers/statement"
import { DefinitionCandidate, DefinitionsManager } from "@/server/definitionsManager"
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


export async function parseDefinitions(
  fileText: string,
  uri: URI,
  defaultSchema: string,
): Promise< DefinitionCandidate[] | undefined> {
  const statements = await parseStmtements(fileText)
  if (statements === undefined) {
    return undefined
  }


  return parseCreateStatements(fileText, statements).flatMap(
    (statementInfo) => {
      return makeMultiSchemaDefinitionCandidates(
        statementInfo.name,
        LocationLink.create(
          uri,
          statementInfo.targetRange,
          statementInfo.targetSelectionRange,
        ),
        statementInfo.schema,
        defaultSchema,
      )
    },
  )
}

function makeMultiSchemaDefinitionCandidates(
  definitionName: string,
  definitionLink: DefinitionLink,
  schema: string | undefined,
  defaultSchema: string,
): DefinitionCandidate[] {
  const candidates = [
    {
      definition: (schema || defaultSchema) + "." + definitionName,
      definitionLink,
    },
  ]

  // On the default schema, add candidate without schema.
  if (schema === undefined || schema === defaultSchema) {
    candidates.push({
      definition: definitionName,
      definitionLink,
    })
  }

  return candidates
}
