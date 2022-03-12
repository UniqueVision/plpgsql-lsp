import {
  CompletionItem,
  CompletionParams,
  Connection,
  DefinitionLink,
  DefinitionParams,
  Diagnostic,
  DidChangeConfigurationParams,
  DidChangeWatchedFilesParams,
  FileChangeType,
  Hover,
  HoverParams,
  Logger,
  TextDocumentChangeEvent,
} from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { getPool, PostgresPoolManager } from "@/postgres/pool"
import { DefinitionMap } from "@/server/definitionMap"
import { SettingsManager } from "@/server/settingsManager"
import { TextDocumentsManager } from "@/server/textDocumentManager"
import { getCompletionItems } from "@/services/completion"
import {
  getDefinitionLinks,
  loadDefinitionFilesInWorkspace,
  updateFileDefinition,
} from "@/services/definition"
import { getHover } from "@/services/hover"
import { validateTextDocument } from "@/services/validate"
import { useLanguageServer, useValidation } from "@/utilities/useLanguageServer"


export class Handlers {
  constructor(
    private readonly connection: Connection,
    private readonly pgPools: PostgresPoolManager,
    private readonly documents: TextDocumentsManager,
    private readonly settings: SettingsManager,
    private readonly definitionMap: DefinitionMap,
    private readonly hasDiagnosticRelatedInformationCapability: boolean,
    private readonly logger: Logger,
  ) {
    this.documents.onDidChangeContent((event) => this.onDidChangeContent(event))
    this.documents.onDidClose((event) => this.onDidClose(event))
    this.documents.onDidOpen((event) => this.onDidOpen(event))
    this.documents.onDidSave((event) => this.onDidSave(event))

    this.connection.onCompletion((params) => this.onCompletion(params))
    this.connection.onDefinition((params) => this.onDefinition(params))
    this.connection.onDidChangeConfiguration(
      (params) => this.onDidChangeConfiguration(params),
    )
    this.connection.onDidChangeWatchedFiles(
      (params) => this.onDidChangeWatchedFiles(params),
    )
    this.connection.onHover((params) => this.onHover(params))
  }

  async onDidChangeContent(
    event: TextDocumentChangeEvent<TextDocument>,
  ): Promise<void> {
    await this.validate(event.document)
  }

  async onDidClose(
    event: TextDocumentChangeEvent<TextDocument>,
  ): Promise<void> {
    this.settings.delete(event.document.uri)
    this.connection.sendDiagnostics({
      uri: event.document.uri,
      diagnostics: [],
    })
  }

  async onDidOpen(
    event: TextDocumentChangeEvent<TextDocument>,
  ): Promise<void> {
    if (this.definitionMap.isEmpty()) {
      const settings = await this.settings.get(event.document.uri)

      const workspace = await this.settings.getWorkspaceFolder(
        event.document.uri,
      )
      if (workspace === undefined) {
        return
      }

      await loadDefinitionFilesInWorkspace(
        settings.definitionFiles,
        this.definitionMap,
        workspace,
        settings.defaultSchema,
        this.logger,
      )
    }
  }

  async onDidSave(
    event: TextDocumentChangeEvent<TextDocument>,
  ): Promise<void> {
    await this.validate(event.document, { isComplete: true })

    if (
      this.definitionMap.fileDefinitions.has(event.document.uri)
      || await this.settings.isDefinitionTarget(event.document.uri)
    ) {
      console.log("Definitions updationg...")

      const settings = await this.settings.get(event.document.uri)

      const candidates = await updateFileDefinition(
        this.definitionMap, event.document.uri, settings.defaultSchema,
      )

      if (candidates !== undefined) {
        const definitions = candidates.map(candidate => candidate.definition)

        console.log(`Definitions updated!! 😎 ${JSON.stringify(definitions)}`)
      }
    }
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

  async onDidChangeConfiguration(
    params: DidChangeConfigurationParams,
  ): Promise<void> {
    this.settings.reset(params.settings.plpgsqlLanguageServer)
    for (const document of this.documents.all()) {

      await this.validate(document)
    }
  }

  async onDidChangeWatchedFiles(
    params: DidChangeWatchedFilesParams,
  ): Promise<void> {
    let hasChanges = false

    params.changes.forEach(
      ({ type }) => {
        if (type === FileChangeType.Changed) {
          hasChanges = true
        }
      },
    )

    if (hasChanges) {
      for (const document of this.documents.all()) {
        await this.validate(document)
      }
    }
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

  async validate(
    textDocument: TextDocument,
    options: { isComplete: boolean } = { isComplete: false },
  ): Promise<Diagnostic[] | undefined> {
    let diagnostics: Diagnostic[] | undefined = undefined

    if (useValidation(textDocument)) {
      const settings = await this.settings.get(textDocument.uri)

      const pgPool = getPool(this.pgPools, settings, this.logger)
      if (pgPool !== undefined) {
        diagnostics = await validateTextDocument(
          pgPool,
          textDocument,
          {
            isComplete: options.isComplete,
            hasDiagnosticRelatedInformationCapability:
              this.hasDiagnosticRelatedInformationCapability,
          },
          this.logger,
        )
      }
    }

    this.connection.sendDiagnostics({
      uri: textDocument.uri,
      diagnostics: diagnostics || [],
    })

    return diagnostics
  }
}
