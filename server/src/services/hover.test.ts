/* eslint-disable max-len */
import dedent from "ts-dedent"
import { Hover, MarkupContent, Position } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { setupTestServer } from "@/__tests__/helpers/server"
import { SettingsBuilder } from "@/__tests__/helpers/settings"
import {
  loadSampleTextDocument,
  TestTextDocuments,
} from "@/__tests__/helpers/textDocuments"
import { Server } from "@/server"
import { Settings } from "@/settings"
import { neverReach } from "@/utilities/neverReach"
import { makeDefinitionLinkMarkdown, makePostgresCodeMarkdown } from "@/utilities/text"

jest.setTimeout(10000)

expect.extend({
  toHoverCodeEqual(
    hover: Hover | undefined, expectedCode: string,
  ) {
    expect(hover).toBeDefined()
    if (hover === undefined) neverReach()

    if (MarkupContent.is(hover.contents)
      && (hover.contents as MarkupContent).kind === "markdown" &&
      (hover.contents as MarkupContent).value === expectedCode) {
      return {
        pass: true,
        message: () =>
          `expected not to equal Hover code ${expectedCode}`,
      }
    }
    else {
      return {
        pass: false,
        message: () =>
          `expected to equal Hover code ${expectedCode}`,
      }
    }
  },
})

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

  async function updateDocumentDefinitions(targetFile: string) {
    server.definitionsManager.updateDocumentDefinitions(
      await loadSampleTextDocument(targetFile), settings, server.logger,
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

  describe("Hover", function () {
    it("Hover on table", async () => {
      await updateDocumentDefinitions("definitions/table/companies.pgsql")

      const hover = await onHover("companies")

      expect(hover).toHoverCodeEqual(
        dedent`
          \`\`\`postgres
          TABLE public.companies(
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
      await updateDocumentDefinitions("definitions/table/public_users.pgsql")
      await updateDocumentDefinitions("definitions/trigger/user_update.pgsql")
      await updateDocumentDefinitions("definitions/index/users_id_name_index.pgsql")

      const hover = await onHover("public.users")

      expect(hover).toHoverCodeEqual(
        dedent`
        \`\`\`postgres
        TABLE public.users(
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

    it("Hover on table without index", async () => {
      await updateDocumentDefinitions("definitions/table/schedule.pgsql")

      const hover = await onHover("schedule")

      expect(hover).toHoverCodeEqual(
        dedent`
          \`\`\`postgres
          TABLE public.schedule(
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
      await updateDocumentDefinitions("definitions/table/campaign_participants.pgsql")

      const hover = await onHover("campaign.participants")

      expect(hover).toHoverCodeEqual(
        dedent`
          \`\`\`postgres
          TABLE campaign.participants(
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

    it("Hover on empty column table", async () => {
      await updateDocumentDefinitions("definitions/table/empty_table.pgsql")

      const hover = await onHover("empty_table")

      expect(hover).toHoverCodeEqual(
        makePostgresCodeMarkdown(
          dedent`
            TABLE public.empty_table()
          `,
        ),
      )
    })

    it("Hover on view", async () => {
      await updateDocumentDefinitions("definitions/view/deleted_users.pgsql")

      const hover = await onHover("deleted_users")

      expect(hover).toHoverCodeEqual(
        makePostgresCodeMarkdown(
          dedent`
            VIEW public.deleted_users
          `,
        ),
      )
    })

    it("Hover on view with default schema", async () => {
      await updateDocumentDefinitions("definitions/view/deleted_users.pgsql")

      const hover = await onHover("public.deleted_users")

      expect(hover).toHoverCodeEqual(
        makePostgresCodeMarkdown(
          dedent`
            VIEW public.deleted_users
          `,
        ),
      )
    })

    it("Hover on view with non-default schema", async () => {
      await updateDocumentDefinitions("definitions/view/campaign_deleted_participants.pgsql")

      const hover = await onHover("campaign.deleted_participants")

      expect(hover).toHoverCodeEqual(
        makePostgresCodeMarkdown(
          dedent`
            VIEW campaign.deleted_participants
          `,
        ),
      )
    })

    it("Hover on materialized view", async () => {
      await updateDocumentDefinitions("definitions/materialized_view/my_users.pgsql")

      const hover = await onHover("my_users")

      expect(hover).toHoverCodeEqual(
        makePostgresCodeMarkdown(
          dedent`
            MATERIALIZED VIEW public.my_users
          `,
        ),
      )
    })

    it("Hover on positional argument function", async () => {
      await updateDocumentDefinitions("definitions/function/positional_argument_function.pgsql")

      const hover = await onHover("positional_argument_function")

      expect(hover).toHoverCodeEqual(
        makePostgresCodeMarkdown(
          dedent`
            FUNCTION public.positional_argument_function(
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
      await updateDocumentDefinitions("definitions/function/positional_argument_function.pgsql")

      const hover = await onHover("public.positional_argument_function")

      expect(hover).toHoverCodeEqual(
        makePostgresCodeMarkdown(
          dedent`
            FUNCTION public.positional_argument_function(
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
      await updateDocumentDefinitions("definitions/function/keyword_argument_function.pgsql")

      const hover = await onHover("keyword_argument_function")

      expect(hover).toHoverCodeEqual(
        makePostgresCodeMarkdown(
          dedent`
            FUNCTION public.keyword_argument_function(
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

      expect(hover).toHoverCodeEqual(
        makePostgresCodeMarkdown(
          dedent`
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
          `,
        ),
      )
    })

    it("Hover on proceduren", async () => {
      await updateDocumentDefinitions("definitions/procedure/correct_procedure.pgsql")

      const hover = await onHover("correct_procedure")

      expect(hover).toHoverCodeEqual(
        makePostgresCodeMarkdown(
          dedent`
            FUNCTION public.correct_procedure(
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
      await updateDocumentDefinitions("definitions/function/constant_function.pgsql")

      const hover = await onHover("constant_function")

      expect(hover).toHoverCodeEqual(
        makePostgresCodeMarkdown(
          dedent`
            FUNCTION public.constant_function()
              RETURNS text
              LANGUAGE plpgsql
              IMMUTABLE PARALLEL SAFE
          `,
        ),
      )
    })

    it("Hover on type", async () => {
      await updateDocumentDefinitions("definitions/type/type_user.pgsql")

      const hover = await onHover("type_user")

      expect(hover).toHoverCodeEqual(
        makePostgresCodeMarkdown(
          dedent`
            TYPE public.type_user(
              id uuid,
              name text
            )
          `,
        ),
      )
    })

    it("Hover on type with default schema", async () => {
      await updateDocumentDefinitions("definitions/type/type_user.pgsql")

      const hover = await onHover("public.type_user")

      expect(hover).toHoverCodeEqual(
        makePostgresCodeMarkdown(
          dedent`
            TYPE public.type_user(
              id uuid,
              name text
            )
          `,
        ),
      )
    })

    it("Hover on the single field type", async () => {
      await updateDocumentDefinitions("definitions/type/type_single_field.pgsql")

      const hover = await onHover("type_single_field")

      expect(hover).toHoverCodeEqual(
        makePostgresCodeMarkdown(
          dedent`
            TYPE public.type_single_field(
              id uuid
            )
          `,
        ),
      )
    })

    it("Hover on type with empty column", async () => {
      await updateDocumentDefinitions("definitions/type/type_empty.pgsql")

      const hover = await onHover("public.type_empty")

      expect(hover).toHoverCodeEqual(
        makePostgresCodeMarkdown(
          dedent`
            TYPE public.type_empty()
          `,
        ),
      )
    })

    it("Hover on domain", async () => {
      await updateDocumentDefinitions("definitions/domain/us_postal_code.pgsql")

      const hover = await onHover("us_postal_code")

      expect(hover).toHoverCodeEqual(
        makePostgresCodeMarkdown(
          dedent`
            DOMAIN public.us_postal_code AS text
          `,
        ),
      )
    })

    it("Hover on domain with default schema", async () => {
      await updateDocumentDefinitions("definitions/domain/jp_postal_code.pgsql")

      const hover = await onHover("public.jp_postal_code")

      expect(hover).toHoverCodeEqual(
        makePostgresCodeMarkdown(
          dedent`
            DOMAIN public.jp_postal_code AS text
          `,
        ),
      )
    })

    it("Hover on index", async () => {
      await updateDocumentDefinitions("definitions/table/public_users.pgsql")

      const hover = await onHover("users_id_name_index")

      expect(hover).toHoverCodeEqual(
        makePostgresCodeMarkdown(
          dedent`
            INDEX users_id_name_index
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
