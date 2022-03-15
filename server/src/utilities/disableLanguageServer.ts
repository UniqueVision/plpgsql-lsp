import { TextDocument } from "vscode-languageserver-textdocument"

import { getFirstLine } from "./text"

export function disableLanguageServer(document: TextDocument): boolean {
  const firstLine = getFirstLine(document)

  return !(
    firstLine.match(/^ *-- +plpgsql-language-server:disable *$/) === null
    && firstLine.match(/^ *\/\* +plpgsql-language-server:disable +\*\/$/) === null
  )
}

export function disableValidation(document: TextDocument): boolean {
  const firstLine = getFirstLine(document)

  return !(
    firstLine.match(/^ *-- +plpgsql-language-server:disable( +validation)? *$/) === null
    && firstLine.match(
      /^ *\/\* +plpgsql-language-server:disable( +validation)? +\*\/$/,
    ) === null
  )
}
