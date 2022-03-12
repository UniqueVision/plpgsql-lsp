//@ts-check

"use strict"

const clientConfig = require("./client/webpack.config")
const serverConfig = require("./server/webpack.config")

module.exports = [clientConfig, serverConfig]
