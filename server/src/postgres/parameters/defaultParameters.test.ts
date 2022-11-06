import { NullLogger } from "vscode-languageserver"

import { loadSampleTextDocument } from "@/__tests__/helpers/textDocuments"
import { neverReach } from "@/utilities/neverReach"
import { getTextAfterFirstLine } from "@/utilities/text"

import {
  getDefaultQueryParameterInfo, sanitizeFileWithDefaultQueryParameters,
} from "./defaultParameters"

export type DefaultQueryParametersInfo = {
  type: "default",
  queryParameters: string[],
  queryParameterPattern: string
}

describe("Default Query Parameter Tests", () => {
  describe("Keyword Parameter Tests", function () {
    it("Check sanitized query length.", async () => {
      const document = await loadSampleTextDocument(
        "queries/correct_query_with_default_keyword_parameter.pgsql",
        { skipDisableComment: true },
      )
      const queryParametersInfo = getDefaultQueryParameterInfo(
        document,
        getTextAfterFirstLine(document),
        /:[A-Za-z_][A-Za-z0-9_]*/.source,
        NullLogger,
      )

      expect(queryParametersInfo).toBeTruthy()
      if (queryParametersInfo === null) neverReach()

      expect(queryParametersInfo?.queryParameters).toStrictEqual([":id", ":names"])

      const originalText = document.getText()
      const [sanitizedText] = sanitizeFileWithDefaultQueryParameters(
        originalText, queryParametersInfo, NullLogger,
      )

      expect(sanitizedText.length).toEqual(originalText.length)
    })
  })
})
