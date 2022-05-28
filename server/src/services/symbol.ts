import { SymbolInformation, SymbolKind, URI } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { PostgresKind } from "@/postgres/kind"
import { parseCreateStatements } from "@/postgres/parsers/parseCreateStatements"
import { parseStmtements } from "@/postgres/parsers/statement"
import { Settings } from "@/settings"
import { neverReach } from "@/utilities/neverReach"

export async function getDocumentSymbols(
  document: TextDocument, settings: Settings,
): Promise<SymbolInformation[] | undefined> {
  return parseDocumentSymbols(
    document.getText(), document.uri, settings.defaultSchema,
  )
}

function convertToSymbleKind(kind: PostgresKind): SymbolKind {
  switch (kind) {
    case PostgresKind.Schema:
      return SymbolKind.Module
    case PostgresKind.Table:
      return SymbolKind.Class
    case PostgresKind.View:
      return SymbolKind.Class
    case PostgresKind.MaterializedView:
      return SymbolKind.Class
    case PostgresKind.Type:
      return SymbolKind.Struct
    case PostgresKind.Domain:
      return SymbolKind.Struct
    case PostgresKind.Index:
      return SymbolKind.Struct
    case PostgresKind.Function:
      return SymbolKind.Function
    case PostgresKind.Trigger:
      return SymbolKind.Event
    default: {
      const unknownKind: never = kind
      neverReach( `"${unknownKind}" is unknown "PostgresKind".` )
    }
  }
}

export async function parseDocumentSymbols(
  fileText: string,
  uri: URI,
  defaultSchema: string,
): Promise<SymbolInformation[] | undefined> {
  const statements = await parseStmtements(fileText)
  if (statements === undefined) {
    return undefined
  }

  return parseCreateStatements(fileText, statements).map(
    (statementInfo) => {
      return {
        name: `${statementInfo.schema || defaultSchema}.${statementInfo.name}`,
        kind: convertToSymbleKind(PostgresKind.Table),
        location: {
          uri,
          range: statementInfo.targetSelectionRange,
        },
      }
    },
  )
}
