import { sync as glob } from "glob"
import { parseQuery } from "libpg-query"
import {
  DefinitionLink, DefinitionParams, Logger, URI, WorkspaceFolder,
} from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import {
  getDefinitions,
} from "@/postgres/parsers/getDefinitions"
import { Statement } from "@/postgres/parsers/statement"
import { DefinitionMap } from "@/server/definitionMap"
import { sanitizeWordCandidates } from "@/utilities/sanitization"
import { getWordRangeAtPosition, readFileFromUri } from "@/utilities/text"


export async function getDefinitionLinks(
  definitionMap: DefinitionMap,
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
    const definitionLinks = definitionMap
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
  definitionMap: DefinitionMap,
  workspaceFolder: WorkspaceFolder,
  defaultSchema: string,
  logger: Logger,
) {
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
          definitionMap, resource, defaultSchema,
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
  definitionMap: DefinitionMap,
  uri: URI,
  defaultSchema: string,
) {
  const fileText = readFileFromUri(uri)
  const query = await parseQuery(fileText)

  const statements: Statement[] | undefined = query?.["stmts"]

  if (statements === undefined) {
    return
  }
  const candidates = getDefinitions(fileText, statements, uri, defaultSchema)

  definitionMap.updateCandidates(uri, candidates)

  return candidates
}
