import {
  Logger, SymbolInformation, SymbolKind, URI, WorkspaceFolder,
} from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { PostgresKind } from "@/postgres/kind"
import { parseCreateStatements } from "@/postgres/parsers/parseCreateStatements"
import { parseStmtements } from "@/postgres/parsers/statement"
import { Settings } from "@/settings"
import { disableLanguageServer } from "@/utilities/disableLanguageServer"
import { neverReach } from "@/utilities/neverReach"
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
      neverReach(`"${unknownKind}" is unknown "PostgresKind".`)
    }
  }
}

export async function parseDocumentSymbols(
  uri: URI,
  fileText: string,
  defaultSchema: string,
  logger: Logger,
): Promise<SymbolInformation[] | undefined> {
  const statements = await parseStmtements(uri, fileText, logger)
  if (statements === undefined) {
    return undefined
  }

  return parseCreateStatements(uri, fileText, statements, logger).map(
    (statementInfo) => {
      return {
        name: `${statementInfo.schema ?? defaultSchema}.${statementInfo.name}`,
        kind: convertToSymbleKind(PostgresKind.Table),
        location: {
          uri,
          range: statementInfo.targetSelectionRange,
        },
      }
    },
  )
}
