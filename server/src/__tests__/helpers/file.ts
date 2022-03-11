import { readFileSync } from "fs"
import path from "path"
import { URI } from "vscode-languageserver"


export function getDefinitionFileResource(file: string): URI {
  return `file://${path.join(__dirname, "__fixtures__", "definitions", file)}`
}

export function getQueryFileResource(file: string): URI {
  return `file://${path.join(__dirname, "__fixtures__", "queries", file)}`
}

export function getDefinitionFileText(file: string) {
  return readFileSync(
    path.join(__dirname, "__fixtures__", "definitions", file),
  ).toString()
}

export function getQueryFileText(file: string) {
  return readFileSync(
    path.join(__dirname, "__fixtures__", "queries", file),
  ).toString()
}
