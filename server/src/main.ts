import {
  Connection,
  createConnection,
  ProposedFeatures,
} from "vscode-languageserver/node"

import { Server } from "@/server"
import { ConsoleLogger } from "@/utilities/logger"


// Create a connection for the server.
let connection: Connection | undefined = undefined
if (process.argv.indexOf("--stdio") === -1) {
  connection = createConnection(ProposedFeatures.all)
} else {
  connection = createConnection()
}

// Start Server.
const server = new Server(connection, new ConsoleLogger(connection))

server.start()
