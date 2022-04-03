import { readFileSync } from "fs"
import path from "path"
import { URI } from "vscode-languageserver"


export function getSampleFileResource(file: string): URI {
  return `file://${path.join(sampleDirPath(), file)}`
}

export function getDefinitionFileResource(file: string): URI {
  return `file://${path.join(definitionsDirPath(), file)}`
}

export function getQueryFileResource(file: string): URI {
  return `file://${path.join(queryDirPath(), file)}`
}

export type LoadFileOptions = {
  skipDisableComment: boolean,
}

export const DEFAULT_LOAD_FILE_OPTIONS = {
  skipDisableComment: false,
}

export function loadSampleFile(
  filename: string,
  options: LoadFileOptions = DEFAULT_LOAD_FILE_OPTIONS,
): string {
  const fileText = readFileSync(path.join(sampleDirPath(), filename)).toString()
  if (options.skipDisableComment) {
    return skipDisableComment(fileText)
  }
  else {
    return fileText
  }
}

export function loadDefinitionFile(
  filename: string,
  options: LoadFileOptions = DEFAULT_LOAD_FILE_OPTIONS,
): string {
  const fileText = readFileSync(path.join(definitionsDirPath(), filename)).toString()
  if (options.skipDisableComment) {
    return skipDisableComment(fileText)
  }
  else {
    return fileText
  }
}

export function loadQueryFile(
  filename: string,
  options: LoadFileOptions = DEFAULT_LOAD_FILE_OPTIONS,
): string {
  const fileText = readFileSync(path.join(queryDirPath(), filename)).toString()
  if (options.skipDisableComment) {
    return skipDisableComment(fileText)
  }
  else {
    return fileText
  }
}

function skipDisableComment(fileText: string): string {
  return fileText.split("\n").slice(1).join("\n")
}

function sampleDirPath(): string {
  return path.join(__dirname, "..", "__fixtures__")
}


function definitionsDirPath(): string {
  return path.join(__dirname, "..", "__fixtures__", "definitions")
}


function queryDirPath(): string {
  return path.join(__dirname, "..", "__fixtures__", "queries")
}
