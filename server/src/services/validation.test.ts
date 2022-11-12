import { Diagnostic, DiagnosticSeverity, Range } from "vscode-languageserver"

import { DEFAULT_LOAD_FILE_OPTIONS, LoadFileOptions } from "@/__tests__/helpers/file"
import { RecordLogger } from "@/__tests__/helpers/logger"
import { setupTestServer } from "@/__tests__/helpers/server"
import { SettingsBuilder } from "@/__tests__/helpers/settings"
import {
  loadSampleTextDocument,
  TestTextDocuments,
} from "@/__tests__/helpers/textDocuments"
import {
  KeywordQueryParameterPatternNotDefinedError,
} from "@/postgres/parameters/keywordParameters"
import { Server } from "@/server"

describe("Validate Tests", () => {
  let server: Server

  afterEach(async () => {
    for (const pgPool of server.pgPools.values()) {
      await pgPool.end()
    }
  })

  async function validateSampleFile(
    file: string,
    options: LoadFileOptions = DEFAULT_LOAD_FILE_OPTIONS,
  ): Promise<Diagnostic[] | undefined> {
    const document = await loadSampleTextDocument(
      file,
      options,
    );

    (server.documents as TestTextDocuments).set(document)

    if (server.handlers === undefined) {
      throw new Error("handlers is undefined")
    }

    return server.handlers.validate(document)
  }

  describe("File Validation", function () {
    beforeEach(() => {
      const settings = new SettingsBuilder().build()
      server = setupTestServer(settings, new RecordLogger())
    })

    it("Correct function", async () => {
      const diagnostics = await validateSampleFile(
        "definitions/function/correct_function.pgsql",
      )

      expect(diagnostics).toStrictEqual([])
    })

    it("FUNCTION has unused variable", async () => {
      const diagnostics = await validateSampleFile(
        "definitions/function/static_analysis_warning_function_unused_variable.pgsql",
      )

      expect(diagnostics).toStrictEqual([
        {
          severity: DiagnosticSeverity.Warning,
          message: 'unused variable "w_id"',
          range: Range.create(7, 2, 7, 12),
        },
      ])
    })

    it("FUNCTION column does not exists", async () => {
      const diagnostics = await validateSampleFile(
        "definitions/function/syntax_error_function_column_does_not_exist.pgsql",
        { skipDisableComment: true },
      )

      expect(diagnostics).toStrictEqual([
        {
          severity: DiagnosticSeverity.Error,
          message: 'column "tags" does not exist',
          range: Range.create(13, 4, 13, 9),
        },
      ])
    })

    it("Correct query", async () => {
      const diagnostics = await validateSampleFile(
        "queries/correct_query.pgsql",
      )

      expect(diagnostics).toStrictEqual([])
    })

    it("Syntax error query", async () => {
      const diagnostics = await validateSampleFile(
        "queries/syntax_error_query_with_language_server_disable_comment.pgsql",
        { skipDisableComment: true },
      )

      expect(diagnostics).toStrictEqual([
        {
          severity: DiagnosticSeverity.Error,
          message: 'column "tags" does not exist',
          range: Range.create(3, 2, 3, 3),
        },
      ])
    })

    it("Syntax error query with language server disable comment.", async () => {
      const diagnostics = await validateSampleFile(
        "queries/syntax_error_query_with_language_server_disable_comment.pgsql",
      )

      expect(diagnostics).toBeUndefined()
    })

    it("Syntax error query with language server disable block comment.", async () => {
      const diagnostics = await validateSampleFile(
        "queries/syntax_error_query_with_language_server_disable_block_comment.pgsql",
      )

      expect(diagnostics).toBeUndefined()
    })

    it(
      "Syntax error query with language server validation disable comment.",
      async () => {
        const diagnostics = await validateSampleFile(
          "queries/"
          + "syntax_error_query_with_language_server_disable_validation_comment.pgsql",
        )

        expect(diagnostics).toBeUndefined()
      },
    )

    it(
      "Syntax error query with language server validation disable block comment.",
      async () => {
        const diagnostics = await validateSampleFile(
          "queries/syntax_error_query"
          + "_with_language_server_disable_validation_block_comment.pgsql",
        )

        expect(diagnostics).toBeUndefined()
      },
    )

    it(
      "Raise KeywordQueryParameterPatternNotDefinedError.",
      async () => {
        const diagnostics = await validateSampleFile(
          "queries/correct_query_with_keyword_parameter.pgsql",
        )

        expect(diagnostics).toStrictEqual([
          {
            severity: DiagnosticSeverity.Error,
            message: new KeywordQueryParameterPatternNotDefinedError().message,
            range: Range.create(0, 0, 8, 34),
          },
        ])
      },
    )
  })

  describe("Default Positional Query Parameter File Validation", function () {
    beforeEach(() => {
      const settings = new SettingsBuilder()
        .build()
      server = setupTestServer(settings, new RecordLogger())
    })

    it("Correct query with default positional parameters", async () => {
      const diagnostics = await validateSampleFile(
        "queries/correct_query_with_default_positional_parameter.pgsql",
      )

      expect(diagnostics).toStrictEqual([])
    })
  })

  describe("Default Keyword Query Parameter File Validation", function () {
    beforeEach(() => {
      const settings = new SettingsBuilder()
        .with({ queryParameterPattern: /:[A-Za-z_][A-Za-z0-9_]*/.source })
        .build()
      server = setupTestServer(settings, new RecordLogger())
    })

    it("Correct query with default keyword parameters", async () => {
      const diagnostics = await validateSampleFile(
        "queries/correct_query_with_default_keyword_parameter.pgsql",
        { skipDisableComment: true },
      )

      expect(diagnostics).toStrictEqual([])
    })
  })

  describe("Positional Query Parameter File Validation", function () {
    beforeEach(() => {
      const settings = new SettingsBuilder().build()
      server = setupTestServer(settings, new RecordLogger())
    })

    it("Correct query with positional parameters", async () => {
      const diagnostics = await validateSampleFile(
        "queries/correct_query_with_positional_parameter.pgsql",
      )

      expect(diagnostics).toStrictEqual([])
    })

    it("Correct query with arbitory positional parameters", async () => {
      const diagnostics = await validateSampleFile(
        "queries/correct_query_with_arbitory_positional_parameter.pgsql",
      )

      expect(diagnostics).toStrictEqual([])
    })
  })

  describe("Keyword Query Parameter File Validation", function () {
    beforeEach(() => {
      const settings = new SettingsBuilder()
        .with({ keywordQueryParameterPattern: [
          "@{keyword}",
          "sqlc\\.arg\\s*\\('{keyword}'\\)",
          "sqlc\\.narg\\s*\\('{keyword}'\\)",
        ] })
        .build()
      server = setupTestServer(settings, new RecordLogger())
    })

    it("Correct query with keyword parameters", async () => {
      const diagnostics = await validateSampleFile(
        "queries/correct_query_with_keyword_parameter.pgsql",
      )

      expect(diagnostics).toStrictEqual([])
    })

    it("Correct query with arbitory keyword parameters", async () => {
      const diagnostics = await validateSampleFile(
        "queries/correct_query_with_arbitory_keyword_parameter.pgsql",
      )

      expect(diagnostics).toStrictEqual([])
    })


    it("Correct query with multiple single quotes and keyword parameters", async () => {
      const diagnostics = await validateSampleFile(
		  "queries/correct_query_with_ts_query_keyword_parameter.pgsql",
      )

      expect(diagnostics).toStrictEqual([])
	  })
  })

  describe("Multiple Statements File Validation With Keyword Parameters", function () {
    beforeEach(() => {
      const settings = new SettingsBuilder()
        .with({ keywordQueryParameterPattern: [
          "@{keyword}",
          "sqlc\\.arg\\('{keyword}'\\)",
          "sqlc\\.narg\\('{keyword}'\\)",
        ], statementSeparatorPattern: "-- name:[\\s]+.*" })
        .build()
      server = setupTestServer(settings, new RecordLogger())
    })

    it("Correct query with multiple statements", async () => {
      const diagnostics = await validateSampleFile(
        "queries/correct_query_with_multiple_statements.pgsql",
      )

      expect(diagnostics).toStrictEqual([])
    })
  })
})
