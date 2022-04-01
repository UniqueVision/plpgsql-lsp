import { Diagnostic, DiagnosticSeverity, Logger, uinteger } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { Settings } from "@/settings"
import { neverReach } from "@/utilities/neverReach"
import { getTextAllRange } from "@/utilities/text"

import {
  DefaultQueryParametersInfo,
  getDefaultQueryParameterInfo,
  sanitizeFileWithDefaultQueryParameters,
} from "./defaultParameters"
import {
  getKeywordQueryParameterInfo,
  KeywordQueryParameterPatternNotDefinedError,
  KeywordQueryParametersInfo,
  sanitizeFileWithKeywordQueryParameters,
} from "./keywordParameters"
import {
  getPositionalQueryParameterInfo,
  PositionalQueryParametersInfo,
  sanitizeFileWithPositionalQueryParameters,
} from "./positionalParameters"

export type QueryParameterInfo = (
  DefaultQueryParametersInfo
  | PositionalQueryParametersInfo
  | KeywordQueryParametersInfo
)

export function getQueryParameterInfo(
  document: TextDocument,
  settings: Settings,
  logger: Logger,
): QueryParameterInfo | Diagnostic | null {
  let queryParameterInfo

  // default query parameter
  queryParameterInfo = getDefaultQueryParameterInfo(
    document, settings.queryParameterPattern, logger,
  )
  if (queryParameterInfo !== null) {
    return queryParameterInfo
  }

  // positional query parameter.
  queryParameterInfo = getPositionalQueryParameterInfo(document, logger)
  if (queryParameterInfo !== null) {
    return queryParameterInfo
  }

  // keyword query parameter.
  try{
    queryParameterInfo = getKeywordQueryParameterInfo(
      document, settings.keywordQueryParameterPattern, logger,
    )
  }
  catch (error: unknown) {
    if (error instanceof KeywordQueryParameterPatternNotDefinedError) {
      return {
        severity: DiagnosticSeverity.Error,
        range: getTextAllRange(document),
        message: error.message,
      }
    }
  }
  if (queryParameterInfo !== null) {
    return queryParameterInfo
  }

  return null
}

export function sanitizeFileWithQueryParameters(
  fileText: string,
  queryParameterInfo: QueryParameterInfo | null,
  logger: Logger,
): [string, uinteger] {
  if (queryParameterInfo === null) {
    return [fileText, 0]
  }
  else if (queryParameterInfo.type === "default") {
    return sanitizeFileWithDefaultQueryParameters(
      fileText, queryParameterInfo, logger,
    )
  }
  else if(queryParameterInfo.type === "position") {
    return sanitizeFileWithPositionalQueryParameters(
      fileText, queryParameterInfo, logger,
    )
  }
  else if (queryParameterInfo.type === "keyword") {
    return sanitizeFileWithKeywordQueryParameters(
      fileText, queryParameterInfo, logger,
    )
  }
  else {
    neverReach("Unknown \"queryParameterInfo.type\".")
  }
}
