import { ExtensionContext } from "vscode"

import { ClientManager } from "./clientManager"
import { Handlers } from "./handlers"

export class Extension {
  private handlers?: Handlers = undefined
  private clientManager: ClientManager = new ClientManager()

  activate(context: ExtensionContext): void {
    this.handlers = new Handlers(context, this.clientManager)
  }

  deactivate(): Thenable<void> {
    return this.clientManager.stop()
  }
}
