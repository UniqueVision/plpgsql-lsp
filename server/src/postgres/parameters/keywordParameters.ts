import { Logger, uinteger } from "vscode-languageserver-protocol/node"
import { TextDocument } from "vscode-languageserver-textdocument"

import { escapeRegex } from "@/utilities/regex"
import { getFirstLine, getTextAfterFirstLine } from "@/utilities/text"

import { makePositionalParamter } from "./helpers"

export type KeywordQueryParametersInfo = {
  type: "keyword",
  keywordParameters: string[],
  keywordQueryParameterPattern: string
}

export class KeywordQueryParameterPatternNotDefinedError extends Error {
  constructor() {
    super(
      "'plpgsqlLanguageServer.keywordQueryParameterPattern'"
      + " does not set in the settings.",
    )
    this.name = "KeywordQueryParameterPatternNotDefinedError"
  }
}

export function getKeywordQueryParameterInfo(
  document: TextDocument,
  keywordQueryParameterPattern: string | undefined,
  _logger: Logger,
): KeywordQueryParametersInfo | null {
  const firstLine = getFirstLine(document)
  for (const pattern of [
    /^ *-- +plpgsql-language-server:use-keyword-query-parameter( +keywords=\[ *([A-Za-z_][A-Za-z0-9_]*)?((, *([A-Za-z_][A-Za-z0-9_]*))*),? *\])? *$/, // eslint-disable-line max-len
    /^ *\/\* +plpgsql-language-server:use-keyword-query-parameter( +keywords=\[ *([A-Za-z_][A-Za-z0-9_]*)?((, *([A-Za-z_][A-Za-z0-9_]*))*),? *\])? +\*\/$/, // eslint-disable-line max-len
  ]) {
    const found = firstLine.match(pattern)

    if (found !== null) {

      if (keywordQueryParameterPattern === undefined) {
        throw new KeywordQueryParameterPatternNotDefinedError()
      }

      let keywordParameters = []
      const headWord = found[2]
      const tailWords = found[3]

      if (headWord !== undefined) {
        keywordParameters.push(
          keywordQueryParameterPattern.replace("{keyword}", headWord),
        )

        if (tailWords !== "") {
          tailWords
            .split(",")
            .map(word => word.trim())
            .filter(word => word !== "")
            .forEach(word => {
              keywordParameters.push(
                keywordQueryParameterPattern.replace("{keyword}", word),
              )
            })
        }
      }
      else {
        // auto calculation.
        const keywordRegExp = new RegExp(
          keywordQueryParameterPattern
            .replace("{keyword}", "[A-Za-z_][A-Za-z0-9_]*"),
          "g",
        )
        keywordParameters = Array.from(
          new Set(
            [...getTextAfterFirstLine(document).matchAll(keywordRegExp)]
              .map((found) => found[0]),
          ),
        )
      }

      return {
        type: "keyword",
        keywordParameters,
        keywordQueryParameterPattern,
      }
    }
  }

  return null
}

export function sanitizeFileWithKeywordQueryParameters(
  fileText: string,
  queryParameterInfo: KeywordQueryParametersInfo,
  _logger: Logger,
): [string, uinteger] {
  const keywordParameters = new Set(queryParameterInfo.keywordParameters)
  for (
    const [index, keywordParameter] of Array.from(keywordParameters.values()).entries()
  ) {
    // TODO "|(sqlc\\.[n]?arg\\(.*?[\\)])" + "|(@\\b\\w+\\b)"
    fileText = fileText.replace(
      new RegExp(escapeRegex(keywordParameter), "g"),
      makePositionalParamter(index, keywordParameter),
    )
  }

  return [fileText, keywordParameters.size]
}
