import {
  OutputChannel,
  window,
  workspace,
  WorkspaceFolder,
} from "vscode"
import {
  LanguageClient, LanguageClientOptions, ServerOptions,
} from "vscode-languageclient/node"

import { executeCommand } from "./commands"

const PLPGSQL_LANGUAGE_SERVER_SECTION = "plpgsqlLanguageServer"


export function createLanguageClient(
  serverOptions: ServerOptions, clientOptions: LanguageClientOptions,
) {
  return new LanguageClient(
    PLPGSQL_LANGUAGE_SERVER_SECTION,
    "PL/pgSQL Language Server",
    serverOptions,
    clientOptions,
  )
}


export function makeLanguageClientOptions(
  workspaceFolder?: WorkspaceFolder,
): LanguageClientOptions {
  let documentSelector
  if (workspaceFolder === null) {
    documentSelector = [
      {
        scheme: "untitled",
        language: "postgres",
      },
    ]
  }
  else {
    documentSelector = [
      {
        scheme: "file",
        language: "postgres",
        pattern: `${workspaceFolder.uri.fsPath}/**/*`,
      },
    ]
  }
  const outputChannel: OutputChannel = window.createOutputChannel(
    PLPGSQL_LANGUAGE_SERVER_SECTION,
  )

  return {
    documentSelector,
    synchronize: {
      fileEvents: workspace
        .createFileSystemWatcher("**/.clientrc"),
    },
    diagnosticCollectionName: PLPGSQL_LANGUAGE_SERVER_SECTION,
    workspaceFolder,
    outputChannel,
    middleware: {
      executeCommand,
    },
  }
}
