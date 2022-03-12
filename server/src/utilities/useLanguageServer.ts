import { Range } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

export function useLanguageServer(textDocument: TextDocument): boolean {
  const firstLine = textDocument.getText(Range.create(0, 0, 1, 0)).slice(0, -1)

  return (
    firstLine.match(/^ *-- +plpgsql-language-server:disable *$/) === null
    && firstLine.match(/^ *\/\* +plpgsql-language-server:disable +\*\/$/) === null
  )
}

export function useValidation(textDocument: TextDocument): boolean {
  const firstLine = textDocument.getText(Range.create(0, 0, 1, 0)).slice(0, -1)

  return (
    firstLine.match(/^ *-- +plpgsql-language-server:disable( +validation)? *$/) === null
    && firstLine.match(
      /^ *\/\* +plpgsql-language-server:disable( +validation)? +\*\/$/,
    ) === null
  )
}
