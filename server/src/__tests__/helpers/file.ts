import { readFileSync } from "fs"
import path from "path"
import { URI } from "vscode-languageserver"


export function getDefinitionFileResource(file: string): URI {
  return `file://${path.join(definitionsDirPath(), file)}`
}

export function getQueryFileResource(file: string): URI {
  return `file://${path.join(queryDirPath(), file)}`
}

export function getDefinitionFileText(file: string) {
  return readFileSync(path.join(definitionsDirPath(), file)).toString()
}

export function getQueryFileText(file: string) {
  return readFileSync(path.join(queryDirPath(), file)).toString()
}

function definitionsDirPath(): string {
  return path.join(__dirname, "..", "__fixtures__", "definitions")
}


function queryDirPath(): string {
  return path.join(__dirname, "..", "__fixtures__", "queries")
}
