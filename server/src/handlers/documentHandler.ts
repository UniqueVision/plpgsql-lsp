import {
  Connection,
  Diagnostic,
  DidChangeWatchedFilesParams,
  FileChangeType,
  Logger,
  TextDocumentChangeEvent,
} from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { getPool, PostgresPoolManager } from "@/postgres/pool"
import { DefinitionMap } from "@/server/definitionMap"
import { SettingsManager } from "@/server/settingsManager"
import { TextDocumentsManager } from "@/server/textDocumentManager"
import { validateTextDocument } from "@/services/document/validate"
import {
  loadDefinitionFilesInWorkspace, updateFileDefinition,
} from "@/services/language/definition"
import { useValidation } from "@/utilities/useLanguageServer"

export class DocumentHandler {
  constructor(
    private connection: Connection,
    private readonly pgPools: PostgresPoolManager,
    private readonly documents: TextDocumentsManager,
    private readonly settings: SettingsManager,
    private readonly definitionMap: DefinitionMap,
    private hasDiagnosticRelatedInformationCapability: boolean,
    private logger: Logger,
  ) {
    this.connection.onDidChangeWatchedFiles(
      (params) => this.documentDidChangeWatchedFiles(params),
    )

    this.documents.onDidChangeContent((event) => this.documentDidChange(event))
    this.documents.onDidSave((event) => this.documentDidSave(event))
    this.documents.onDidOpen((event) => this.documentDidOpen(event))
    this.documents.onDidClose((event) => this.documentDidClose(event))
  }

  async validate(
    textDocument: TextDocument,
    options: {
      isComplete: boolean
    } = { isComplete: false },
  ): Promise<Diagnostic[] | undefined> {
    let diagnostics: Diagnostic[] | undefined = undefined

    if (!useValidation(textDocument)) {
      diagnostics = []

    }
    else {
      const settings = await this.settings.get(textDocument.uri)

      const pgPool = getPool(this.pgPools, settings, this.logger)
      if (pgPool === undefined) {
        diagnostics = []

      }
      else {
        diagnostics = await validateTextDocument(
          pgPool,
          textDocument,
          this.logger,
          this.hasDiagnosticRelatedInformationCapability,
          options.isComplete,
        )
      }
    }

    if (diagnostics === undefined) {
      return undefined
    }

    this.connection.sendDiagnostics({
      uri: textDocument.uri,
      diagnostics,
    })

    return diagnostics
  }

  private async documentDidChangeWatchedFiles(
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

  private async documentDidChange(
    event: TextDocumentChangeEvent<TextDocument>,
  ): Promise<void> {
    await this.validate(event.document)
  }

  private async documentDidSave(
    event: TextDocumentChangeEvent<TextDocument>,
  ): Promise<void> {
    await this.validate(event.document, { isComplete: true })

    if (
      this.definitionMap.fileDefinitions.has(event.document.uri)
      || await this.settings.isDefinitionTarget(event.document.uri)
    ) {
      console.log("Definition updationg...")

      const settings = await this.settings.get(event.document.uri)

      const candidates = await updateFileDefinition(
        this.definitionMap, event.document.uri, settings.defaultSchema,
      )

      if (candidates !== undefined) {
        const definitions = candidates.map(candidate => candidate.definition)

        console.log(`Definition updated!! 😎 ${JSON.stringify(definitions)}`)
      }
    }
  }

  private async documentDidOpen(
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

  private async documentDidClose(
    event: TextDocumentChangeEvent<TextDocument>,
  ): Promise<void> {
    this.settings.delete(event.document.uri)
    this.connection.sendDiagnostics({
      uri: event.document.uri,
      diagnostics: [],
    })
  }
}
