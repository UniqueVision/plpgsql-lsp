import * as assert from "assert"
import { Diagnostic, DiagnosticSeverity, Range } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import {
  getDefinitionFileResource,
  getDefinitionFileText,
  getQueryFileResource,
  getQueryFileText,
} from "@/__tests__/helpers/file"
import { Server, setupTestServer } from "@/server/server"
import { TextDocumentTestManager } from "@/server/textDocumentManager"
import { SettingsBuilder } from "@/settings"


describe("Validate Tests", () => {
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

  async function validateDefinition(
    file: string,
    options: { ignoreDesableFlag: boolean } = { ignoreDesableFlag: false },
  ): Promise<Diagnostic[] | undefined> {
    let context = getDefinitionFileText(file)

    if (options.ignoreDesableFlag) {
      context = context.split("\n").slice(1).join("\n")
    }

    const textDocument = TextDocument.create(
      getDefinitionFileResource(file),
      "postgres",
      0,
      context,
    );

    (server.documents as TextDocumentTestManager).set(textDocument)

    if (server.handlers === undefined) {
      throw new Error("handlers is undefined")
    }

    return server.handlers.validate(textDocument)
  }

  async function validateQuery(
    file: string,
  ): Promise<Diagnostic[] | undefined> {
    const textDocument = TextDocument.create(
      getQueryFileResource(file),
      "postgres",
      0,
      getQueryFileText(file),
    );

    (server.documents as TextDocumentTestManager).set(textDocument)

    if (server.handlers === undefined) {
      throw new Error("handlers is undefined")
    }

    return server.handlers.validate(textDocument)
  }

  function validateDiagnostics(
    diagnostics: Diagnostic[] | undefined,
    expectedDiagnostics: Diagnostic[],
  ) {
    expect(diagnostics).toBeDefined()
    if (diagnostics === undefined) return

    assert.deepEqual(
      diagnostics,
      expectedDiagnostics,
    )
  }

  describe("Validate", function () {
    it("Correct function", async () => {
      const diagnostics = await validateDefinition(
        "stored/function_correct.pgsql",
      )
      validateDiagnostics(diagnostics, [])
    })

    it("Function has unused variable", async () => {
      const diagnostics = await validateDefinition(
        "stored/static_analysis_warning_function_unused_variable.pgsql",
      )
      validateDiagnostics(diagnostics, [
        {
          severity: DiagnosticSeverity.Warning,
          message: 'unused variable "w_id"',
          range: Range.create(7, 2, 7, 12),
        },
      ])
    })

    it("Function column does not exists", async () => {
      const diagnostics = await validateDefinition(
        "stored/syntax_error_function_column_does_not_exist.pgsql",
        { ignoreDesableFlag: true },
      )
      validateDiagnostics(diagnostics, [
        {
          severity: DiagnosticSeverity.Error,
          message: 'column "tags" does not exist',
          range: Range.create(12, 2, 12, 6),
        },
      ])
    })

    it("Correct query", async () => {
      const diagnostics = await validateQuery(
        "select_correct.pgsql",
      )
      validateDiagnostics(diagnostics, [])
    })
  })
})
