import { readFileSync } from "fs"
import path from "path"
import { URI } from "vscode-languageserver"


export function getDefinitionFileResource(file: string): URI {
  return `file://${path.join(definitionsDirPath(), file)}`
}

export function getQueryFileResource(file: string): URI {
  return `file://${path.join(queryDirPath(), file)}`
}

export function loadDefinitionFile(filename: string): string {
  return readFileSync(path.join(definitionsDirPath(), filename)).toString()
}

export function loadQueryFile(filename: string): string {
  return readFileSync(path.join(queryDirPath(), filename)).toString()
}

function definitionsDirPath(): string {
  return path.join(__dirname, "..", "__fixtures__", "definitions")
}


function queryDirPath(): string {
  return path.join(__dirname, "..", "__fixtures__", "queries")
}
