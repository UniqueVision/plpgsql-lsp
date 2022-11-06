import { Logger, uinteger } from "vscode-languageserver-protocol/node"
import { TextDocument } from "vscode-languageserver-textdocument"

import { escapeRegex } from "@/utilities/regex"
import { getFirstLine } from "@/utilities/text"

import { makePositionalParamter } from "./helpers"

export type DefaultQueryParametersInfo = {
  type: "default",
  queryParameters: string[],
  queryParameterPattern: string[]
}


export function getDefaultQueryParameterInfo(
  document: TextDocument,
  statement: string,
  queryParameterPattern: string | string[],
  _logger: Logger,
): DefaultQueryParametersInfo | null {
  const firstLine = getFirstLine(document)

  for (const pattern of [
    /^ *-- +plpgsql-language-server:use-query-parameter *$/,
    /^ *\/\* +plpgsql-language-server:use-query-parameter +\*\/$/,
  ]) {
    const found = firstLine.match(pattern)
    if (found !== null) {
      let queryParameterPatterns: string[]
      if (typeof queryParameterPattern === "string") {
        queryParameterPatterns = [queryParameterPattern]
      }
      else {
        queryParameterPatterns = queryParameterPattern
      }

      const queryParameters: string[] = []
      queryParameterPatterns.forEach(pattern => {
        const queryRegExp = new RegExp(pattern, "g")

        queryParameters.push(...Array.from(
          new Set(
            [...statement.matchAll(queryRegExp)]
              .map((found) => found[0]),
          ),
        ))
      })

      return {
        type: "default",
        queryParameters,
        queryParameterPattern: queryParameterPatterns,
      }
    }
  }

  return null
}

export function sanitizeFileWithDefaultQueryParameters(
  fileText: string,
  queryParameterInfo: DefaultQueryParametersInfo,
  _logger: Logger,
): [string, uinteger] {
  const queryParameters = new Set(queryParameterInfo.queryParameters)
  for (const [index, parameter] of Array.from(queryParameters.values()).entries()) {
    fileText = fileText.replace(
      new RegExp(escapeRegex(parameter), "g"),
      makePositionalParamter(index, parameter),
    )
  }

  return [fileText, queryParameters.size]
}
