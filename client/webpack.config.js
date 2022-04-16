//@ts-check

"use strict"

const withDefaults = require("../webpack.config.default")
const path = require("path")

module.exports = withDefaults({
  context: __dirname,
  entry: {
    extension: "./src/main.ts",
  },
  output: {
    filename: "extension.js",
    path: path.join(__dirname, "out"),
  },
})
