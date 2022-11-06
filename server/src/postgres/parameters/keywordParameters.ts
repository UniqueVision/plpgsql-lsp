import { Logger, uinteger } from "vscode-languageserver-protocol/node"
import { TextDocument } from "vscode-languageserver-textdocument"

import { Settings } from "@/settings"
import { escapeRegex } from "@/utilities/regex"
import { getFirstLine } from "@/utilities/text"

import { makePositionalParamter } from "./helpers"

export type KeywordQueryParametersInfo = {
  type: "keyword",
  keywordParameters: string[],
  keywordQueryParameterPattern: string[]
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
  statement: string,
  keywordQueryParameterPattern: Settings["keywordQueryParameterPattern"],
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
      let keywordQueryParameterPatterns: string[]
      if (typeof keywordQueryParameterPattern === "string") {
        keywordQueryParameterPatterns = [keywordQueryParameterPattern]
      }
      else {
        keywordQueryParameterPatterns = keywordQueryParameterPattern
      }

      const keywordParameters: string[] = []
      const headWord = found[2]
      const tailWords = found[3]

      if (headWord !== undefined) {
        keywordQueryParameterPatterns.forEach(
          pattern => keywordParameters.push(pattern.replace("{keyword}", headWord)),
        )

        if (tailWords !== "") {
          tailWords
            .split(",")
            .map(word => word.trim())
            .filter(word => word !== "")
            .forEach(word => {
              keywordQueryParameterPatterns.forEach(
                pattern => keywordParameters.push(pattern.replace("{keyword}", word)),
              )
            })
        }
      }
      else {
        // auto calculation.
        keywordQueryParameterPatterns.forEach(pattern => {

          const keywordRegExp = new RegExp(
            pattern.replace("{keyword}", "[A-Za-z_][A-Za-z0-9_]*"),
            "g",
          )
          keywordParameters.push(...Array.from(
            new Set(
              [...statement.matchAll(keywordRegExp)]
                .map((found) => found[0]),
            ),
          ))
        })
      }

      return {
        type: "keyword",
        keywordParameters,
        keywordQueryParameterPattern: keywordQueryParameterPatterns,
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
    fileText = fileText.replace(
      new RegExp(escapeRegex(keywordParameter), "g"),
      makePositionalParamter(index, keywordParameter),
    )
  }

  return [fileText, keywordParameters.size]
}
