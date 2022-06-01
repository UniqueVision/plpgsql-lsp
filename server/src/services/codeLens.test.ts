import { CodeLens } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { DEFAULT_LOAD_FILE_OPTIONS, LoadFileOptions } from "@/__tests__/helpers/file"
import { setupTestServer } from "@/__tests__/helpers/server"
import { SettingsBuilder } from "@/__tests__/helpers/settings"
import {
  loadSampleTextDocument,
  TestTextDocuments,
} from "@/__tests__/helpers/textDocuments"
import { Server } from "@/server"

import { makeExecuteFileQueryCommandCodeLens } from "./codeLens"

describe("CodeLens Tests", () => {
  let server: Server

  afterEach(async () => {
    for (const pgPool of server.pgPools.values()) {
      await pgPool.end()
    }
  })

  async function getCodeLensesInfo(
    file: string,
    options: LoadFileOptions = DEFAULT_LOAD_FILE_OPTIONS,
  ): Promise<[CodeLens[] | undefined, TextDocument]> {
    const document = await loadSampleTextDocument(
      file,
      options,
    );

    (server.documents as TestTextDocuments).set(document)

    if (server.handlers === undefined) {
      throw new Error("handlers is undefined")
    }

    const codeLenses = await server.handlers.onCodeLens({
      textDocument: { uri: document.uri },
    })

    return [codeLenses, document]
  }

  describe("Enable Settings", function () {
    beforeEach(() => {
      const settings = new SettingsBuilder().build()
      server = setupTestServer(settings)
    })

    it("succeed on the correct query.", async () => {
      const [codeLenses, document] = await getCodeLensesInfo(
        "queries/correct_query.pgsql",
      )

      expect(codeLenses).toStrictEqual([makeExecuteFileQueryCommandCodeLens(document)])
    })

    it("is to be empty on the query with positional parameters.", async () => {
      const [codeLenses] = await getCodeLensesInfo(
        "queries/correct_query_with_positional_parameter.pgsql",
      )

      expect(codeLenses).toStrictEqual([])
    })

    it("is to be undefined on the Language Server disable file.", async () => {
      const [codeLenses] = await getCodeLensesInfo(
        "queries/"
        + "syntax_error_query_with_language_server_disable_comment.pgsql",
      )

      expect(codeLenses).toBeUndefined()
    })

    it("is to be empty on the Language Server disable validation file.", async () => {
      const [codeLenses] = await getCodeLensesInfo(
        "queries/"
        + "syntax_error_query_with_language_server_disable_validation_comment.pgsql",
      )

      expect(codeLenses).toStrictEqual([])
    })
  })

  describe("Disable Settings", function () {
    beforeEach(() => {
      const settings = new SettingsBuilder()
        .withEnableExecuteFileQueryCommand(false)
        .build()
      server = setupTestServer(settings)
    })

    it("is to be empty on the correct query.", async () => {
      const [codeLenses] = await getCodeLensesInfo(
        "queries/correct_query.pgsql",
      )

      expect(codeLenses).toStrictEqual([])
    })
  })
})
