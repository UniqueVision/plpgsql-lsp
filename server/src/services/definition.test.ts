import dedent from "ts-dedent"
import { DefinitionLink, Position, URI } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { getSampleFileResource } from "@/__tests__/helpers/file"
import { setupTestServer } from "@/__tests__/helpers/server"
import { SettingsBuilder } from "@/__tests__/helpers/settings"
import { TestTextDocuments } from "@/__tests__/helpers/textDocuments"
import { Server } from "@/server"
import { neverReach } from "@/utilities/neverReach"
import { readTextDocumentFromUri } from "@/utilities/text"

expect.extend({
  toDefinitionUriEqual(
    definitions: DefinitionLink[] | undefined, expectedUri: URI,
  ) {
    expect(definitions).toBeDefined()
    if (definitions === undefined) neverReach()

    if (definitions.length !== 0 && definitions[0].targetUri === expectedUri) {
      return {
        pass: true,
        message: () =>
          `expected not to equal Definition URI ${expectedUri}`,
      }
    }
    else {
      return {
        pass: false,
        message: () =>
          `expected to equal Definition URI ${expectedUri}`,
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

  async function onDefinition(
    documentUri: URI,
    content: string,
    position = Position.create(0, 0),
  ): Promise<DefinitionLink[] | undefined> {
    const document = TextDocument.create("test.pgsql", "postgres", 0, content);

    (server.documents as TestTextDocuments).set(document)

    await server.definitionsManager.updateFileDefinitions(
      await readTextDocumentFromUri(documentUri),
      (await server.settingsManager.get(document.uri)).defaultSchema,
    )

    if (server.handlers === undefined) {
      throw new Error("handlers is undefined")
    }

    return server.handlers.onDefinition({
      position,
      textDocument: document,
    })
  }

  describe("Definition", function () {
    test.each([
      ["definitions/table/companies.pgsql", "companies"],
      ["definitions/table/public_users.pgsql", "public.users"],
      ["definitions/table/schedule.pgsql", "schedule"],
      ["definitions/table/campaign_participants.pgsql", "campaign.participants"],
      ["definitions/table/empty_table.pgsql", "empty_table"],
      ["definitions/view/deleted_users.pgsql", "deleted_users"],
      ["definitions/view/deleted_users.pgsql", "public.deleted_users"],
      [
        "definitions/view/campaign_deleted_participants.pgsql",
        "campaign.deleted_participants",
      ],
      ["definitions/materialized_view/my_users.pgsql", "my_users"],
      [
        "definitions/function/positional_argument_function.pgsql",
        "positional_argument_function",
      ],
      [
        "definitions/function/positional_argument_function.pgsql",
        "public.positional_argument_function",
      ],
      [
        "definitions/function/keyword_argument_function.pgsql",
        "keyword_argument_function",
      ],
      [
        "definitions/procedure/correct_procedure.pgsql",
        "correct_procedure",
      ],
      [
        "definitions/function/constant_function.pgsql",
        "constant_function",
      ],
      [
        "definitions/type/type_user.pgsql",
        "type_user",
      ],
      [
        "definitions/type/type_user.pgsql",
        "public.type_user",
      ],
      [
        "definitions/type/type_single_field.pgsql",
        "type_single_field",
      ],
      [
        "definitions/type/type_single_field.pgsql",
        "type_single_field",
      ],
      [
        "definitions/type/type_empty.pgsql",
        "type_empty",
      ],
      [
        "definitions/domain/us_postal_code.pgsql",
        "us_postal_code",
      ],
      [
        "definitions/domain/jp_postal_code.pgsql",
        "public.jp_postal_code",
      ],
      [
        "definitions/index/users_id_name_index.pgsql",
        "users_id_name_index",
      ],
    ])(
      "can go to definition (%s)", async (source, target) => {
        const documentUri = getSampleFileResource(source)
        const definition = await onDefinition(documentUri, target)

        expect(definition).toDefinitionUriEqual(documentUri)
      },
    )

    it("Definition with language server disable comment", async () => {
      const documentUri = getSampleFileResource("definitions/table/companies.pgsql")
      const definition = await onDefinition(
        documentUri,
        dedent`
          -- plpgsql-language-server:disable

          companies
        `,
        Position.create(3, 0),
      )

      expect(definition).toBeUndefined()
    })

    it("Definition with language server disable block comment", async () => {
      const documentUri = getSampleFileResource("definitions/table/companies.pgsql")
      const definition = await onDefinition(
        documentUri,
        dedent`
          /* plpgsql-language-server:disable */

          companies
        `,
        Position.create(3, 0),
      )

      expect(definition).toBeUndefined()
    })
  })
})
