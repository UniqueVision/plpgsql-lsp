import { TextDocument } from "vscode-languageserver-textdocument"

import { getFirstLine } from "./text"

export function useLanguageServer(textDocument: TextDocument): boolean {
  const firstLine = getFirstLine(textDocument)

  return (
    firstLine.match(/^ *-- +plpgsql-language-server:disable *$/) === null
    && firstLine.match(/^ *\/\* +plpgsql-language-server:disable +\*\/$/) === null
  )
}

export function useValidation(textDocument: TextDocument): boolean {
  const firstLine = getFirstLine(textDocument)

  return (
    firstLine.match(/^ *-- +plpgsql-language-server:disable( +validation)? *$/) === null
    && firstLine.match(
      /^ *\/\* +plpgsql-language-server:disable( +validation)? +\*\/$/,
    ) === null
  )
}
