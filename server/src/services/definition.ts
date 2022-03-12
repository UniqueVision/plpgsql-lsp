import { readFileSync } from "fs"
import { sync as glob } from "glob"
import { parseQuery } from "libpg-query"
import {
  DefinitionLink, DefinitionParams, Logger, URI, WorkspaceFolder,
} from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import {
  getFunctionDefinitions,
  getTableDefinitions,
  getTypeDefinitions,
  getViewDefinitions,
} from "@/postgres/parsers/getDefinitions"
import { Statement } from "@/postgres/parsers/statement"
import { DefinitionMap } from "@/server/definitionMap"
import { sanitizeWordCandidates } from "@/utilities/sanitization"
import { getWordRangeAtPosition } from "@/utilities/text"


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
  resource: URI,
  defaultSchema: string,
) {
  const fileText = readFileSync(resource.replace(/^file:\/\//, "")).toString()
  const query = await parseQuery(fileText)

  const stmts: Statement[] | undefined = query?.["stmts"]

  if (stmts === undefined) {
    return
  }
  const candidates = stmts.flatMap(
    (stmt) => {
      if (stmt?.stmt?.CreateStmt !== undefined) {
        return getTableDefinitions(fileText, stmt, resource, defaultSchema)
      }
      else if (stmt?.stmt?.ViewStmt !== undefined) {
        return getViewDefinitions(fileText, stmt, resource, defaultSchema)
      }
      else if (stmt?.stmt?.CompositeTypeStmt !== undefined) {
        return getTypeDefinitions(fileText, stmt, resource, defaultSchema)
      }
      else if (stmt?.stmt?.CreateFunctionStmt !== undefined) {
        return getFunctionDefinitions(fileText, stmt, resource, defaultSchema)
      }
      else {
        return []
      }
    },
  )

  definitionMap.updateCandidates(resource, candidates)

  return candidates
}
