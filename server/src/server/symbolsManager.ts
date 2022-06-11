import { Logger, SymbolInformation, URI, WorkspaceFolder } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { parseDocumentSymbols } from "@/services/symbol"
import { Settings } from "@/settings"
import { disableLanguageServer } from "@/utilities/disableLanguageServer"
import { loadWorkspaceFiles, readTextDocumentFromUri } from "@/utilities/text"

export class SymbolsManager {
  private fileSymbols: Map<URI, SymbolInformation[]> = new Map()

  getSymbols(): SymbolInformation[] | undefined {
    return Array.from(this.fileSymbols.values())
      .flat()
      .sort((a, b) => (a.name > b.name ? -1 : 1))
  }

  async updateDocumentSymbols(
    document: TextDocument,
    settings: Settings,
    logger: Logger,
  ): Promise<void> {
    logger.log("The file symbols are updating...")

    const symbols = await this.innerUpdateDocumentSymbols(
      document, settings.defaultSchema, logger,
    )

    if (symbols !== undefined) {
      const symbolNames = symbols.map(symbol => symbol.name)

      logger.log(
        `The file symbols have been updated!! 😎 ${JSON.stringify(symbolNames)}`,
      )
    }
  }

  async loadWorkspaceSymbols(
    workspaceFolder: WorkspaceFolder,
    settings: Settings,
    logger: Logger,
  ): Promise<void> {
    logger.log(`The "${workspaceFolder.name}" workspace symbols are loading...`)

    for (const file of await loadWorkspaceFiles(workspaceFolder, settings)) {
      const document = await readTextDocumentFromUri(`${workspaceFolder.uri}/${file}`)

      if (disableLanguageServer(document)) {
        continue
      }

      await this.innerUpdateDocumentSymbols(
        document, settings.defaultSchema, logger,
      )
    }

    logger.log("The symbols have been loaded!! 👍")
  }

  private async innerUpdateDocumentSymbols(
    document: TextDocument,
    defaultSchema: string,
    logger: Logger,
  ): Promise<SymbolInformation[] | undefined> {
    const symbols = await parseDocumentSymbols(
      document.uri, document.getText(), defaultSchema, logger,
    )
    this.fileSymbols.set(document.uri, symbols ?? [])

    return symbols
  }
}
