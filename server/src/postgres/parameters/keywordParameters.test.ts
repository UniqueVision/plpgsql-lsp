import { NullLogger } from "vscode-languageserver"

import { loadSampleTextDocument } from "@/__tests__/helpers/textDocuments"
import { neverReach } from "@/utilities/neverReach"
import { getTextAfterFirstLine } from "@/utilities/text"

import {
  getKeywordQueryParameterInfo, sanitizeFileWithKeywordQueryParameters,
} from "./keywordParameters"

export type DefaultQueryParametersInfo = {
  type: "default",
  queryParameters: string[],
  queryParameterPattern: string
}

describe("Keyword Query Parameter Tests", () => {
  describe("Keyword Parameter Tests", function () {
    it("Check sanitized query length.", async () => {
      const document = await loadSampleTextDocument(
        "queries/correct_query_with_keyword_parameter.pgsql",
      )
      const queryParametersInfo = getKeywordQueryParameterInfo(
        document, getTextAfterFirstLine(document), "@{keyword}", NullLogger,
      )

      expect(queryParametersInfo).toBeTruthy()
      if (queryParametersInfo === null) neverReach()

      expect(queryParametersInfo?.keywordParameters).toStrictEqual(["@id", "@names"])

      const originalText = document.getText()
      const [sanitizedText] = sanitizeFileWithKeywordQueryParameters(
        originalText, queryParametersInfo, NullLogger,
      )

      expect(sanitizedText.length).toEqual(originalText.length)
    })
  })


  describe("Multiple Keyword Parameter Tests", function () {
    it("Check sanitized query length.", async () => {
      const document = await loadSampleTextDocument(
        "queries/correct_query_with_multiple_keyword_parameter.pgsql",
      )
      const queryParametersInfo = getKeywordQueryParameterInfo(
        document,
        getTextAfterFirstLine(document),
        [
          "@{keyword}",
          "sqlc\\.arg\\('{keyword}'\\)",
          "sqlc\\.narg\\('{keyword}'\\)",
        ],
        NullLogger,
      )

      expect(queryParametersInfo).toBeTruthy()
      if (queryParametersInfo === null) neverReach()

      expect(queryParametersInfo?.keywordParameters).toStrictEqual(
        ["@names", "sqlc.arg('id')"],
      )

      const originalText = document.getText()
      const [sanitizedText] = sanitizeFileWithKeywordQueryParameters(
        originalText, queryParametersInfo, NullLogger,
      )

      expect(sanitizedText.length).toEqual(originalText.length)
    })
  })
})
