import * as assert from "assert"
import dedent from "ts-dedent"
import { CompletionItem, Position } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { setupTestServer } from "@/__tests__/helpers/server"
import { SettingsBuilder } from "@/__tests__/helpers/settings"
import { TestTextDocuments } from "@/__tests__/helpers/textDocuments"
import { Server } from "@/server/server"

import { getDisableCommentCompletionItems } from "./completion"


describe("Completion Tests", () => {
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

  async function onCompletion(
    content: string, position: Position,
  ): Promise<CompletionItem[] | undefined> {
    const document = TextDocument.create("test.pgsql", "postgres", 0, content);

    (server.documents as TestTextDocuments).set(document)

    if (server.handlers === undefined) {
      throw new Error("handlers is undefined")
    }

    return server.handlers.onCompletion({
      position,
      textDocument: document,
    })
  }

  function validateCompletionItems(
    definitoins: CompletionItem[] | undefined,
    expected: CompletionItem[],
  ) {
    expect(definitoins).toBeDefined()
    if (definitoins === undefined) return

    assert.deepEqual(definitoins, expected)
  }

  describe("Completion", function () {
    it("Completion items exist", async () => {
      const completions = await onCompletion(
        "companies", Position.create(1, 1),
      )
      assert.ok(completions && completions.length > 1)
    })

    it("Disable comment completion", async () => {
      const completions = await onCompletion(
        "-- ", Position.create(0, 0),
      )

      validateCompletionItems(
        completions,
        getDisableCommentCompletionItems(),
      )
    })

    it("Disable block comment completion", async () => {
      const completions = await onCompletion(
        "/* ", Position.create(0, 0),
      )

      validateCompletionItems(
        completions,
        getDisableCommentCompletionItems(),
      )
    })

    it("Completion with language servcer disable comment", async () => {
      const completions = await onCompletion(
        dedent`
          -- plpgsql-language-server:disable

          companies
        `,
        Position.create(3, 0),
      )
      expect(completions).toBeUndefined()
    })

    it("Completion with language servcer disable block comment", async () => {
      const completions = await onCompletion(
        dedent`
          /* plpgsql-language-server:disable */

          companies
        `,
        Position.create(3, 0),
      )
      expect(completions).toBeUndefined()
    })
  })
})
