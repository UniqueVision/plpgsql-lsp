import {
  SymbolInformation,
} from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { parseDocumentSymbols } from "@/postgres/parsers/parseSymbols"
import { Settings } from "@/settings"

export async function getDocumentSymbols(
  document: TextDocument, settings: Settings,
): Promise<SymbolInformation[] | undefined> {
  return parseDocumentSymbols(
    document.getText(), document.uri, settings.defaultSchema,
  )
}
