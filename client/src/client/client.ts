import {
  LanguageClient, LanguageClientOptions, ServerOptions,
} from "vscode-languageclient/node"

import { PLPGSQL_LANGUAGE_SERVER_SECTION } from "../options"


export function createLanguageClient(
  serverOptions: ServerOptions, clientOptions: LanguageClientOptions,
) {
  return new LanguageClient(
    PLPGSQL_LANGUAGE_SERVER_SECTION,
    "PL/pgSQL Language Server",
    serverOptions,
    clientOptions,
  )
}
