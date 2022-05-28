import { DefinitionLink, Logger, URI, WorkspaceFolder } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { parseDefinitions } from "@/services/definition"
import { Settings } from "@/settings"
import { disableLanguageServer } from "@/utilities/disableLanguageServer"
import {
  loadWorkspaceFiles, makeDefinitionLinkMarkdown, readTextDocumentFromUri,
} from "@/utilities/text"

export type Definition = string;
export type DefinitionCandidate = {
  definition: Definition,
  definitionLink: DefinitionLink
};

export class DefinitionsManager {
  private candidates: Map<Definition, DefinitionLink[]> = new Map()
  private fileDefinitions: Map<URI, Definition[]> = new Map()

  hasFileDefinitions(uri: URI): boolean {
    return this.fileDefinitions.has(uri)
  }

  getDefinitionLinks(definition: Definition): DefinitionLink[] | undefined {
    return this.candidates.get(definition)
  }

  async updateFileDefinitions(
    document: TextDocument,
    settings: Settings,
    logger: Logger,
  ): Promise<void> {
    logger.log("The file definitions are updating...")

    const candidates = await this.updateDocumentDefinitions(
      document, settings.defaultSchema,
    )

    if (candidates !== undefined) {
      const definitions = candidates.map(candidate => candidate.definition)

      logger.log(
        `The file definitions have been updated!! 😎 ${JSON.stringify(definitions)}`,
      )
    }
  }

  async loadWorkspaceDefinitions(
    workspaceFolder: WorkspaceFolder,
    settings: Settings,
    logger: Logger,
  ): Promise<void> {
    logger.log(`The "${workspaceFolder.name}" workspace definitions are loading...`)

    for (const file of await loadWorkspaceFiles(workspaceFolder, settings)) {
      const document = await readTextDocumentFromUri(`${workspaceFolder.uri}/${file}`)

      if (disableLanguageServer(document)) {
        continue
      }

      try {
        await this.updateDocumentDefinitions(document, settings.defaultSchema)
      }
      catch (error: unknown) {
        const errorMessage = (error as Error).message

        logger.error(
          `The definitions of "${document.uri}" cannot load. ${errorMessage}`,
        )
      }
    }

    logger.log("The definitions have been loaded!! 👍")
  }

  private async updateDocumentDefinitions(
    document: TextDocument,
    defaultSchema: string,
  ): Promise<DefinitionCandidate[] | undefined> {
    const fileText = document.getText()


    const definitions = await parseDefinitions(
      fileText, document.uri, defaultSchema,
    )
    if (definitions === undefined) {
      return undefined
    }

    this.updateCandidates(document.uri, definitions)

    return definitions
  }

  private updateCandidates(
    uri: URI, candidates: DefinitionCandidate[] | undefined,
  ): void {
    const oldDefinitions = this.fileDefinitions.get(uri)

    // Remove old definition of a target uri.
    if (oldDefinitions !== undefined) {
      for (const candidate of oldDefinitions) {
        const oldDefinitionLinks = this.candidates.get(candidate)
        if (oldDefinitionLinks === undefined) {
          continue
        }

        this.candidates.set(
          candidate,
          oldDefinitionLinks.filter(
            (definition) => definition.targetUri !== uri,
          ),
        )
      }
      this.fileDefinitions.delete(uri)
    }

    if (candidates === undefined || candidates.length === 0) {
      return
    }

    // Update new definition of a target uri.
    for (const { definition, definitionLink } of candidates) {
      const definitionLinks = this.candidates.get(definition) || []
      definitionLinks.push(definitionLink)
      this.candidates.set(definition, definitionLinks)
    }

    this.fileDefinitions.set(
      uri,
      candidates.map((candidate) => candidate.definition),
    )
  }
}

export function makeTargetRelatedTableLink(
  targetName: string,
  tableSchemaName: string,
  tableName: string,
  definitionsManager: DefinitionsManager,
): string {
  let targetLink = makeDefinitionLinkMarkdown(targetName, definitionsManager)
  if (targetLink === undefined) {
    targetLink = makeDefinitionLinkMarkdown(
      targetName, definitionsManager, `${tableSchemaName}.${tableName}`,
    )
    if (targetLink === undefined) {
      targetLink = `\`"${targetName}"\``
    }
  }

  return targetLink
}
