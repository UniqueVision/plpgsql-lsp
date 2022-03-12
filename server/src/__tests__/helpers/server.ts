import { createConnection } from "vscode-languageserver/node"

import { Server } from "@/server/server"
import { SettingsManager } from "@/server/settingsManager"
import { TextDocumentTestManager } from "@/server/textDocumentManager"
import { Settings } from "@/settings"
import { Logger } from "@/utilities/logger"

export function setupTestServer(settings: Settings): Server {
  process.argv.push("--node-ipc")

  const connection = createConnection()
  const logger = new Logger(connection)

  const server = new Server(
    connection,
    logger,
  )

  server.documents = new TextDocumentTestManager()
  server.settings = new SettingsManager(
    connection,
    {
      hasConfigurationCapability: false,
      globalSettings: settings,
    },
  )

  server.connectionInitialize({
    processId: null,
    capabilities: {},
    rootUri: null,
    workspaceFolders: null,
  })

  return server
}
