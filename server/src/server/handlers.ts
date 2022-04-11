import {
  CodeAction,
  CodeActionParams,
  CodeLens,
  CodeLensParams,
  CompletionItem,
  CompletionParams,
  Connection,
  DefinitionLink,
  DefinitionParams,
  Diagnostic,
  DidChangeConfigurationParams,
  DidChangeWatchedFilesParams,
  ExecuteCommandParams,
  FileChangeType,
  Hover,
  HoverParams,
  Logger,
  TextDocumentChangeEvent,
  TextDocumentIdentifier,
  TextDocuments,
} from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { COMMAND_TITLE_MAP } from "@/commands"
import { getQueryParameterInfo } from "@/postgres/parameters"
import { getPool, PostgresPool, PostgresPoolMap } from "@/postgres/pool"
import { DefinitionsManager } from "@/server/definitionsManager"
import { SettingsManager } from "@/server/settingsManager"
import { getCodeActions } from "@/services/codeAction"
import { getCodeLenses } from "@/services/codeLens"
import { getCompletionItems } from "@/services/completion"
import {
  getDefinitionLinks,
} from "@/services/definition"
import { getHover } from "@/services/hover"
import { validateTextDocument } from "@/services/validation"
import { Settings } from "@/settings"
import {
  disableLanguageServer, disableValidation,
} from "@/utilities/disableLanguageServer"

import { CommandExecuter } from "./commandExecuter"


export type HandlersOptions = {
  hasDiagnosticRelatedInformationCapability: boolean
}

export class Handlers {
  constructor(
    private readonly connection: Connection,
    private readonly pgPools: PostgresPoolMap,
    private readonly documents: TextDocuments<TextDocument>,
    private readonly settingsManager: SettingsManager,
    private readonly definitionsManager: DefinitionsManager,
    private readonly commaneExecuter: CommandExecuter,
    private readonly options: HandlersOptions,
    private readonly logger: Logger,
  ) {
    this.documents.onDidChangeContent((event) => this.onDidChangeContent(event))
    this.documents.onDidClose((event) => this.onDidClose(event))
    this.documents.onDidOpen((event) => this.onDidOpen(event))
    this.documents.onDidSave((event) => this.onDidSave(event))

    this.connection.onCodeAction((params) => this.onCodeAction(params))
    this.connection.onCodeLens((params) => this.onCodeLens(params))
    this.connection.onCompletion((params) => this.onCompletion(params))
    this.connection.onDefinition((params) => this.onDefinition(params))
    this.connection.onDidChangeConfiguration(
      (params) => this.onDidChangeConfiguration(params),
    )
    this.connection.onDidChangeWatchedFiles(
      (params) => this.onDidChangeWatchedFiles(params),
    )
    this.connection.onExecuteCommand((params) => this.onExecuteCommand(params))
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
    this.settingsManager.delete(event.document.uri)
    this.connection.sendDiagnostics({
      uri: event.document.uri,
      diagnostics: [],
    })
  }

  async onDidOpen(
    event: TextDocumentChangeEvent<TextDocument>,
  ): Promise<void> {
    const workspaceFolder = await this.settingsManager.getWorkspaceFolder(
      event.document.uri,
    )
    if (workspaceFolder === undefined) {
      return
    }

    if (!this.definitionsManager.hasWorkspaceFolder(workspaceFolder)) {
      const settings = await this.settingsManager.get(event.document.uri)

      this.logger.log(
        `The "${workspaceFolder.name}" workspace definitions are loading...`,
      )

      await this.definitionsManager.loadWorkspaceDefinitions(
        workspaceFolder,
        settings,
        this.logger,
      )

      this.logger.log("The definitions have been loaded!! 👍")
    }
  }

  async onDidSave(
    event: TextDocumentChangeEvent<TextDocument>,
  ): Promise<void> {
    const document = event.document

    if (disableLanguageServer(document)) {
      return
    }

    await this.validate(document, { isComplete: true })

    if (
      this.definitionsManager.hasFileDefinitions(document.uri)
      || await this.settingsManager.isDefinitionTarget(document.uri)
    ) {
      const settings = await this.settingsManager.get(document.uri)

      this.logger.log("The file definitions are updating...")

      const candidates = await this.definitionsManager.updateFileDefinitions(
        document, settings.defaultSchema,
      )

      if (candidates !== undefined) {
        const definitions = candidates.map(candidate => candidate.definition)

        this.logger.log(
          `The file definitions have been updated!! 😎 ${JSON.stringify(definitions)}`,
        )
      }
    }
  }

  async onCodeAction(
    params: CodeActionParams,
  ): Promise<CodeAction[] | undefined> {
    return this.handlePostgresPool(
      params.textDocument,
      (pgPool, document, settings) =>
        getCodeActions(pgPool, document, settings, this.logger),
    )
  }

  async onCodeLens(
    params: CodeLensParams,
  ): Promise<CodeLens[] | undefined> {
    return this.handlePostgresPool(
      params.textDocument,
      (pgPool, document, settings) =>
        getCodeLenses(pgPool, document, settings, this.logger),
    )
  }

  async onCompletion(
    params: CompletionParams,
  ): Promise<CompletionItem[] | undefined> {
    return this.handlePostgresPool(
      params.textDocument,
      (pgPool, document, settings) =>
        getCompletionItems(
          pgPool,
          document,
          params.position,
          settings.defaultSchema,
          this.logger,
        ),
    )
  }

  async onDefinition(
    params: DefinitionParams,
  ): Promise<DefinitionLink[] | undefined> {
    const document = this.documents.get(params.textDocument.uri)
    if (document === undefined || disableLanguageServer(document)) {
      return undefined
    }

    return await getDefinitionLinks(
      this.definitionsManager,
      document,
      params.position,
      this.logger,
    )
  }

  async onDidChangeConfiguration(
    params: DidChangeConfigurationParams,
  ): Promise<void> {
    this.settingsManager.reset(params.settings?.plpgsqlLanguageServer)
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

  async onExecuteCommand(params: ExecuteCommandParams): Promise<void> {
    try {
      await this.commaneExecuter.execute(params)
      this.connection.window.showInformationMessage(
        COMMAND_TITLE_MAP[params.command],
      )
    }
    catch (error: unknown) {
      this.connection.window.showErrorMessage("PL/pgSQL: " + (error as Error).message)
    }
  }

  async onHover(
    params: HoverParams,
  ): Promise<Hover | undefined> {
    return this.handlePostgresPool(
      params.textDocument,
      (pgPool, document, settings) =>
        getHover(
          pgPool,
          document,
          params.position,
          settings.defaultSchema,
          this.logger,
        ),
    )
  }

  async validate(
    document: TextDocument,
    options: { isComplete: boolean } = { isComplete: false },
  ): Promise<Diagnostic[] | undefined> {
    let diagnostics: Diagnostic[] | undefined = undefined

    if (!disableValidation(document)) {
      const settings = await this.settingsManager.get(document.uri)

      const queryParameterInfo = getQueryParameterInfo(
        document, await this.settingsManager.get(document.uri), this.logger,
      )

      if (queryParameterInfo === null || "type" in queryParameterInfo) {
        const pgPool = await getPool(this.pgPools, settings, this.logger)
        if (pgPool !== undefined) {
          diagnostics = await validateTextDocument(
            pgPool,
            document,
            {
              isComplete: options.isComplete,
              hasDiagnosticRelatedInformationCapability:
                this.options.hasDiagnosticRelatedInformationCapability,
              queryParameterInfo,
            },
            this.logger,
          )
        }
      }
      else {
        diagnostics = [queryParameterInfo]
      }
    }

    this.connection.sendDiagnostics({
      uri: document.uri,
      diagnostics: diagnostics || [],
    })

    return diagnostics
  }

  private async handlePostgresPool<T>(
    textDocument: TextDocumentIdentifier,
    service: (
      pgPool: PostgresPool, document: TextDocument, settings: Settings
    ) => Promise<T>,
  ): Promise<T | undefined> {
    const document = this.documents.get(textDocument.uri)
    const settings = await this.settingsManager.get(textDocument.uri)

    const pgPool = await getPool(this.pgPools, settings, this.logger)
    if (pgPool === undefined) {
      return undefined
    }

    if (document === undefined || disableLanguageServer(document)) {
      return undefined
    }

    return service(pgPool, document, settings)
  }
}
