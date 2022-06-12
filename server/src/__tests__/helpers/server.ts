import { createConnection } from "vscode-languageserver/node"

import { Server } from "@/server"
import { Settings } from "@/settings"
import { ConsoleLogger } from "@/utilities/logger"

import { TestTextDocuments } from "./textDocuments"

export function setupTestServer(settings: Settings): Server {
  process.argv.push("--node-ipc")

  const connection = createConnection()
  const logger = new ConsoleLogger(connection)
  const server = new Server(connection, logger, settings)

  server.documents = new TestTextDocuments()
  server.initialize({
    processId: null,
    capabilities: {},
    rootUri: null,
    workspaceFolders: null,
  })

  return server
}
