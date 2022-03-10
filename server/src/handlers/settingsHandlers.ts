import {
  Connection, DidChangeConfigurationParams, Logger,
} from "vscode-languageserver"

import { SettingsManager } from "@/server/settingsManager"
import { TextDocumentsManager } from "@/server/textDocumentManager"

import { DocumentHandler } from "./documentHandler"


export class SettingsHandler {
  constructor(
    private readonly connection: Connection,
    private readonly documents: TextDocumentsManager,
    private readonly settings: SettingsManager,
    private readonly documentHandler: DocumentHandler,
    private readonly logger: Logger,
  ) {
    this.connection.onDidChangeConfiguration(
      (params) => this.onDidChangeConfiguration(params),
    )
  }

  private async onDidChangeConfiguration(
    params: DidChangeConfigurationParams,
  ): Promise<void> {
    this.settings.reset(params.settings.plpgsqlLanguageServer)
    for (const document of this.documents.all()) {

      await this.documentHandler.validate(document)
    }
  }

}
