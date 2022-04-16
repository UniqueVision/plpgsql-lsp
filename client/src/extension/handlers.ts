import {
  ExtensionContext,
  TextDocument, workspace,
  WorkspaceFolder,
  WorkspaceFoldersChangeEvent,
} from "vscode"
import {
  LanguageClient,
  uinteger,
} from "vscode-languageclient/node"

import {
  makeLanguageClientOptions,
  PLPGSQL_LANGUAGE_SERVER_SECTION,
} from "../options/clientOptions"
import { makeLanguageServerOptions } from "../options/serverOptions"
import { ClientManager } from "./clientManager"

export class Handlers {
  constructor(
    private context: ExtensionContext,
    private clientManager: ClientManager,
  ) {
    workspace.onDidOpenTextDocument((event) => this.onDidOpenTextDocument(event))
    workspace.textDocuments.forEach((event) => this.onDidOpenTextDocument(event))
    workspace.onDidChangeWorkspaceFolders(
      (event) => this.onDidChangeWorkspaceFolders(event),
    )
  }

  onDidOpenTextDocument(document: TextDocument): void {
    let client: LanguageClient
    // We are only interested in language mode text
    if (
      document.languageId !== "postgres"
      || !["file", "untitled"].includes(document.uri.scheme)
    ) {
      return
    }

    const uri = document.uri
    // Untitled files go to a default client.
    if (uri.scheme === "untitled" && this.clientManager.default === undefined) {
      client = createLanguageClient(this.context, 6170)
      client.start()
      this.clientManager.default = client
    }
    // Workspace folder files go to client Map.
    else {
      const workspaceFolder = workspace.getWorkspaceFolder(uri)
      if (!workspaceFolder) {
        return
      }

      const workspaceFolderUri = workspaceFolder.uri.toString()
      if (this.clientManager.workspace.has(workspaceFolderUri)) {
        return
      }

      client = createLanguageClient(
        this.context, 6171 + this.clientManager.workspace.size, workspaceFolder,
      )
      client.start()
      this.clientManager.workspace.set(workspaceFolderUri, client)
    }
  }

  onDidChangeWorkspaceFolders(event: WorkspaceFoldersChangeEvent): void {
    for (const folder of event.removed) {
      const client = this.clientManager.workspace.get(folder.uri.toString())
      if (client) {
        this.clientManager.workspace.delete(folder.uri.toString())
        client.stop()
      }
    }
  }
}

function createLanguageClient(
  context: ExtensionContext, port: uinteger, workspaceFolder?: WorkspaceFolder,
): LanguageClient {
  const debugOptions = { execArgv: ["--nolazy", `--inspect=${port}`] }
  const serverOptions = makeLanguageServerOptions(context, debugOptions)
  const clientOptions = makeLanguageClientOptions(workspaceFolder)

  return new LanguageClient(
    PLPGSQL_LANGUAGE_SERVER_SECTION,
    "PL/pgSQL Language Server",
    serverOptions,
    clientOptions,
  )
}
