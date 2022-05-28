import { DatabaseError } from "pg"

import { DEFAULT_LOAD_FILE_OPTIONS, LoadFileOptions } from "@/__tests__/helpers/file"
import { setupTestServer } from "@/__tests__/helpers/server"
import { SettingsBuilder } from "@/__tests__/helpers/settings"
import {
  loadSampleTextDocument,
  TestTextDocuments,
} from "@/__tests__/helpers/textDocuments"
import {
  CannotExecuteCommandWithQueryParametersError,
  DisableLanguageServerError,
  ExecuteFileQueryCommandDisabledError,
  PostgresPoolNotFoundError,
} from "@/errors"
import { Server } from "@/server"

import { FILE_QUERY_COMMAND_INFO } from "./executeFileQuery"

describe("CommandExecuter.executeFileQuery Tests", () => {
  let server: Server

  afterEach(async () => {
    for (const pgPool of server.pgPools.values()) {
      await pgPool.end()
    }
  })

  async function executeCommand(
    file: string,
    options: LoadFileOptions = DEFAULT_LOAD_FILE_OPTIONS,
  ): Promise<void> {
    const document = await loadSampleTextDocument(
      file,
      options,
    );

    (server.documents as TestTextDocuments).set(document)

    if (server.handlers === undefined) {
      throw new Error("handlers is undefined")
    }
    if (server.commandExecuter === undefined) {
      throw new Error("commandExecuter is undefined")
    }

    await server.commandExecuter?.execute(
      {
        command: FILE_QUERY_COMMAND_INFO.command,
        arguments: [document.uri],
      },
    )
  }

  describe("Enable Settings", function () {
    beforeEach(() => {
      const settings = new SettingsBuilder().build()
      server = setupTestServer(settings)
    })

    it("succeed on the correct query.", async () => {
      await executeCommand("queries/correct_query.pgsql")
    })

    it(
      "throw DisableLanguageServerError on the Language Server disable file.",
      async () => {
        await expect(executeCommand(
          "queries/"
          + "syntax_error_query_with_language_server_disable_comment.pgsql",
        ))
          .rejects
          .toThrowError(DisableLanguageServerError)
      },
    )

    it(
      "throw DatabaseError on the Language Server disable validation file",
      async () => {
        await expect(executeCommand(
          "queries/"
          + "syntax_error_query_with_language_server_disable_validation_comment.pgsql",
        ))
          .rejects
          .toThrowError(DatabaseError)
      },
    )

    it(
      "throw CannotExecuteCommandWithQueryParametersError"
      + " on the query with positional parameters",
      async () => {
        await expect(executeCommand(
          "queries/correct_query_with_positional_parameter.pgsql",
        ))
          .rejects
          .toThrowError(CannotExecuteCommandWithQueryParametersError)
      },
    )
  })

  describe("Disable Settings", function () {
    beforeEach(() => {
      const settings = new SettingsBuilder()
        .withEnableExecuteFileQueryCommand(false)
        .build()
      server = setupTestServer(settings)
    })

    it(
      "throw ExecuteFileQueryCommandDisabledError on the correct query",
      async () => {
        await expect(executeCommand("queries/correct_query.pgsql"))
          .rejects
          .toThrowError(ExecuteFileQueryCommandDisabledError)
      },
    )
  })

  describe("Wrong Postgres Settings", function () {
    beforeEach(() => {
      const settings = new SettingsBuilder()
        .withDatabase("NonExistentDatabase")
        .withEnableExecuteFileQueryCommand(true)
        .build()

      server = setupTestServer(settings)
    })

    it("throw PostgresPoolNotFoundError on the correct query.", async () => {
      await expect(executeCommand("queries/correct_query.pgsql"))
        .rejects
        .toThrowError(PostgresPoolNotFoundError)
    })
  })
})
