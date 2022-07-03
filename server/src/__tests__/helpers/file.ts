import { promises as fs } from "fs"
import path from "path"
import { URI, WorkspaceFolder } from "vscode-languageserver"


export type LoadFileOptions = {
  skipDisableComment: boolean,
}

export const DEFAULT_LOAD_FILE_OPTIONS = {
  skipDisableComment: false,
}

export function getSampleFileUri(file: string): URI {
  return `file://${path.join(sampleDirPath(), file)}`
}

export function getSampleWorkspace(): WorkspaceFolder {
  return {
    uri: `file://${sampleDirPath()}`,
    name: "sample",
  }
}

export async function loadSampleFile(
  filename: string,
  options: LoadFileOptions = DEFAULT_LOAD_FILE_OPTIONS,
): Promise<string> {
  const fileText = (
    await fs.readFile(path.join(sampleDirPath(), filename))
  ).toString()
  if (options.skipDisableComment) {
    return skipDisableComment(fileText)
  }
  else {
    return fileText
  }
}

function sampleDirPath(): string {
  return path.join(__dirname, "..", "__fixtures__")
}

function skipDisableComment(fileText: string): string {
  return fileText.split("\n").slice(1).join("\n")
}
