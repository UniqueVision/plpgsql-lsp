import { createConnection } from "vscode-languageserver/node"

import { Server } from "@/server"
import { SettingsManager } from "@/server/settingsManager"
import { Settings } from "@/settings"
import { ConsoleLogger } from "@/utilities/logger"

import { TestTextDocuments } from "./textDocuments"

export function setupTestServer(settings: Settings): Server {
  process.argv.push("--node-ipc")

  const connection = createConnection()
  const logger = new ConsoleLogger(connection)

  const server = new Server(
    connection,
    logger,
  )

  server.documents = new TestTextDocuments()
  server.settingsManager = new SettingsManager(
    connection,
    {
      hasConfigurationCapability: false,
      globalSettings: settings,
    },
  )

  server.initialize({
    processId: null,
    capabilities: {},
    rootUri: null,
    workspaceFolders: null,
  })

  return server
}
