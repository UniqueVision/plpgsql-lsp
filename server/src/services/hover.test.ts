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
        Table public.companies(
          id integer not null,
          name character varying not null
        )

        Indexes:
          "companies_pkey" PRIMARY KEY, btree (id)
          "companies_name_key" UNIQUE, btree (name)
      `)
    })

    it("Hover on table with default schema", async () => {
      const hover = await onHover("public.users")

      validatePostgresCodeMarkdown(hover, dedent`
        Table public.users(
          id integer not null,
          name character varying not null,
          company_id integer not null,
          created_at timestamp with time zone not null default now(),
          deleted_at timestamp with time zone
        )

        Indexes:
          "users_pkey" PRIMARY KEY, btree (id)
          "users_id_name_index" btree (id, name)

        Check constraints:
          "users_check" CHECK (deleted_at > created_at)

        Foreign key constraints:
          "users_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id)
      `)
    })

    it("Hover on table with exclude index", async () => {
      const hover = await onHover("schedule")

      validatePostgresCodeMarkdown(hover, dedent`
        Table public.schedule(
          id integer not null default nextval('schedule_id_seq'::regclass),
          room_name text not null,
          reservation_time tsrange not null
        )

        Indexes:
          "schedule_pkey" PRIMARY KEY, btree (id)
          "schedule_reservation_time_excl" EXCLUDE USING gist (reservation_time)
      `)
    })

    it("Hover on table with non-default schema", async () => {
      const hover = await onHover("campaign.participants")

      validatePostgresCodeMarkdown(hover, dedent`
        Table campaign.participants(
          id integer not null,
          name character varying not null,
          created_at timestamp with time zone not null default now(),
          deleted_at timestamp with time zone
        )
          PARTITION BY HASH (id)

        Check constraints:
          "participants_check" CHECK (deleted_at > created_at)
      `)
    })

    it("Hover on table with empty column", async () => {
      const hover = await onHover("empty_table")

      validatePostgresCodeMarkdown(hover, dedent`
        Table public.empty_table()
      `)
    })

    it("Hover on view", async () => {
      const hover = await onHover("deleted_users")

      validatePostgresCodeMarkdown(hover, dedent`
        View public.deleted_users
      `)
    })

    it("Hover on view with default schema", async () => {
      const hover = await onHover("public.deleted_users")

      validatePostgresCodeMarkdown(hover, dedent`
        View public.deleted_users
      `)
    })

    it("Hover on view with non-default schema", async () => {
      const hover = await onHover("campaign.deleted_participants")

      validatePostgresCodeMarkdown(hover, dedent`
        View campaign.deleted_participants
      `)
    })

    it("Hover on positional argument function", async () => {
      const hover = await onHover("positional_argument_function")

      validatePostgresCodeMarkdown(hover, dedent`
        Function public.positional_argument_function(
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
        Function public.positional_argument_function(
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
        Function public.keyword_argument_function(
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
        Function pg_catalog.jsonb_build_object()
          RETURNS jsonb
          LANGUAGE internal
          STABLE PARALLEL SAFE

        Function pg_catalog.jsonb_build_object(
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
        Function public.correct_procedure(
          INOUT p1 text
        )
          RETURNS record
          LANGUAGE plpgsql
          VOLATILE PARALLEL UNSAFE
      `)
    })

    it("Hover on constant function", async () => {
      const hover = await onHover("constant_function")

      validatePostgresCodeMarkdown(hover, dedent`
        Function public.constant_function()
          RETURNS text
          LANGUAGE plpgsql
          IMMUTABLE PARALLEL SAFE
      `)
    })

    it("Hover on type", async () => {
      const hover = await onHover("type_user")

      validatePostgresCodeMarkdown(hover, dedent`
        Type public.type_user(
          id uuid,
          name text
        )
      `)
    })

    it("Hover on type with default schema", async () => {
      const hover = await onHover("public.type_user")

      validatePostgresCodeMarkdown(hover, dedent`
        Type public.type_user(
          id uuid,
          name text
        )
      `)
    })

    it("Hover on the single field type", async () => {
      const hover = await onHover("type_single_field")

      validatePostgresCodeMarkdown(hover, dedent`
        Type public.type_single_field(
          id uuid
        )
      `)
    })

    it("Hover on type with empty column", async () => {
      const hover = await onHover("public.type_empty")

      validatePostgresCodeMarkdown(hover, dedent`
        Type public.type_empty()
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
