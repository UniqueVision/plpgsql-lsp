import { TextDocuments, URI } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"


export class TestTextDocuments extends TextDocuments<TextDocument> {
  textDocuments = new Map<URI, TextDocument>()

  constructor() {
    super(TextDocument)
  }

  get(uri: URI): TextDocument | undefined {
    return this.textDocuments.get(uri)
  }

  set(textDocument: TextDocument): void {
    this.textDocuments.set(textDocument.uri, textDocument)
  }
}
