import { SymbolInformation, URI } from "vscode-languageserver"

import { getSampleFileResource } from "@/__tests__/helpers/file"
import { setupTestServer } from "@/__tests__/helpers/server"
import { SettingsBuilder } from "@/__tests__/helpers/settings"
import {
  loadSampleTextDocument, TestTextDocuments,
} from "@/__tests__/helpers/textDocuments"
import { Server } from "@/server"
import { neverReach } from "@/utilities/neverReach"
import { readTextDocumentFromUri } from "@/utilities/text"

expect.extend({
  toSymbolUriEqual(
    symbols: SymbolInformation[] | undefined, expectedUri: URI,
  ) {
    expect(symbols).toBeDefined()
    if (symbols === undefined) neverReach()

    if (symbols.length !== 0 && symbols[0].location.uri === expectedUri) {
      return {
        pass: true,
        message: () =>
          `expected not to equal Symbol URI ${expectedUri}`,
      }
    }
    else {
      return {
        pass: false,
        message: () =>
          `expected to equal Symbol URI ${expectedUri}`,
      }
    }
  },
})

describe("Definition Tests", () => {
  let server: Server

  beforeEach(() => {
    const settings = new SettingsBuilder().build()
    server = setupTestServer(settings)
  })

  afterEach(async () => {
    for (const pgPool of server.pgPools.values()) {
      await pgPool.end()
    }
  })

  async function onDocumentSymbol(
    documentUri: URI,
  ): Promise<SymbolInformation[] | undefined> {
    const textDocument = await loadSampleTextDocument(documentUri);

    (server.documents as TestTextDocuments).set(textDocument)

    await server.symbolsManager.updateFileSymbols(
      await readTextDocumentFromUri(documentUri),
      await server.settingsManager.get(textDocument.uri),
      server.logger,
    )

    if (server.handlers === undefined) {
      throw new Error("handlers is undefined")
    }

    return server.handlers.onDocumentSymbol({
      textDocument,
    })
  }

  describe("DocumentSymbol", function () {
    test.each([
      "definitions/table/companies.pgsql",
      "definitions/table/public_users.pgsql",
      "definitions/table/schedule.pgsql",
      "definitions/table/campaign_participants.pgsql",
      "definitions/table/empty_table.pgsql",
      "definitions/view/deleted_users.pgsql",
      "definitions/view/deleted_users.pgsql",
      "definitions/view/campaign_deleted_participants.pgsql",
      "definitions/materialized_view/my_users.pgsql",
      "definitions/function/positional_argument_function.pgsql",
      "definitions/function/positional_argument_function.pgsql",
      "definitions/function/keyword_argument_function.pgsql",
      "definitions/procedure/correct_procedure.pgsql",
      "definitions/function/constant_function.pgsql",
      "definitions/type/type_user.pgsql",
      "definitions/type/type_user.pgsql",
      "definitions/type/type_single_field.pgsql",
      "definitions/type/type_single_field.pgsql",
      "definitions/type/type_empty.pgsql",
      "definitions/domain/us_postal_code.pgsql",
      "definitions/domain/jp_postal_code.pgsql",
      "definitions/index/users_id_name_index.pgsql",
    ])(
      "can go to symbol (%s)", async (source) => {
        const documentUri = getSampleFileResource(source)
        const definition = await onDocumentSymbol(source)

        expect(definition).toSymbolUriEqual(documentUri)
      },
    )
  })
})
