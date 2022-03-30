import { TextDocument } from "vscode-languageserver-textdocument"

import {
  getPositionalQueryParameterNumber,
  PositionalQueryParametersInfo,
} from "./positionalParameters"

export type QueryParameterInfo = PositionalQueryParametersInfo

export function getQueryParameterInfo(
  document: TextDocument,
): QueryParameterInfo | null {
  const parameterNumber = getPositionalQueryParameterNumber(document)
  if (parameterNumber === null) {
    return null
  }

  return {
    type: "position",
    parameterNumber,
  }
}
