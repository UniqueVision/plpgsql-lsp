import { ExtensionContext } from "vscode"

import { Handlers } from "./handlers"
import { Session } from "./session"

export class Client {
  private handlers?: Handlers = undefined
  private session: Session = new Session()

  activate(context: ExtensionContext): void {
    this.handlers = new Handlers(context, this.session)
  }

  deactivate(): Thenable<void> {
    return this.session.stop()
  }
}
