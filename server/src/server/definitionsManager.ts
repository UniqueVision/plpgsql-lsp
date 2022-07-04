import {
  DefinitionLink, LocationLink, Logger, URI, WorkspaceFolder,
} from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { parseCreateStatements } from "@/postgres/parsers/parseCreateStatements"
import { parseStmtements } from "@/postgres/parsers/statement"
import { Settings } from "@/settings"
import { disableLanguageServer } from "@/utilities/disableLanguageServer"
import {
  loadDefinitionFiles, makeDefinitionLinkMarkdown, readTextDocumentFromUri,
} from "@/utilities/text"

export type DefinitionName = string;
export type Definition = {
  name: DefinitionName,
  link: DefinitionLink
};

export class DefinitionsManager {
  private definitions: Map<DefinitionName, DefinitionLink[]> = new Map()
  private fileDefinitions: Map<URI, DefinitionName[]> = new Map()

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
      document, settings.defaultSchema, logger,
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
    logger.log(`The "${workspaceFolder.name}" workspace definitions are loading... 🚀`)

    for (const file of await loadDefinitionFiles(workspaceFolder, settings)) {
      const document = await readTextDocumentFromUri(`${workspaceFolder.uri}/${file}`)

      if (disableLanguageServer(document)) {
        continue
      }

      await this.innerUpdateDocumentDefinitions(
        document, settings.defaultSchema, logger,
      )
    }

    logger.log("The definitions have been loaded!! 👍")
  }

  private async innerUpdateDocumentDefinitions(
    document: TextDocument,
    defaultSchema: string,
    logger: Logger,
  ): Promise<Definition[] | undefined> {
    const fileText = document.getText()

    const definitions = await parseDefinitions(
      document.uri, fileText, defaultSchema, logger,
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
      const links = this.definitions.get(name) ?? []
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

async function parseDefinitions(
  uri: URI,
  fileText: string,
  defaultSchema: string,
  logger: Logger,
): Promise<Definition[] | undefined> {
  const statements = await parseStmtements(uri, fileText, logger)
  if (statements === undefined) {
    return undefined
  }

  return parseCreateStatements(uri, fileText, statements, logger).flatMap(
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
      name: (schema ?? defaultSchema) + "." + name,
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
