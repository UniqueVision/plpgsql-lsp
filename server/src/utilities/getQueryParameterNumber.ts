import { uinteger } from "vscode-languageserver-protocol/node"
import { TextDocument } from "vscode-languageserver-textdocument"

import { getFirstLine } from "./text"

export function getQueryParameterNumber(document: TextDocument): uinteger | null {
  const firstLine = getFirstLine(document)

  for (const pattern of [
    /^ *-- +plpgsql-language-server:query-parameter-number +([1-9][0-9]*) *$/,
    /^ *\/\* +plpgsql-language-server:query-parameter-number +([1-9][0-9]*) +\*\/$/,
  ]) {
    const found = firstLine.match(pattern)
    if (found !== null) {

      return Number(found[1])
    }
  }

  return null
}
