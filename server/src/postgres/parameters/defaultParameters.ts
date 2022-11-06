import { Logger, uinteger } from "vscode-languageserver-protocol/node"
import { TextDocument } from "vscode-languageserver-textdocument"

import { escapeRegex } from "@/utilities/regex"
import { getFirstLine, getTextAfterFirstLine } from "@/utilities/text"

import { makePositionalParamter } from "./helpers"

export type DefaultQueryParametersInfo = {
  type: "default",
  queryParameters: string[],
  queryParameterPattern: string
}


export function getDefaultQueryParameterInfo(
  document: TextDocument,
  queryParameterPattern: string,
  _logger: Logger,
): DefaultQueryParametersInfo | null {
  const statement = getTextAfterFirstLine(document)
  const firstLine = getFirstLine(document)

  for (const pattern of [
    /^ *-- +plpgsql-language-server:use-query-parameter *$/,
    /^ *\/\* +plpgsql-language-server:use-query-parameter +\*\/$/,
  ]) {
    const found = firstLine.match(pattern)
    if (found !== null) {
      const queryRegExp = new RegExp(queryParameterPattern, "g")

      const queryParameters = Array.from(
        new Set(
          [...statement.matchAll(queryRegExp)]
            .map((found) => found[0]),
        ),
      )

      return {
        type: "default",
        queryParameters,
        queryParameterPattern,
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
