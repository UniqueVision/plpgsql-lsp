import { Logger, uinteger } from "vscode-languageserver-protocol/node"
import { TextDocument } from "vscode-languageserver-textdocument"

import { PostgresClient } from "@/postgres/pool"
import { getFirstLine } from "@/utilities/text"

export type PositionalQueryParametersInfo = {
  type: "position",
  parameterNumber: uinteger
}

export function getPositionalQueryParameterInfo(
  document: TextDocument,
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
        const queries = new Set([...document.getText().matchAll(/(\$[1-9][0-9]*)/g)]
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

export async function executeFileWithPositionalQueryParameters(
  pgClient: PostgresClient,
  fileText: string,
  queryParameterInfo: PositionalQueryParametersInfo,
  _logger: Logger,
) {
  await pgClient.query(
    fileText,
    Array(queryParameterInfo.parameterNumber || 0).fill(null),
  )
}
