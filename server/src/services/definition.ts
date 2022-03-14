import { sync as glob } from "glob"
import { parseQuery } from "libpg-query"
import {
  DefinitionLink,
  DefinitionParams,
  Logger,
  URI,
  WorkspaceFolder,
} from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import {
  getDefinitions,
} from "@/postgres/parsers/getDefinitions"
import { Statement } from "@/postgres/parsers/statement"
import { DefinitionCandidate, DefinitionsManager } from "@/server/definitionsManager"
import { sanitizeWordCandidates } from "@/utilities/sanitizeWord"
import { getWordRangeAtPosition, readFileFromUri } from "@/utilities/text"


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

export async function loadDefinitionFilesInWorkspace(
  definitionFiles: string[],
  definitionsManager: DefinitionsManager,
  workspaceFolder: WorkspaceFolder,
  defaultSchema: string,
  logger: Logger,
): Promise<void> {
  if (definitionFiles) {
    logger.info("Definition files loading...")

    const files = [
      ...new Set(
        definitionFiles.flatMap((filePattern) => glob(filePattern)),
      ),
    ]

    for (const file of files) {
      const resource = `${workspaceFolder.uri}/${file}`
      try {
        await updateFileDefinition(
          definitionsManager, resource, defaultSchema,
        )
      }
      catch (error: unknown) {
        logger.error(
          `${resource} cannot load the definitions. ${(error as Error).toString()}`,
        )
      }
    }

    logger.info("Definition files loaded!! 👍")
  }
}

export async function updateFileDefinition(
  definitionsManager: DefinitionsManager,
  uri: URI,
  defaultSchema: string,
): Promise<DefinitionCandidate[] | undefined> {
  const fileText = readFileFromUri(uri)
  const query = await parseQuery(fileText)

  const statements: Statement[] | undefined = query?.["stmts"]

  if (statements === undefined) {
    return undefined
  }
  const candidates = getDefinitions(fileText, statements, uri, defaultSchema)

  definitionsManager.updateCandidates(uri, candidates)

  return candidates
}
