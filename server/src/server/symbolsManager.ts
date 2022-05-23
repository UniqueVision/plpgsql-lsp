import { SymbolInformation, URI } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { parseDocumentSymbols } from "@/services/symbol"

export type Definition = string;
export type DefinitionCandidate = {
  definition: Definition,
  definitionLink: SymbolInformation
};

export class SymbolsManager {
  private fileSymbols: Map<URI, SymbolInformation[]> = new Map()

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
}
