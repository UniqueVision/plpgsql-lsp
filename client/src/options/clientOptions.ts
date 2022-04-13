import {
  OutputChannel,
  window,
  workspace,
  WorkspaceFolder,
} from "vscode"
import { ExecuteCommandSignature } from "vscode-languageclient"
import {
  LanguageClientOptions,
} from "vscode-languageclient/node"

export const PLPGSQL_LANGUAGE_SERVER_SECTION = "plpgsqlLanguageServer"

export function makeLanguageClientOptions(
  workspaceFolder?: WorkspaceFolder,
): LanguageClientOptions {
  let documentSelector
  if (workspaceFolder === null) {
    documentSelector = [{ scheme: "untitled", language: "postgres" }]
  }
  else {
    const pattern = `${workspaceFolder.uri.fsPath}/**/*`
    documentSelector = [{ scheme: "file", language: "postgres", pattern }]
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


async function executeCommand(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  command: string, args: any[], next: ExecuteCommandSignature,
): Promise<void> {
  if (command === "plpgsql-lsp.executeFileQuery") {
    args.push(window.activeTextEditor.document.uri.toString())
    next(command, args)
  }
}
