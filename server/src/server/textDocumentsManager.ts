import { TextDocuments } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

export type TextDocumentsManager =
  TextDocuments<TextDocument> | TextDocumentsTestManager

export class TextDocumentsTestManager extends TextDocuments<TextDocument> {
  testTextDocuments = new Map<string, TextDocument>()

  constructor() {
    super(TextDocument)
  }

  get(uri: string): TextDocument | undefined {
    return this.testTextDocuments.get(uri)
  }

  set(textDocument: TextDocument): void {
    this.testTextDocuments.set(textDocument.uri, textDocument)
  }
}
