import { Logger, SymbolInformation } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { parseDocumentSymbols } from "@/server/symbolsManager"
import { Settings } from "@/settings"

export async function getDocumentSymbols(
  document: TextDocument, settings: Settings, logger: Logger,
): Promise<SymbolInformation[] | undefined> {
  return parseDocumentSymbols(
    document.uri, document.getText(), settings.defaultSchema, logger,
  )
}
