import { ExtensionContext } from "vscode"

import { Extension } from "./extension"


const extension = new Extension()

export function activate(context: ExtensionContext): void {
  return extension.activate(context)
}

export function deactivate(): Thenable<void> | undefined {
  return extension.deactivate()
}
