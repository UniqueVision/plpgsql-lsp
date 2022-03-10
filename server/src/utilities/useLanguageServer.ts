import { TextDocument } from "vscode-languageserver-textdocument"

export function useLanguageServer(textDocument: TextDocument): boolean {
  const splittedDocument = textDocument.getText().split("\n")
  if (splittedDocument.length > 1) {
    const firstLine = splittedDocument[0].trim()
    if (
      firstLine.match(/^-- +plpgsql-language-server:disable *$/) !== null
      || firstLine.match(/^\/\* +plpgsql-language-server:disable +\*\/$/) !== null
    ) {
      return false
    }
  }

  return true
}

export function useValidation(textDocument: TextDocument): boolean {
  const splittedDocument = textDocument.getText().split("\n")
  if (splittedDocument.length > 1) {
    const firstLine = splittedDocument[0].trim()
    if (
      firstLine.match(
        /^-- +plpgsql-language-server:disable( +validation)? *$/,
      ) !== null
      || firstLine.match(
        /^\/\* +plpgsql-language-server:disable( +validation)? +\*\/$/,
      ) !== null
    ) {
      return false
    }
  }

  return true
}
