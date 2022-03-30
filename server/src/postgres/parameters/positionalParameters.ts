import { uinteger } from "vscode-languageserver-protocol/node"
import { TextDocument } from "vscode-languageserver-textdocument"

import { getFirstLine } from "@/utilities/text"

export type PositionalQueryParametersInfo = {
  type: "position",
  parameterNumber: uinteger
}

export function getPositionalQueryParameterNumber(
  document: TextDocument,
): uinteger | null {
  const firstLine = getFirstLine(document)
  for (const pattern of [
    /^ *-- +plpgsql-language-server:use-positional-query-parameter( +number=[1-9][0-9]*)? *$/, // eslint-disable-line max-len
    /^ *\/\* +plpgsql-language-server:use-positional-query-parameter( +number=[1-9][0-9]*)? +\*\/$/, // eslint-disable-line max-len
  ]) {
    const found = firstLine.match(pattern)
    if (found !== null) {
      const queriesNumber = found[1]
      if (queriesNumber !== undefined) {
        return Number(queriesNumber.replace(/^ +number=/, ""))
      }

      const queries = new Set([...document.getText().matchAll(/(\$[1-9][0-9]*)/g)]
        .map((found) => found[0]))

      return queries.size
    }
  }

  return null
}
