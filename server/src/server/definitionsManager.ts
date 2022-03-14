import { sync as glob } from "glob"
import { parseQuery } from "libpg-query"
import { DefinitionLink, Logger, URI, WorkspaceFolder } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { getDefinitions } from "@/postgres/parsers/getDefinitions"
import { Statement } from "@/postgres/parsers/statement"
import { Settings } from "@/settings"
import { disableLanguageServer } from "@/utilities/disableLanguageServer"
import { readFileFromUri } from "@/utilities/text"

export type Definition = string;
export type DefinitionCandidate = {
  definition: Definition,
  definitionLink: DefinitionLink
};

export class DefinitionsManager {
  private workspaceFolderUris: Set<URI> = new Set()
  private candidates: Map<Definition, DefinitionLink[]> = new Map()
  private fileDefinitions: Map<URI, Definition[]> = new Map()

  hasWorkspaceFolder(workspaceFolder: WorkspaceFolder): boolean {
    return this.workspaceFolderUris.has(workspaceFolder.uri)
  }

  hasFileDefinitions(uri: URI): boolean {
    return this.fileDefinitions.has(uri)
  }

  getDefinitionLinks(definition: Definition): DefinitionLink[] | undefined {
    return this.candidates.get(definition)
  }

  async updateFileDefinitions(
    textDocument: TextDocument,
    defaultSchema: string,
  ): Promise<DefinitionCandidate[] | undefined> {
    const fileText = textDocument.getText()

    const query = await parseQuery(fileText)

    const statements: Statement[] | undefined = query?.["stmts"]
    if (statements === undefined) {
      return undefined
    }

    const candidates = getDefinitions(
      fileText, statements, textDocument.uri, defaultSchema,
    )

    this.updateCandidates(textDocument.uri, candidates)

    return candidates
  }

  async loadWorkspaceDefinitions(
    workspaceFolder: WorkspaceFolder,
    settings: Settings,
    logger: Logger,
  ): Promise<void> {
    this.workspaceFolderUris.add(workspaceFolder.uri)

    const files = [
      ...new Set(
        settings.definitionFiles.flatMap((filePattern) => glob(filePattern)),
      ),
    ]

    for (const file of files) {
      const documentUri = `${workspaceFolder.uri}/${file}`
      const textDocument = TextDocument.create(
        documentUri, "postgres", 1, readFileFromUri(documentUri),
      )

      if (disableLanguageServer(textDocument)) {
        continue
      }

      try {
        await this.updateFileDefinitions(
          textDocument, settings.defaultSchema,
        )
      }
      catch (error: unknown) {
        logger.error(
          `The definitions of "${documentUri}" cannot load.`
          + ` ${(error as Error).toString()}`,
        )
      }
    }
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
