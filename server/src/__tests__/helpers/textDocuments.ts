import { TextDocuments, URI } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { getSampleFileResource, loadSampleFile } from "./file"


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

export function makeTextDocument(
  file: string,
  options: { ignoreDesableFlag: boolean } = { ignoreDesableFlag: false },
): TextDocument {
  let context = loadSampleFile(file)

  if (options.ignoreDesableFlag) {
    context = context.split("\n").slice(1).join("\n")
  }

  return TextDocument.create(
    getSampleFileResource(file),
    "postgres",
    0,
    context,
  )
}
