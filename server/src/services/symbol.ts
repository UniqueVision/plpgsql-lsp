import { Logger, SymbolInformation } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { parseDocumentSymbols, SymbolsManager } from "@/server/symbolsManager"
import { Settings } from "@/settings"

export async function getDocumentSymbols(
  document: TextDocument, settings: Settings, logger: Logger,
): Promise<SymbolInformation[] | undefined> {
  return parseDocumentSymbols(
    document.uri, document.getText(), settings.defaultSchema, logger,
  )
}

export async function getWorkspaceSymbols(
  symbolsManager: SymbolsManager, _logger: Logger,
): Promise<SymbolInformation[] | undefined> {
  return symbolsManager.getSymbols()
}
