import {
  ClientCapabilities,
  Connection,
  DidChangeConfigurationNotification,
  InitializedParams,
  InitializeParams,
  InitializeResult,
  TextDocuments,
  TextDocumentSyncKind,
  WorkspaceFolder,
} from "vscode-languageserver"
import { createConnection } from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"

import { PostgresPoolManager } from "@/postgres/pool"

import { DEFAULT_SETTINGS, Settings } from "../settings"
import { Logger } from "../utilities/logger"
import { workspaceFoldersChanged } from "../utilities/workspace"
import { DefinitionMap } from "./definitionMap"
import { Handlers } from "./handlers"
import { SettingsManager } from "./settingsManager"
import { TextDocumentsManager, TextDocumentTestManager } from "./textDocumentManager"

export class Server {
  handlers?: Handlers
  pgPools: PostgresPoolManager = new Map()
  // Create a simple text document manager. The text document manager
  // supports full document sync only
  documents: TextDocumentsManager = new TextDocuments(TextDocument)
  // Cache the settings of all open documents
  settings: SettingsManager
  // PostgresSQL file definitions.
  definitionMap: DefinitionMap = new DefinitionMap()

  // Language client configuration
  private capabilities?: ClientCapabilities
  private workspaceFolders: WorkspaceFolder[] = []
  private clientDynamicRegisterSupport = false
  private hasConfigurationCapability = false
  private hasWsChangeWatchedFileDynamicRegistration = false
  private hasDiagnosticRelatedInformationCapability = false

  constructor(
    private connection: Connection,
    private logger: Logger,
  ) {
    this.documents.listen(this.connection)
    this.settings = new SettingsManager(
      connection, { hasConfigurationCapability: undefined },
    )

    this.connection.onInitialize(
      (params) => this.connectionInitialize(params),
    )

    this.connection.onInitialized(
      (params) => this.connectionInitialized(params),
    )
  }

  start(): void {
    this.connection.listen()
  }

  connectionInitialize(params: InitializeParams): InitializeResult {
    this.capabilities = params.capabilities
    this.workspaceFolders = params.workspaceFolders || []

    const textDocument = this.capabilities.textDocument
    const workspace = this.capabilities.workspace

    this.clientDynamicRegisterSupport = !!(
      textDocument &&
      textDocument.rangeFormatting &&
      textDocument.rangeFormatting.dynamicRegistration
    )

    this.hasConfigurationCapability = !!(
      workspace && !!workspace.configuration
    )

    this.hasWsChangeWatchedFileDynamicRegistration = !!(
      workspace &&
      workspace.didChangeWatchedFiles &&
      workspace.didChangeWatchedFiles.dynamicRegistration
    )

    this.hasDiagnosticRelatedInformationCapability = !!(
      params.capabilities.textDocument &&
      params.capabilities.textDocument.publishDiagnostics &&
      params.capabilities.textDocument.publishDiagnostics.relatedInformation
    )

    this.initializeSettingsManager()
    this.registerHandlers()

    return {
      capabilities: {
        textDocumentSync: TextDocumentSyncKind.Incremental,
        completionProvider: { resolveProvider: false },
        hoverProvider: true,
        definitionProvider: true,
        workspace: {
          workspaceFolders: {
            changeNotifications: true,
            supported: true,
          },
        },
      },
    }
  }

  private async connectionInitialized(_params: InitializedParams) {
    if (this.hasConfigurationCapability
      && this.clientDynamicRegisterSupport
    ) {
      // Register for all configuration changes.
      try {
        await this.connection.client.register(
          DidChangeConfigurationNotification.type, undefined,
        )
      }
      catch (error: unknown) {
        const errorMessage = (error as Error).toString()
        this.logger.error(
          `DidChangeConfigurationNotification cannot register. ${errorMessage}`,
        )
      }
    }

    if (this.hasWsChangeWatchedFileDynamicRegistration) {
      this.connection.workspace.onDidChangeWorkspaceFolders(
        (changedFolders) => {
          this.workspaceFolders = workspaceFoldersChanged(
            this.workspaceFolders, changedFolders,
          )
        },
      )
    }
  }

  private registerHandlers(): void {
    // Register all features that the language server has
    this.handlers = new Handlers(
      this.connection,
      this.pgPools,
      this.documents,
      this.settings,
      this.definitionMap,
      this.hasDiagnosticRelatedInformationCapability,
      this.logger,
    )
  }

  private initializeSettingsManager() {
    if (this.hasConfigurationCapability) {
      this.settings = new SettingsManager(this.connection, {
        hasConfigurationCapability: this.hasConfigurationCapability,
        documentSettingsMap: new Map(),
      })
    }
    else {
      this.settings = new SettingsManager(this.connection, {
        hasConfigurationCapability: this.hasConfigurationCapability,
        globalSettings: DEFAULT_SETTINGS,
      })
    }
  }
}

export function setupTestServer(settings: Settings): Server {
  process.argv.push("--node-ipc")

  const connection = createConnection()
  const logger = new Logger(connection)

  const server = new Server(
    connection,
    logger,
  )

  server.documents = new TextDocumentTestManager()
  server.settings = new SettingsManager(
    connection,
    {
      hasConfigurationCapability: false,
      globalSettings: settings,
    },
  )

  server.connectionInitialize({
    processId: null,
    capabilities: {},
    rootUri: null,
    workspaceFolders: null,
  })

  return server
}
