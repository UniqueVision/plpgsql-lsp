import { ExtensionContext, TextDocument, workspace } from "vscode"
import { LanguageClient } from "vscode-languageclient/node"

import { createLanguageClient } from "./client"
import { makeLanguageClientOptions, makeLanguageServerOptions } from "./options"

let defaultClient: LanguageClient
const clients: Map<string, LanguageClient> = new Map()


export function activate(context: ExtensionContext) {
  function didOpenTextDocument(document: TextDocument): void {
    // We are only interested in language mode text
    if (
      document.languageId !== "postgres"
      || (
        document.uri.scheme !== "file"
        && document.uri.scheme !== "untitled"
      )
    ) {
      return
    }

    const uri = document.uri
    // Untitled files go to a default client.
    if (uri.scheme === "untitled" && !defaultClient) {
      const debugOptions = { execArgv: ["--nolazy", "--inspect=6170"] }
      const serverOptions = makeLanguageServerOptions(context, debugOptions)
      const clientOptions = makeLanguageClientOptions()
      defaultClient = createLanguageClient(serverOptions, clientOptions)
      defaultClient.start()

      return
    }
    const folder = workspace.getWorkspaceFolder(uri)
    if (!folder) {
      return
    }

    if (!clients.has(folder.uri.toString())) {
      const debugOptions = {
        execArgv: ["--nolazy", `--inspect=${6171 + clients.size}`],
      }
      const serverOptions = makeLanguageServerOptions(context, debugOptions)
      const clientOptions = makeLanguageClientOptions(folder)
      const client = createLanguageClient(serverOptions, clientOptions)
      client.start()
      clients.set(folder.uri.toString(), client)
    }
  }

  workspace.onDidOpenTextDocument(didOpenTextDocument)
  workspace.textDocuments.forEach(didOpenTextDocument)
  workspace.onDidChangeWorkspaceFolders((event) => {
    for (const folder of event.removed) {
      const client = clients.get(folder.uri.toString())
      if (client) {
        clients.delete(folder.uri.toString())
        client.stop()
      }
    }
  })
}

export function deactivate(): Thenable<void> | undefined {
  const promises: Thenable<void>[] = []
  if (defaultClient) {
    promises.push(defaultClient.stop())
  }
  for (const client of clients.values()) {
    promises.push(client.stop())
  }

  return Promise.all(promises).then(() => undefined)
}
