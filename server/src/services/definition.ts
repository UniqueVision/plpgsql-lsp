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
import {
  Definition, DefinitionName, DefinitionsManager,
} from "@/server/definitionsManager"
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
): Promise<Definition[] | undefined> {
  const statements = await parseStmtements(fileText)
  if (statements === undefined) {
    return undefined
  }


  return parseCreateStatements(fileText, statements).flatMap(
    (statementInfo) => {
      return makeMultiSchemaDefinitions(
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

function makeMultiSchemaDefinitions(
  name: DefinitionName,
  link: DefinitionLink,
  schema: string | undefined,
  defaultSchema: string,
): Definition[] {
  const definitions = [
    {
      name: (schema || defaultSchema) + "." + name,
      link,
    },
  ]

  // On the default schema, add definition without schema.
  if (schema === undefined || schema === defaultSchema) {
    definitions.push({
      name,
      link,
    })
  }

  return definitions
}
