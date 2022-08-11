import {
  createConnection,
  ProposedFeatures,
} from "vscode-languageserver/node"

import { Server } from "@/server"
import { ConsoleLogger } from "@/utilities/logger"


// Create a connection for the server.
const connection = (() => {
  return (process.argv.indexOf("--stdio") === -1)
    ? createConnection(ProposedFeatures.all)
    : createConnection()
})()

// Start Server.
new Server(connection, new ConsoleLogger(connection)).start()
