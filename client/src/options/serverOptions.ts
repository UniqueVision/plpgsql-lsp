import * as path from "path"
import { ExtensionContext } from "vscode"
import {
  ForkOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node"


export function makeLanguageServerOptions(
  context: ExtensionContext, debugOptions: ForkOptions,
): ServerOptions {
  // The server is implemented in node
  const module = context.asAbsolutePath(
    path.join("server", "out", "server.js"),
  )

  return {
    run: { module, transport: TransportKind.ipc },
    debug: {
      module,
      transport: TransportKind.ipc,
      options: debugOptions,
    },
  }
}
