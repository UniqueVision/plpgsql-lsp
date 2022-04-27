/* eslint-disable max-len */
import * as assert from "assert"
import dedent from "ts-dedent"
import { Hover, MarkupContent, Position } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { setupTestServer } from "@/__tests__/helpers/server"
import { SettingsBuilder } from "@/__tests__/helpers/settings"
import {
  makeSampleTextDocument,
  TestTextDocuments,
} from "@/__tests__/helpers/textDocuments"
import { Server } from "@/server"
import { Settings } from "@/settings"
import { neverReach } from "@/utilities/neverReach"
import { makeDefinitionLinkMarkdown, makePostgresCodeMarkdown } from "@/utilities/text"


describe("Hover Tests", () => {
  let settings: Settings
  let server: Server

  beforeEach(() => {
    settings = new SettingsBuilder().build()
    server = setupTestServer(settings)
  })

  afterEach(async () => {
    for (const pgPool of server.pgPools.values()) {
      await pgPool.end()
    }
  })

  function makeLinkMarkdown(target: string, table?: string): string {
    const linkMarkdown = makeDefinitionLinkMarkdown(
      target,
      server.definitionsManager,
      table,
    )
    if (linkMarkdown === undefined) neverReach()

    return linkMarkdown
  }

  function updateFileDefinitions(targetFile: string) {
    server.definitionsManager.updateFileDefinitions(
      makeSampleTextDocument(targetFile),
      settings.defaultSchema,
    )
  }

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

  function validateHoverContent(
    hover: Hover | undefined, expectedCode: string,
  ) {
    expect(hover).toBeDefined()
    if (hover === undefined) neverReach()

    assert.strictEqual(MarkupContent.is(hover.contents), true)
    assert.strictEqual((hover.contents as MarkupContent).kind, "markdown")
    assert.strictEqual(
      (hover.contents as MarkupContent).value,
      expectedCode,
    )
  }

  describe("Hover", function () {
    it("Hover on table", async () => {
      updateFileDefinitions("definitions/tables/companies.pgsql")

      const hover = await onHover("companies")

      validateHoverContent(
        hover,
        dedent`
          \`\`\`postgres
          Table public.companies(
            id integer not null,
            name character varying not null
          )
          \`\`\`

          ----------------

          ### Indexes:
          - ${makeLinkMarkdown("companies_pkey", "companies")} PRIMARY KEY, btree (id)
          - ${makeLinkMarkdown("companies_name_key", "companies")} UNIQUE, btree (name)
        `,
      )
    })

    it("Hover on table with default schema", async () => {
      updateFileDefinitions("definitions/tables/public_users.pgsql")
      updateFileDefinitions("definitions/triggers/user_update.pgsql")

      const hover = await onHover("public.users")

      validateHoverContent(
        hover,
        dedent`
        \`\`\`postgres
        Table public.users(
          id integer not null,
          name character varying not null,
          company_id integer not null,
          created_at timestamp with time zone not null default now(),
          updated_at timestamp with time zone not null default now(),
          deleted_at timestamp with time zone
        )
        \`\`\`

        ----------------

        ### Indexes:
        - ${makeLinkMarkdown("users_pkey", "users")} PRIMARY KEY, btree (id)
        - ${makeLinkMarkdown("users_id_name_index")} btree (id, name)

        ### Check constraints:
        - ${makeLinkMarkdown("users_check", "users")} CHECK (deleted_at > created_at)

        ### Foreign key constraints:
        - ${makeLinkMarkdown("users_company_id_fkey", "users")} FOREIGN KEY (company_id) REFERENCES companies(id)

        ### Triggers:
        - ${makeLinkMarkdown("check_update_trigger")} EXECUTE FUNCTION update_user_update_at()
        `,
      )
    })

    it("Hover on table with exclude index", async () => {
      updateFileDefinitions("definitions/tables/schedule.pgsql")

      const hover = await onHover("schedule")

      validateHoverContent(
        hover,
        dedent`
          \`\`\`postgres
          Table public.schedule(
            id integer not null default nextval('schedule_id_seq'::regclass),
            room_name text not null,
            reservation_time tsrange not null
          )
          \`\`\`

          ----------------

          ### Indexes:
          - ${makeLinkMarkdown("schedule_pkey", "schedule")} PRIMARY KEY, btree (id)
          - ${makeLinkMarkdown("schedule_reservation_time_excl", "schedule")} EXCLUDE USING gist (reservation_time)
        `,
      )
    })

    it("Hover on table with non-default schema", async () => {
      updateFileDefinitions("definitions/tables/campaign_participants.pgsql")

      const hover = await onHover("campaign.participants")

      validateHoverContent(
        hover,
        dedent`
          \`\`\`postgres
          Table campaign.participants(
            id integer not null,
            name character varying not null,
            created_at timestamp with time zone not null default now(),
            deleted_at timestamp with time zone
          )
            PARTITION BY HASH (id)
          \`\`\`

          ----------------

          ### Check constraints:
          - ${makeLinkMarkdown("participants_check", "campaign.participants")} CHECK (deleted_at > created_at)
        `,
      )
    })

    it("Hover on table with empty column", async () => {
      const hover = await onHover("empty_table")

      validateHoverContent(
        hover,
        makePostgresCodeMarkdown(
          dedent`
            Table public.empty_table()
          `,
        ),
      )
    })

    it("Hover on view", async () => {
      const hover = await onHover("deleted_users")

      validateHoverContent(
        hover,
        makePostgresCodeMarkdown(
          dedent`
            View public.deleted_users
          `,
        ),
      )
    })

    it("Hover on view with default schema", async () => {
      const hover = await onHover("public.deleted_users")

      validateHoverContent(
        hover,
        makePostgresCodeMarkdown(
          dedent`
            View public.deleted_users
          `,
        ),
      )
    })

    it("Hover on view with non-default schema", async () => {
      const hover = await onHover("campaign.deleted_participants")

      validateHoverContent(
        hover,
        makePostgresCodeMarkdown(
          dedent`
            View campaign.deleted_participants
          `,
        ),
      )
    })

    it("Hover on positional argument function", async () => {
      const hover = await onHover("positional_argument_function")

      validateHoverContent(
        hover,
        makePostgresCodeMarkdown(
          dedent`
            Function public.positional_argument_function(
              integer,
              integer
            )
              RETURNS int4
              LANGUAGE sql
              IMMUTABLE PARALLEL UNSAFE
          `,
        ),
      )
    })

    it("Hover on positional argument function with default schema", async () => {
      const hover = await onHover("public.positional_argument_function")

      validateHoverContent(
        hover,
        makePostgresCodeMarkdown(
          dedent`
            Function public.positional_argument_function(
              integer,
              integer
            )
              RETURNS int4
              LANGUAGE sql
              IMMUTABLE PARALLEL UNSAFE
          `,
        ),
      )
    })

    it("Hover on keyword argument function", async () => {
      const hover = await onHover("keyword_argument_function")

      validateHoverContent(
        hover,
        makePostgresCodeMarkdown(
          dedent`
            Function public.keyword_argument_function(
              i integer
            )
              RETURNS int4
              LANGUAGE plpgsql
              VOLATILE PARALLEL UNSAFE
          `,
        ),
      )
    })

    it("Hover on built-in function", async () => {
      const hover = await onHover("jsonb_build_object")

      validateHoverContent(
        hover,
        makePostgresCodeMarkdown(
          dedent`
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
          `,
        ),
      )
    })

    it("Hover on proceduren", async () => {
      const hover = await onHover("correct_procedure")

      validateHoverContent(
        hover,
        makePostgresCodeMarkdown(
          dedent`
            Function public.correct_procedure(
              INOUT p1 text
            )
              RETURNS record
              LANGUAGE plpgsql
              VOLATILE PARALLEL UNSAFE
          `,
        ),
      )
    })

    it("Hover on constant function", async () => {
      const hover = await onHover("constant_function")

      validateHoverContent(
        hover,
        makePostgresCodeMarkdown(
          dedent`
            Function public.constant_function()
              RETURNS text
              LANGUAGE plpgsql
              IMMUTABLE PARALLEL SAFE
          `,
        ),
      )
    })

    it("Hover on type", async () => {
      const hover = await onHover("type_user")

      validateHoverContent(
        hover,
        makePostgresCodeMarkdown(
          dedent`
            Type public.type_user(
              id uuid,
              name text
            )
          `,
        ),
      )
    })

    it("Hover on type with default schema", async () => {
      const hover = await onHover("public.type_user")

      validateHoverContent(
        hover,
        makePostgresCodeMarkdown(
          dedent`
            Type public.type_user(
              id uuid,
              name text
            )
          `,
        ),
      )
    })

    it("Hover on the single field type", async () => {
      const hover = await onHover("type_single_field")

      validateHoverContent(
        hover,
        makePostgresCodeMarkdown(
          dedent`
            Type public.type_single_field(
              id uuid
            )
          `,
        ),
      )
    })

    it("Hover on type with empty column", async () => {
      const hover = await onHover("public.type_empty")

      validateHoverContent(
        hover,
        makePostgresCodeMarkdown(
          dedent`
            Type public.type_empty()
          `,
        ),
      )
    })

    it("Hover on index", async () => {
      const hover = await onHover("users_id_name_index")

      validateHoverContent(
        hover,
        makePostgresCodeMarkdown(
          dedent`
            Index users_id_name_index
          `,
        ),
      )
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
