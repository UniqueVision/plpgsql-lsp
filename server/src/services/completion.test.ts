import * as assert from "assert"
import dedent from "ts-dedent"
import {
  CompletionItem,
  CompletionItemKind,
  InsertTextFormat,
  Position,
} from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { setupTestServer } from "@/__tests__/helpers/server"
import { SettingsBuilder } from "@/__tests__/helpers/settings"
import { TestTextDocuments } from "@/__tests__/helpers/textDocuments"
import { Server } from "@/server"
import { neverReach } from "@/utilities/neverReach"

import { getLanguageServerCommentCompletionItems } from "./completion"


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

  function validateCompletionItem(
    completions: CompletionItem[] | undefined,
    expected: CompletionItem,
  ) {
    expect(completions).toBeDefined()
    if (completions === undefined) neverReach()

    const completion = completions?.find(x => x.label === expected.label)
    if (completion === undefined) neverReach()

    assert.deepEqual(
      (({ data: _data, ...target }) => target)(completion),
      expected,
    )
  }

  function validateCompletionItems(
    definitoins: CompletionItem[] | undefined,
    expected: CompletionItem[],
  ) {
    expect(definitoins).toBeDefined()
    if (definitoins === undefined) neverReach()

    assert.deepEqual(definitoins, expected)
  }

  describe("Completion", function () {
    it("Completion on table", async () => {
      const completions = await onCompletion(
        "companies", Position.create(1, 1),
      )
      validateCompletionItem(
        completions,
        {
          label: "companies",
          kind: CompletionItemKind.Class,
          detail: dedent`
            TABLE public.companies(
              id integer not null,
              name character varying not null
            )
          `,
        },
      )
    })

    it("Completion on table with default schema", async () => {
      const completions = await onCompletion(
        "public.users", Position.create(1, 10),
      )
      validateCompletionItem(
        completions,
        {
          label: "users",
          kind: CompletionItemKind.Class,
          detail: dedent`
            TABLE public.users(
              id integer not null,
              name character varying not null,
              company_id integer not null,
              created_at timestamp with time zone not null default now(),
              updated_at timestamp with time zone not null default now(),
              deleted_at timestamp with time zone
            )
          `,
        },
      )
    })

    it("Completion on table with exclude index", async () => {
      const completions = await onCompletion(
        "schedule", Position.create(1, 1),
      )
      validateCompletionItem(
        completions,
        {
          label: "schedule",
          kind: CompletionItemKind.Class,
          detail: dedent`
            TABLE public.schedule(
              id integer not null default nextval('schedule_id_seq'::regclass),
              room_name text not null,
              reservation_time tsrange not null
            )
          `,
        },
      )
    })

    it("Completion on table with non-default schema", async () => {
      const completions = await onCompletion(
        "campaign.participants", Position.create(1, 10),
      )
      validateCompletionItem(
        completions,
        {
          label: "participants",
          kind: CompletionItemKind.Class,
          detail: dedent`
            TABLE campaign.participants(
              id integer not null,
              name character varying not null,
              created_at timestamp with time zone not null default now(),
              deleted_at timestamp with time zone
            )
          `,
        },
      )
    })

    it("Completion on table with empty column", async () => {
      const completions = await onCompletion(
        "empty_table", Position.create(1, 1),
      )
      validateCompletionItem(
        completions,
        {
          label: "empty_table",
          kind: CompletionItemKind.Class,
          detail: dedent`
            TABLE public.empty_table()
          `,
        },
      )
    })

    it("Completion on view", async () => {
      const completions = await onCompletion(
        "deleted_users", Position.create(1, 1),
      )
      validateCompletionItem(
        completions,
        {
          label: "deleted_users",
          kind: CompletionItemKind.Class,
          detail: dedent`
            VIEW public.deleted_users
          `,
        },
      )
    })

    it("Completion on view with default schema", async () => {
      const completions = await onCompletion(
        "public.deleted_users", Position.create(1, 10),
      )
      validateCompletionItem(
        completions,
        {
          label: "deleted_users",
          kind: CompletionItemKind.Class,
          detail: dedent`
            VIEW public.deleted_users
          `,
        },
      )
    })

    it("Completion on view with non-default schema", async () => {
      const completions = await onCompletion(
        "campaign.deleted_participants", Position.create(1, 10),
      )
      validateCompletionItem(
        completions,
        {
          label: "deleted_participants",
          kind: CompletionItemKind.Class,
          detail: dedent`
            VIEW campaign.deleted_participants
          `,
        },
      )
    })

    it("Completion on materialized view", async () => {
      const completions = await onCompletion(
        "my_users", Position.create(1, 1),
      )
      validateCompletionItem(
        completions,
        {
          label: "my_users",
          kind: CompletionItemKind.Class,
          detail: dedent`
            MATERIALIZED VIEW public.my_users
          `,
        },
      )
    })

    it("Completion on positional argument function", async () => {
      const completions = await onCompletion(
        "positional_argument_function", Position.create(1, 1),
      )
      validateCompletionItem(
        completions,
        {
          label: "positional_argument_function",
          kind: CompletionItemKind.Function,
          detail: dedent`
            FUNCTION public.positional_argument_function(
              integer,
              integer
            )
              RETURNS int4
              LANGUAGE sql
              IMMUTABLE PARALLEL UNSAFE
          `,
          insertTextFormat: InsertTextFormat.Snippet,
          insertText: dedent`
            positional_argument_function(
              $\{1:integer},
              $\{2:integer}
            )
          `,
        },
      )
    })

    it("Completion on positional argument function with default schema", async () => {
      const completions = await onCompletion(
        "public.positional_argument_function", Position.create(1, 10),
      )
      validateCompletionItem(
        completions,
        {
          label: "positional_argument_function",
          kind: CompletionItemKind.Function,
          detail: dedent`
            FUNCTION public.positional_argument_function(
              integer,
              integer
            )
              RETURNS int4
              LANGUAGE sql
              IMMUTABLE PARALLEL UNSAFE
          `,
          insertTextFormat: InsertTextFormat.Snippet,
          insertText: dedent`
            positional_argument_function(
              $\{1:integer},
              $\{2:integer}
            )
          `,
        },
      )
    })

    it("Completion on keyword argument function", async () => {
      const completions = await onCompletion(
        "keyword_argument_function", Position.create(1, 1),
      )
      validateCompletionItem(
        completions,
        {
          label: "keyword_argument_function",
          kind: CompletionItemKind.Function,
          detail: dedent`
            FUNCTION public.keyword_argument_function(
              i integer
            )
              RETURNS int4
              LANGUAGE plpgsql
              VOLATILE PARALLEL UNSAFE
          `,
          insertTextFormat: InsertTextFormat.Snippet,
          insertText: dedent`
            keyword_argument_function(
              i := $\{1:i}
            )
          `,
        },
      )
    })

    it("Completion on built-in function", async () => {
      const completions = await onCompletion(
        "jsonb_build_object", Position.create(1, 1),
      )
      validateCompletionItem(
        completions,
        {
          label: "jsonb_build_object",
          kind: CompletionItemKind.Function,
          detail: dedent`
            FUNCTION pg_catalog.jsonb_build_object(
              VARIADIC \"any\"
            )
              RETURNS jsonb
              LANGUAGE internal
              STABLE PARALLEL SAFE
          `,
          insertTextFormat: InsertTextFormat.Snippet,
          insertText: dedent`
            jsonb_build_object(
              $\{1:VARIADIC}
            )
          `,
        },
      )
    })

    it("Completion on proceduren", async () => {
      const completions = await onCompletion(
        "correct_procedure", Position.create(1, 1),
      )
      validateCompletionItem(
        completions,
        {
          label: "correct_procedure",
          kind: CompletionItemKind.Function,
          detail: dedent`
            FUNCTION public.correct_procedure(
              INOUT p1 text
            )
              RETURNS record
              LANGUAGE plpgsql
              VOLATILE PARALLEL UNSAFE
          `,
          insertTextFormat: InsertTextFormat.Snippet,
          insertText: dedent`
            correct_procedure(
              INOUT := $\{1:INOUT}
            )
          `,
        },
      )
    })

    it("Completion on constant proceduren", async () => {
      const completions = await onCompletion(
        "constant_function", Position.create(1, 1),
      )
      validateCompletionItem(
        completions,
        {
          label: "constant_function",
          kind: CompletionItemKind.Function,
          detail: dedent`
            FUNCTION public.constant_function()
              RETURNS text
              LANGUAGE plpgsql
              IMMUTABLE PARALLEL SAFE
          `,
          insertTextFormat: InsertTextFormat.Snippet,
          insertText: dedent`
            constant_function()
          `,
        },
      )
    })

    it("Completion on type", async () => {
      const completions = await onCompletion(
        "type_user", Position.create(1, 1),
      )
      validateCompletionItem(
        completions,
        {
          label: "type_user",
          kind: CompletionItemKind.Struct,
          detail: dedent`
            TYPE public.type_user(
              id uuid,
              name text
            )
          `,
        },
      )
    })

    it("Completion on type with default schema", async () => {
      const completions = await onCompletion(
        "public.type_user", Position.create(1, 10),
      )
      validateCompletionItem(
        completions,
        {
          label: "type_user",
          kind: CompletionItemKind.Struct,
          detail: dedent`
            TYPE public.type_user(
              id uuid,
              name text
            )
          `,
        },
      )
    })

    it("Completion on the single field type", async () => {
      const completions = await onCompletion(
        "type_single_field", Position.create(1, 1),
      )
      validateCompletionItem(
        completions,
        {
          label: "type_single_field",
          kind: CompletionItemKind.Struct,
          detail: dedent`
            TYPE public.type_single_field(
              id uuid
            )
          `,
        },
      )
    })

    it("Completion on type with empty column", async () => {
      const completions = await onCompletion(
        "public.type_empty", Position.create(1, 10),
      )
      validateCompletionItem(
        completions,
        {
          label: "type_empty",
          kind: CompletionItemKind.Struct,
          detail: dedent`
            TYPE public.type_empty()
          `,
        },
      )
    })

    it("Completion on domain", async () => {
      const completions = await onCompletion(
        "us_postal_code", Position.create(1, 1),
      )
      validateCompletionItem(
        completions,
        {
          label: "us_postal_code",
          kind: CompletionItemKind.Struct,
          detail: dedent`
            DOMAIN public.us_postal_code AS text
          `,
        },
      )
    })

    it("Completion on domain with default schema", async () => {
      const completions = await onCompletion(
        "public.jp_postal_code", Position.create(1, 10),
      )
      validateCompletionItem(
        completions,
        {
          label: "jp_postal_code",
          kind: CompletionItemKind.Struct,
          detail: dedent`
            DOMAIN public.jp_postal_code AS text
          `,
        },
      )
    })

    it("Disable comment completion", async () => {
      const completions = await onCompletion(
        "-- ", Position.create(0, 0),
      )

      validateCompletionItems(
        completions,
        getLanguageServerCommentCompletionItems(),
      )
    })

    it("Disable block comment completion", async () => {
      const completions = await onCompletion(
        "/* ", Position.create(0, 0),
      )

      validateCompletionItems(
        completions,
        getLanguageServerCommentCompletionItems(),
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
