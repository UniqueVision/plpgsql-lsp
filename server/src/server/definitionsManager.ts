import { DefinitionLink, Logger, URI, WorkspaceFolder } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { parseDefinitions } from "@/services/definition"
import { Settings } from "@/settings"
import { disableLanguageServer } from "@/utilities/disableLanguageServer"
import {
  loadWorkspaceFiles, makeDefinitionLinkMarkdown, readTextDocumentFromUri,
} from "@/utilities/text"

export type DefinitionName = string;
export type Definition = {
  name: DefinitionName,
  link: DefinitionLink
};

export class DefinitionsManager {
  private definitions: Map<DefinitionName, DefinitionLink[]> = new Map()
  private fileDefinitions: Map<URI, DefinitionName[]> = new Map()

  hasFileDefinitions(uri: URI): boolean {
    return this.fileDefinitions.has(uri)
  }

  getDefinitionLinks(name: DefinitionName): DefinitionLink[] | undefined {
    return this.definitions.get(name)
  }

  async updateDocumentDefinitions(
    document: TextDocument,
    settings: Settings,
    logger: Logger,
  ): Promise<void> {
    logger.log("The file definitions are updating...")

    const definitions = await this.innerUpdateDocumentDefinitions(
      document, settings.defaultSchema,
    )

    if (definitions !== undefined) {
      const names = definitions.map(definition => definition.name)

      logger.log(
        `The file definitions have been updated!! 😎 ${JSON.stringify(names)}`,
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
        await this.innerUpdateDocumentDefinitions(document, settings.defaultSchema)
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

  private async innerUpdateDocumentDefinitions(
    document: TextDocument,
    defaultSchema: string,
  ): Promise<Definition[] | undefined> {
    const fileText = document.getText()


    const definitions = await parseDefinitions(
      fileText, document.uri, defaultSchema,
    )
    if (definitions === undefined) {
      return undefined
    }

    this.updateDefinitions(document.uri, definitions)

    return definitions
  }

  private updateDefinitions(
    uri: URI, definitions: Definition[] | undefined,
  ): void {
    const oldDefinitions = this.fileDefinitions.get(uri)

    // Remove old definition of a target uri.
    if (oldDefinitions !== undefined) {
      for (const definition of oldDefinitions) {
        const oldDefinitionLinks = this.definitions.get(definition)
        if (oldDefinitionLinks === undefined) {
          continue
        }

        this.definitions.set(
          definition,
          oldDefinitionLinks.filter(
            (definition) => definition.targetUri !== uri,
          ),
        )
      }
      this.fileDefinitions.delete(uri)
    }

    if (definitions === undefined || definitions.length === 0) {
      return
    }

    // Update new definition of a target uri.
    for (const { name, link } of definitions) {
      const links = this.definitions.get(name) || []
      links.push(link)
      this.definitions.set(name, links)
    }

    this.fileDefinitions.set(
      uri,
      definitions.map((definition) => definition.name),
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
