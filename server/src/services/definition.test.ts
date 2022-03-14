import * as assert from "assert"
import dedent from "ts-dedent"
import {
  DefinitionLink, LocationLink, Position, Range, URI,
} from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { getDefinitionFileResource } from "@/__tests__/helpers/file"
import { setupTestServer } from "@/__tests__/helpers/server"
import { SettingsBuilder } from "@/__tests__/helpers/settings"
import { TestTextDocuments } from "@/__tests__/helpers/textDocuments"
import { Server } from "@/server/server"
import { readTextDocumentFromUri } from "@/utilities/text"


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
    const textDocument = TextDocument.create("test.pgsql", "postgres", 0, content);

    (server.documents as TestTextDocuments).set(textDocument)

    await server.definitionsManager.updateFileDefinitions(
      readTextDocumentFromUri(documentUri),
      (await server.settingsManager.get(textDocument.uri)).defaultSchema,
    )

    if (server.handlers === undefined) {
      throw new Error("handlers is undefined")
    }

    return server.handlers.onDefinition({
      position,
      textDocument,
    })
  }

  function validateDefinitionLinks(
    definitoins: DefinitionLink[] | undefined,
    expectedDefinitions: DefinitionLink[],
  ) {
    expect(definitoins).toBeDefined()
    if (definitoins === undefined) return

    assert.deepEqual(definitoins, expectedDefinitions)
  }

  describe("Definition", function () {
    it("Definition on table", async () => {
      const documentUri = getDefinitionFileResource("tables/companies.pgsql")
      const definition = await onDefinition(documentUri, "companies")

      validateDefinitionLinks(definition, [
        LocationLink.create(
          documentUri,
          Range.create(0, 39, 5, 1),
          Range.create(2, 13, 2, 22),
        ),
      ])
    })

    it("Definition on table with default schema", async () => {
      const documentUri = getDefinitionFileResource("tables/public_users.pgsql")
      const definition = await onDefinition(documentUri, "public.users")

      validateDefinitionLinks(definition, [
        LocationLink.create(
          documentUri,
          Range.create(0, 42, 6, 1),
          Range.create(2, 13, 2, 25),
        ),
      ])
    })

    it("Definition on table with non-default schema", async () => {
      const documentUri = getDefinitionFileResource(
        "tables/campaign_participants.pgsql",
      )
      const definition = await onDefinition(documentUri, "campaign.participants")

      validateDefinitionLinks(definition, [
        LocationLink.create(
          documentUri,
          Range.create(0, 51, 6, 1),
          Range.create(2, 13, 2, 34),
        ),
      ])
    })

    it("Definition on view", async () => {
      const documentUri = getDefinitionFileResource("views/deleted_users.pgsql")
      const definition = await onDefinition(documentUri, "deleted_users")

      validateDefinitionLinks(definition, [
        LocationLink.create(
          documentUri,
          Range.create(0, 42, 9, 20),
          Range.create(2, 12, 2, 25),
        ),
      ])
    })

    it("Definition with language server disable comment", async () => {
      const documentUri = getDefinitionFileResource("tables/companies.pgsql")
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
      const documentUri = getDefinitionFileResource("tables/companies.pgsql")
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
