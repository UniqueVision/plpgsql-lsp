import { window } from "vscode"
import { ExecuteCommandSignature } from "vscode-languageclient"


export async function executeCommand(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  command: string, args: any[], next: ExecuteCommandSignature,
): Promise<void> {
  if (command === "plpgsql-lsp.executeFileQuery") {
    args.push(window.activeTextEditor.document.uri.toString())
    next(command, args)
  }

  return
}
