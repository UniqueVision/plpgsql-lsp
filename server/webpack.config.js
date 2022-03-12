//@ts-check

"use strict"

const withDefaults = require("../webpack.config.default")
const path = require("path")
const TsconfigPathsPlugin = require("tsconfig-paths-webpack-plugin")


module.exports = withDefaults({
  context: __dirname,
  resolve: {
    mainFields: ["module", "main"],
    extensions: [".ts", ".js", ".node"],
    alias: {
      "@": path.resolve(__dirname),
    },
    plugins: [
      new TsconfigPathsPlugin.TsconfigPathsPlugin(
        { configFile: "./server/tsconfig.json" },
      ),
    ],
  },
  entry: {
    extension: "./src/main.ts",
  },
  output: {
    filename: "server.js",
    path: path.join(__dirname, "out"),
  },
})
