import { Logger, uinteger } from "vscode-languageserver-protocol/node"
import { TextDocument } from "vscode-languageserver-textdocument"

import { getFirstLine } from "@/utilities/text"

export type PositionalQueryParametersInfo = {
  type: "position",
  parameterNumber: uinteger
}

export function getPositionalQueryParameterInfo(
  document: TextDocument,
  statement: string,
  _logger: Logger,
): PositionalQueryParametersInfo | null {
  const firstLine = getFirstLine(document)

  for (const pattern of [
    /^ *-- +plpgsql-language-server:use-positional-query-parameter( +number=[1-9][0-9]*)? *$/, // eslint-disable-line max-len
    /^ *\/\* +plpgsql-language-server:use-positional-query-parameter( +number=[1-9][0-9]*)? +\*\/$/, // eslint-disable-line max-len
  ]) {
    const found = firstLine.match(pattern)
    if (found !== null) {
      const queriesNumber = found[1]
      if (queriesNumber !== undefined) {
        return {
          type: "position",
          parameterNumber: Number(queriesNumber.replace(/^ +number=/, "")),
        }
      }
      else {
        // auto calculation.
        const queries = new Set([...statement.matchAll(/(\$[1-9][0-9]*)/g)]
          .map((found) => found[0]))

        return {
          type: "position",
          parameterNumber:  queries.size,
        }
      }
    }
  }

  return null
}

export function sanitizeFileWithPositionalQueryParameters(
  fileText: string,
  queryParameterInfo: PositionalQueryParametersInfo,
  _logger: Logger,
): [string, uinteger] {
  return [fileText, queryParameterInfo.parameterNumber]
}
