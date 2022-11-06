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
  KeywordQueryParameterPatternsNotDefinedError,
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
  queryParameterInfo = getPositionalQueryParameterInfo(
    document, logger,
  )
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
    if (error instanceof KeywordQueryParameterPatternsNotDefinedError) {
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
  else {
    const parameterInfoType = queryParameterInfo.type
    switch (parameterInfoType) {
      case "default": {
        return sanitizeFileWithDefaultQueryParameters(
          fileText, queryParameterInfo, logger,
        )
      }
      case "position": {
        return sanitizeFileWithPositionalQueryParameters(
          fileText, queryParameterInfo, logger,
        )
      }
      case "keyword": {
        return sanitizeFileWithKeywordQueryParameters(
          fileText, queryParameterInfo, logger,
        )
      }
      default: {
        const unknwonType: never = parameterInfoType
        neverReach( `"${unknwonType}" is unknown "queryParameterInfo.type".` )
      }
    }
  }
}
