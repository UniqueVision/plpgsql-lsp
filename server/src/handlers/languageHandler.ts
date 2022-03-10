import {
  CompletionItem,
  CompletionParams,
  Connection,
  DefinitionLink,
  DefinitionParams,
  Hover,
  HoverParams,
  Logger,
} from "vscode-languageserver"

import { getPool, PostgresPoolManager } from "@/postgres/pool"
import { DefinitionMap } from "@/server/definitionMap"
import { SettingsManager } from "@/server/settingsManager"
import { TextDocumentsManager } from "@/server/textDocumentManager"
import { getCompletionItems } from "@/services/language/completion"
import { getDefinitionLinks } from "@/services/language/definition"
import { getHover } from "@/services/language/hover"
import { useLanguageServer } from "@/utilities/useLanguageServer"


export class LanguageHandlers {
  constructor(
    private readonly connection: Connection,
    private readonly pgPools: PostgresPoolManager,
    private readonly documents: TextDocumentsManager,
    private readonly settings: SettingsManager,
    private readonly definitionMap: DefinitionMap,
    private readonly logger: Logger,
  ) {
    this.connection.onHover((params) => this.onHover(params))
    this.connection.onCompletion((params) => this.onCompletion(params))
    this.connection.onDefinition((params) => this.onDefinition(params))
  }

  async onHover(
    params: HoverParams,
  ): Promise<Hover | undefined> {
    const textDocument = this.documents.get(params.textDocument.uri)
    if (textDocument === undefined || !useLanguageServer(textDocument)) {
      return undefined
    }

    const settings = await this.settings.get(params.textDocument.uri)

    const pgPool = getPool(this.pgPools, settings, this.logger)
    if (pgPool === undefined) {
      return undefined
    }

    return await getHover(
      pgPool,
      params,
      textDocument,
      settings.defaultSchema,
      this.logger,
    )
  }

  async onCompletion(
    params: CompletionParams,
  ): Promise<CompletionItem[] | undefined> {
    const textDocument = this.documents.get(params.textDocument.uri)
    if (textDocument === undefined || !useLanguageServer(textDocument)) {
      return undefined
    }

    const settings = await this.settings.get(params.textDocument.uri)

    const pgPool = getPool(this.pgPools, settings, this.logger)
    if (pgPool === undefined) {
      return undefined
    }

    return getCompletionItems(
      pgPool,
      params,
      textDocument,
      settings.defaultSchema,
      this.logger,
    )

  }

  async onDefinition(
    params: DefinitionParams,
  ): Promise<DefinitionLink[] | undefined> {
    const textDocument = this.documents.get(params.textDocument.uri)
    if (textDocument === undefined || !useLanguageServer(textDocument)) {
      return undefined
    }

    return await getDefinitionLinks(
      this.definitionMap,
      params,
      textDocument,
      this.logger,
    )
  }

}
