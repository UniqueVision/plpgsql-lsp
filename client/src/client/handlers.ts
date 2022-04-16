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
import { Session } from "./session"

export class Handlers {
  constructor(
    private context: ExtensionContext,
    private session: Session,
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
    if (uri.scheme === "untitled" && this.session.default === undefined) {
      client = createLanguageClient(this.context, 6170)
      this.session.default = client
    }
    // Workspace folder files go to client Map.
    else {
      const workspaceFolder = workspace.getWorkspaceFolder(uri)
      if (!workspaceFolder) {
        return
      }

      const workspaceFolderUri = workspaceFolder.uri.toString()
      if (this.session.workspace.has(workspaceFolderUri)) {
        return
      }

      client = createLanguageClient(
        this.context, 6171 + this.session.workspace.size, workspaceFolder,
      )
      this.session.workspace.set(workspaceFolderUri, client)
    }

    client.start()
  }

  onDidChangeWorkspaceFolders(event: WorkspaceFoldersChangeEvent): void {
    for (const folder of event.removed) {
      const client = this.session.workspace.get(folder.uri.toString())
      if (client) {
        this.session.workspace.delete(folder.uri.toString())
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
