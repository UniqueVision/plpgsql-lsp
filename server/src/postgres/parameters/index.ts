import { Diagnostic, DiagnosticSeverity, Logger } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { Settings } from "@/settings"
import { neverReach } from "@/utilities/neverReach"
import { getTextAllRange } from "@/utilities/text"

import { PostgresClient } from "../pool"
import {
  executeFileWithKeywordQueryParameters,
  getKeywordQueryParameterInfo,
  KeywordQueryParameterPatternNotDefinedError,
  KeywordQueryParametersInfo,
} from "./keywordParameters"
import {
  executeFileWithPositionalQueryParameters,
  getPositionalQueryParameterInfo,
  PositionalQueryParametersInfo,
} from "./positionalParameters"

export type QueryParameterInfo =
  PositionalQueryParametersInfo | KeywordQueryParametersInfo

export function getQueryParameterInfo(
  document: TextDocument,
  settings: Settings,
  logger: Logger,
): QueryParameterInfo | Diagnostic | null {
  let queryParameterInfo

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

export async function executeFileWithQueryParameters(
  pgClient: PostgresClient,
  fileText: string,
  queryParameterInfo: QueryParameterInfo | null,
  logger: Logger,
) {
  if (queryParameterInfo === null) {
    await pgClient.query(fileText)
  }
  else if(queryParameterInfo.type === "position") {
    await executeFileWithPositionalQueryParameters(
      pgClient, fileText, queryParameterInfo, logger,
    )
  }
  else if (queryParameterInfo.type === "keyword") {
    await executeFileWithKeywordQueryParameters(
      pgClient, fileText, queryParameterInfo, logger,
    )
  } else {
    neverReach("Unknown \"queryParameterInfo.type\".")
  }
}
