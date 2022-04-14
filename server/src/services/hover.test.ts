import * as assert from "assert"
import dedent from "ts-dedent"
import { Hover, MarkupContent, Position } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { setupTestServer } from "@/__tests__/helpers/server"
import { SettingsBuilder } from "@/__tests__/helpers/settings"
import { TestTextDocuments } from "@/__tests__/helpers/textDocuments"
import { Server } from "@/server"
import { neverReach } from "@/utilities/neverReach"
import { makePostgresCodeMarkdown } from "@/utilities/text"


describe("Hover Tests", () => {
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

  async function onHover(
    content: string,
    position = Position.create(1, 1),
  ): Promise<Hover | undefined> {
    const document = TextDocument.create("test.pgsql", "postgres", 0, content);

    (server.documents as TestTextDocuments).set(document)

    if (server.handlers === undefined) {
      throw new Error("handlers is undefined")
    }

    return server.handlers.onHover({
      textDocument: document,
      position,
    })
  }

  function validatePostgresCodeMarkdown(
    hover: Hover | undefined, expectedCode: string,
  ) {
    expect(hover).toBeDefined()
    if (hover === undefined) neverReach()

    assert.strictEqual(MarkupContent.is(hover.contents), true)
    assert.strictEqual((hover.contents as MarkupContent).kind, "markdown")
    assert.strictEqual(
      (hover.contents as MarkupContent).value,
      makePostgresCodeMarkdown(expectedCode),
    )
  }

  describe("Hover", function () {
    it("Hover on table", async () => {
      const hover = await onHover("companies")

      validatePostgresCodeMarkdown(hover, dedent`
        TABLE public.companies(
          id integer,
          name character varying
        )
      `)
    })

    it("Hover on table with default schema", async () => {
      const hover = await onHover("public.users")

      validatePostgresCodeMarkdown(hover, dedent`
        TABLE public.users(
          id integer,
          name character varying,
          deleted_at timestamp with time zone
        )
      `)
    })

    it("Hover on table with non-default schema", async () => {
      const hover = await onHover("campaign.participants")

      validatePostgresCodeMarkdown(hover, dedent`
        TABLE campaign.participants(
          id integer,
          name character varying,
          deleted_at timestamp with time zone
        )
      `)
    })

    it("Hover on view", async () => {
      const hover = await onHover("deleted_users")

      validatePostgresCodeMarkdown(hover, dedent`
        VIEW public.deleted_users
      `)
    })

    it("Hover on view with default schema", async () => {
      const hover = await onHover("public.deleted_users")

      validatePostgresCodeMarkdown(hover, dedent`
        VIEW public.deleted_users
      `)
    })

    it("Hover on view with non-default schema", async () => {
      const hover = await onHover("campaign.deleted_participants")

      validatePostgresCodeMarkdown(hover, dedent`
        VIEW campaign.deleted_participants
      `)
    })

    it("Hover on positional argument function", async () => {
      const hover = await onHover("positional_argument_function")

      validatePostgresCodeMarkdown(hover, dedent`
        FUNCTION public.positional_argument_function(
          integer,
          integer
        )
          RETURNS int4
          LANGUAGE sql
          IMMUTABLE PARALLEL UNSAFE
      `)
    })

    it("Hover on positional argument function with default schema", async () => {
      const hover = await onHover("public.positional_argument_function")

      validatePostgresCodeMarkdown(hover, dedent`
        FUNCTION public.positional_argument_function(
          integer,
          integer
        )
          RETURNS int4
          LANGUAGE sql
          IMMUTABLE PARALLEL UNSAFE
      `)
    })

    it("Hover on keyword argument function", async () => {
      const hover = await onHover("keyword_argument_function")

      validatePostgresCodeMarkdown(hover, dedent`
        FUNCTION public.keyword_argument_function(
          i integer
        )
          RETURNS int4
          LANGUAGE plpgsql
          VOLATILE PARALLEL UNSAFE
      `)
    })

    it("Hover on built-in function", async () => {
      const hover = await onHover("jsonb_build_object")

      validatePostgresCodeMarkdown(hover, dedent`
        FUNCTION pg_catalog.jsonb_build_object()
          RETURNS jsonb
          LANGUAGE internal
          STABLE PARALLEL SAFE

        FUNCTION pg_catalog.jsonb_build_object(
          VARIADIC "any"
        )
          RETURNS jsonb
          LANGUAGE internal
          STABLE PARALLEL SAFE
      `)
    })

    it("Hover on proceduren", async () => {
      const hover = await onHover("correct_procedure")

      validatePostgresCodeMarkdown(hover, dedent`
        FUNCTION public.correct_procedure(
          INOUT p1 text
        )
          RETURNS record
          LANGUAGE plpgsql
          VOLATILE PARALLEL UNSAFE
      `)
    })

    it("Hover on type", async () => {
      const hover = await onHover("type_user")

      validatePostgresCodeMarkdown(hover, dedent`
        TYPE public.type_user(
          id uuid
        )
      `)
    })

    it("Hover on type with default schema", async () => {
      const hover = await onHover("public.type_user")

      validatePostgresCodeMarkdown(hover, dedent`
        TYPE public.type_user(
          id uuid
        )
      `)
    })

    it("Hover with language server disable comment", async () => {
      const hover = await onHover(
        dedent`
          -- plpgsql-language-server:disable

          public.type_user
        `,
        Position.create(3, 0),
      )

      expect(hover).toBeUndefined()
    })

    it("Hover with language server disable block comment", async () => {
      const hover = await onHover(
        dedent`
          /* plpgsql-language-server:disable */

          public.type_user
        `,
        Position.create(3, 0),
      )

      expect(hover).toBeUndefined()
    })
  })
})
