import { Connection, TextDocuments } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"


export class TestTextDocuments
  extends TextDocuments<TextDocument> {
  testTextDocuments = new Map<string, TextDocument>()

  constructor() {
    super(TextDocument)
  }

  listen(_connection: Connection): void {
    return
  }

  get(uri: string): TextDocument | undefined {
    return this.testTextDocuments.get(uri)
  }

  set(textDocument: TextDocument): void {
    this.testTextDocuments.set(textDocument.uri, textDocument)
  }
}
