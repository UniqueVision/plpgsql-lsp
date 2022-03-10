import * as assert from "assert"
import {
  DefinitionLink, LocationLink, Position, Range, URI,
} from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { getDefinitionFileResource } from "@/postgres/file"
import { Server, setupTestServer } from "@/server/server"
import { TextDocumentTestManager } from "@/server/textDocumentManager"
import { SettingsBuilder } from "@/settings"

import { updateFileDefinition } from "./definition"


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
    definitionResource: URI,
    content: string,
    position: Position,
  ): Promise<DefinitionLink[] | undefined> {
    const textDocument = TextDocument.create("test.pgsql", "postgres", 0, content);

    (server.documents as TextDocumentTestManager).set(textDocument)

    await updateFileDefinition(
      server.definitionMap,
      definitionResource,
      (await server.settings.get(textDocument.uri)).defaultSchema,
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
      const definitionResource = getDefinitionFileResource("tables/companies.pgsql")
      const definition = await onDefinition(
        definitionResource, "companies", Position.create(1, 23),
      )
      validateDefinitionLinks(definition, [
        LocationLink.create(
          definitionResource,
          Range.create(0, 39, 5, 1),
          Range.create(2, 13, 2, 22),
        ),
      ])
    })

    it("Definition on table with default schema", async () => {
      const definitionResource = getDefinitionFileResource("tables/public_users.pgsql")
      const definition = await onDefinition(
        definitionResource, "public.users", Position.create(1, 23),
      )
      validateDefinitionLinks(definition, [
        LocationLink.create(
          definitionResource,
          Range.create(0, 42, 6, 1),
          Range.create(2, 13, 2, 25),
        ),
      ])
    })

    it("Definition on table with non-default schema", async () => {
      const definitionResource = getDefinitionFileResource(
        "tables/campaign_participants.pgsql",
      )
      const definition = await onDefinition(
        definitionResource, "campaign.participants", Position.create(1, 23),
      )
      validateDefinitionLinks(definition, [
        LocationLink.create(
          definitionResource,
          Range.create(0, 51, 6, 1),
          Range.create(2, 13, 2, 34),
        ),
      ])
    })

    it("Definition on view", async () => {
      const definitionResource = getDefinitionFileResource("views/deleted_users.pgsql")
      const definition = await onDefinition(
        definitionResource, "deleted_users", Position.create(1, 23),
      )
      validateDefinitionLinks(definition, [
        LocationLink.create(
          definitionResource,
          Range.create(0, 42, 9, 22),
          Range.create(2, 12, 2, 25),
        ),
      ])
    })
  })
})
