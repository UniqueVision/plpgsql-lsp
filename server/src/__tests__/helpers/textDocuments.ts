import { TextDocuments, URI } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import {
  DEFAULT_LOAD_FILE_OPTIONS, getSampleFileResource, LoadFileOptions, loadSampleFile,
} from "./file"


export class TestTextDocuments extends TextDocuments<TextDocument> {
  documents = new Map<URI, TextDocument>()

  constructor() {
    super(TextDocument)
  }

  get(uri: URI): TextDocument | undefined {
    return this.documents.get(uri)
  }

  set(document: TextDocument): void {
    this.documents.set(document.uri, document)
  }
}

export function makeSampleTextDocument(
  file: string,
  options: LoadFileOptions = DEFAULT_LOAD_FILE_OPTIONS,
): TextDocument {
  let context = loadSampleFile(file)

  if (options.skipDisableComment) {
    context = context.split("\n").slice(1).join("\n")
  }

  return TextDocument.create(
    getSampleFileResource(file),
    "postgres",
    0,
    context,
  )
}
