import { sync as glob } from "glob"
import { Logger, SymbolInformation, URI, WorkspaceFolder } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { parseDocumentSymbols } from "@/postgres/parsers/parseSymbols"
import { Settings } from "@/settings"
import { disableLanguageServer } from "@/utilities/disableLanguageServer"
import { readTextDocumentFromUri } from "@/utilities/text"

export type Definition = string;
export type DefinitionCandidate = {
  definition: Definition,
  definitionLink: SymbolInformation
};

export class SymbolsManager {
  private workspaceFolderUris: Set<URI> = new Set()
  private fileSymbols: Map<URI, SymbolInformation[]> = new Map()

  hasWorkspaceFolder(workspaceFolder: WorkspaceFolder): boolean {
    return this.workspaceFolderUris.has(workspaceFolder.uri)
  }

  hasFileSymbols(uri: URI): boolean {
    return this.fileSymbols.has(uri)
  }

  getSymbols(): SymbolInformation[] | undefined {
    return Array.from(this.fileSymbols.values())
      .flat()
      .sort((a, b) => (a.name > b.name ? -1 : 1))
  }

  async updateFileSymbols(
    document: TextDocument,
    defaultSchema: string,
  ): Promise<SymbolInformation[] | undefined> {
    const symbols = await parseDocumentSymbols(
      document.getText(), document.uri, defaultSchema,
    )
    this.fileSymbols.set(document.uri, symbols || [])

    return symbols
  }

  async loadWorkspaceSymbols(
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
      const document = readTextDocumentFromUri(documentUri)

      if (disableLanguageServer(document)) {
        continue
      }

      try {
        await this.updateFileSymbols(
          document, settings.defaultSchema,
        )
      }
      catch (error: unknown) {
        logger.error(
          `The symbols of "${documentUri}" cannot load.`
          + ` ${(error as Error).message}`,
        )
      }
    }
  }
}
