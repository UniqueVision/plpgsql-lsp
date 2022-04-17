import { LanguageClient, URI } from "vscode-languageclient/node"

export class ClientManager {
  global?: LanguageClient
  workspaces: Map<URI, LanguageClient> = new Map()

  stop(): Thenable<void> {
    const promises: Thenable<void>[] = []

    // stop global client.
    if (this.global !== undefined) {
      promises.push(this.global.stop())
    }
    // stop workspace clients.
    for (const client of this.workspaces.values()) {
      promises.push(client.stop())
    }

    return Promise.all(promises).then(() => undefined)
  }
}
