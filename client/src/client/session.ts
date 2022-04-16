import { LanguageClient, URI } from "vscode-languageclient/node"

export class Session {
  default?: LanguageClient
  workspace: Map<URI, LanguageClient> = new Map()

  stop(): Thenable<void> {
    const promises: Thenable<void>[] = []
    if (this.default !== undefined) {
      promises.push(this.default.stop())
    }
    for (const client of this.workspace.values()) {
      promises.push(client.stop())
    }

    return Promise.all(promises).then(() => undefined)
  }
}
