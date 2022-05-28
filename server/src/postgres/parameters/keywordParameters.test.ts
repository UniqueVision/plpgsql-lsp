import { NullLogger } from "vscode-languageserver"

import { loadSampleTextDocument } from "@/__tests__/helpers/textDocuments"
import { neverReach } from "@/utilities/neverReach"

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
        document, "@{keyword}", NullLogger,
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
})
