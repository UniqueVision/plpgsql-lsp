import { Logger } from "vscode-languageserver-protocol/node"
import { TextDocument } from "vscode-languageserver-textdocument"

import { PostgresClient } from "@/postgres/pool"
import { getFirstLine } from "@/utilities/text"

export type KeywordQueryParametersInfo = {
  type: "keyword",
  keywordParams: string[],
  keywordQueryParameterPattern: string
}

export class KeywordQueryParameterPatternNotDefinedError extends Error {
  constructor() {
    super(
      "'plpgsqlLanguageServer.keywordQueryParameterPattern'"
      +" does not set in the settings.",
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

      let keywordParams = []
      const headWord = found[2]
      const tailWords = found[3]
      if (headWord !== undefined) {
        keywordParams.push(keywordQueryParameterPattern.replace("{keyword}", headWord))

        if (tailWords !== "") {
          tailWords
            .split(",")
            .map(word => word.trim())
            .filter(word => word !== "")
            .forEach(word => {
              keywordParams.push(
                keywordQueryParameterPattern.replace("{keyword}", word),
              )
            })
        }
      }
      else {
        // auto calculation.
        const keywordPattern = new RegExp(
          keywordQueryParameterPattern
            .replace("{keyword}", "[A-Za-z_][A-Za-z0-9_]*"),
          "g",
        )
        keywordParams = Array.from(
          new Set(
            [...document.getText().matchAll(keywordPattern)].map((found) => found[0]),
          ),
        )
      }

      return {
        type: "keyword",
        keywordParams,
        keywordQueryParameterPattern,
      }
    }
  }

  return null
}

export async function executeFileWithKeywordQueryParameters(
  pgClient: PostgresClient,
  fileText: string,
  queryParameterInfo: KeywordQueryParametersInfo,
  _logger: Logger,
) {
  const keywordParams = new Set(queryParameterInfo.keywordParams)

  for (const [index, keywordParam] of Array.from(keywordParams.values()).entries()) {
    fileText = fileText.replace(
      keywordParam,
      `$${index + 1}`,
    )
  }

  await pgClient.query(
    fileText,
    Array(keywordParams.size || 0).fill(null),
  )
}
