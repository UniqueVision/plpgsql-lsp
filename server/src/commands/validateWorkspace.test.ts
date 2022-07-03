import {
  DEFAULT_LOAD_FILE_OPTIONS, getSampleWorkspaceUri, LoadFileOptions,
} from "@/__tests__/helpers/file"
import { RecordLogger } from "@/__tests__/helpers/logger"
import { setupTestServer } from "@/__tests__/helpers/server"
import { SettingsBuilder } from "@/__tests__/helpers/settings"
import {
  loadSampleTextDocument,
  TestTextDocuments,
} from "@/__tests__/helpers/textDocuments"
import { PostgresPoolNotFoundError } from "@/errors"
import { Server } from "@/server"

import { WORKSPACE_VALIDATION_COMMAND } from "./validateWorkspace"

describe("CommandExecuter.validateWorkspace Tests", () => {
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
        command: WORKSPACE_VALIDATION_COMMAND.name,
        arguments: [document.uri, getSampleWorkspaceUri(), "sample"],
      },
    )
  }

  describe("Enable Settings", function () {
    beforeEach(() => {
      const settings = new SettingsBuilder().build()
      server = setupTestServer(settings, new RecordLogger())
      server.start()
    })

    it("pass workspace validation", async () => {
      await executeCommand("queries/correct_query.pgsql")
    })
  })

  describe("Wrong Postgres Settings", function () {
    beforeEach(() => {
      const settings = new SettingsBuilder()
        .with({
          database: "NonExistentDatabase",
          enableExecuteFileQueryCommand: true,
        })
        .build()

      server = setupTestServer(settings, new RecordLogger())
      server.start()
    })

    it("throw PostgresPoolNotFoundError on the query file.", async () => {
      await expect(executeCommand("queries/correct_query.pgsql"))
        .rejects
        .toThrowError(PostgresPoolNotFoundError)
    })
  })
})
