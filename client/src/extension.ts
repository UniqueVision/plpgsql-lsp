import { ExtensionContext } from "vscode"

import { Client } from "./client"


const client: Client = new Client()

export function activate(context: ExtensionContext) {
  client.activate(context)
}

export function deactivate(): Thenable<void> | undefined {
  return client.deactivate()
}
