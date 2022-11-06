import { Logger } from "vscode-jsonrpc/node"
import { Connection, Diagnostic, WorkspaceFolder } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { PostgresPool } from "@/postgres"
import { getQueryParameterInfo } from "@/postgres/parameters"
import { validateTextDocument } from "@/services/validation"
import { Settings } from "@/settings"
import { disableValidation } from "@/utilities/disableLanguageServer"
import {
  loadWorkspaceValidationTargetFiles, readTextDocumentFromUri,
} from "@/utilities/text"


export const WORKSPACE_VALIDATION_COMMAND = {
  title: "PL/pgSQL: Validate the Workspace Files",
  name: "plpgsql-lsp.validateWorkspace",
  execute: validateWorkspace,
} as const

export type ValidationOptions = {
  isComplete: boolean,
  hasDiagnosticRelatedInformationCapability: boolean
}

export async function validateWorkspace(
  connection: Connection,
  pgPool: PostgresPool,
  workspaceFolder: WorkspaceFolder,
  settings: Settings,
  options: ValidationOptions,
  logger: Logger,
): Promise<void> {
  for (const file of await loadWorkspaceValidationTargetFiles(
    workspaceFolder, settings,
  )) {
    const document = await readTextDocumentFromUri(`${workspaceFolder.uri}/${file}`)
    await validateFile(connection, pgPool, document, settings, options, logger)
  }
}

export async function validateFile(
  connection: Connection,
  pgPool: PostgresPool,
  document: TextDocument,
  settings: Settings,
  options: ValidationOptions,
  logger: Logger,
): Promise<Diagnostic[] | undefined> {
  let diagnostics: Diagnostic[] | undefined = undefined

  if (!disableValidation(document)) {
    const queryParameterInfo = getQueryParameterInfo(
      document, document.getText(), settings, logger,
    )

    if (queryParameterInfo === null || "type" in queryParameterInfo) {
      diagnostics = await validateTextDocument(
        pgPool,
        document,
        {
          isComplete: true,
          hasDiagnosticRelatedInformationCapability:
            options.hasDiagnosticRelatedInformationCapability,
          queryParameterInfo,
          statementSeparatorPattern: settings.statementSeparatorPattern,
        },
        settings,
        logger,
      )
    }
    else {
      diagnostics = [queryParameterInfo]
    }
  }

  connection.sendDiagnostics({
    uri: document.uri,
    diagnostics: diagnostics ?? [],
  })

  return diagnostics
}
