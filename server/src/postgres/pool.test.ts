import { createConnection } from "vscode-languageserver/node"

import { SettingsBuilder } from "@/__tests__/helpers/settings"
import { Settings } from "@/settings"
import { ConsoleLogger } from "@/utilities/logger"

import { getPool, PostgresPool } from "./pool"


describe("Postgres Pool Tests", () => {
  async function createPool(
    settings: Settings,
  ): Promise<PostgresPool | undefined> {
    process.argv.push("--node-ipc")

    const connection = createConnection()
    const logger = new ConsoleLogger(connection)

    return await getPool(new Map(), settings, logger)
  }

  describe("Settings Tests", function () {
    it("Correct Settings", async () => {
      const settings = new SettingsBuilder().build()

      const pool = await createPool(settings)
      expect(pool).toBeDefined()
    })

    it("Wrong Settings", async () => {
      const settings = new SettingsBuilder()
        .with({ database: "NonExistentDatabase" })
        .build()

      const pool = await createPool(settings)
      expect(pool).toBeUndefined()
    })
  })
})
