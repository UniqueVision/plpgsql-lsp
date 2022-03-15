import { TextDocuments, URI } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"


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
