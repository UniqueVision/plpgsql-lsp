import fs from "fs/promises"
import glob from "glob-promise"
import path from "path"
import { DatabaseError } from "pg"
import {
  Logger,
} from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { MigrationError } from "@/errors"
import { PostgresClient } from "@/postgres"
import { MigrationsSettings } from "@/settings"
import { asyncFlatMap } from "@/utilities/functool"
import { BEGIN_RE, COMMIT_RE, ROLLBACK_RE } from "@/utilities/regex"


export async function runMigration(
  pgClient: PostgresClient,
  document: TextDocument,
  migrations: MigrationsSettings,
  logger: Logger,
): Promise<void> {
  const upMigrationFiles = (
    await asyncFlatMap(
      migrations.upFiles,
      (filePattern) => glob.promise(filePattern),
    ))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

  const downMigrationFiles = (
    await asyncFlatMap(
      migrations.downFiles,
      (filePattern) => glob.promise(filePattern),
    ))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))

  const postMigrationFiles = (
    await asyncFlatMap(
      migrations.postMigrationFiles ?? [],
      (filePattern) => glob.promise(filePattern),
    ))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

  const migrationTarget = migrations?.target ?? "up/down"

  if (migrationTarget === "up/down"
    && (
      // Check if it is not a migration file.
      upMigrationFiles.filter(file => document.uri.endsWith(file)).length
      + downMigrationFiles.filter(file => document.uri.endsWith(file)).length === 0
    )
  ) {
    return
  }

  let shouldContinue = true

  if (shouldContinue) {
    shouldContinue = await queryMigrations(
      pgClient, document, downMigrationFiles, logger,
    )
  }

  if (shouldContinue) {
    shouldContinue = await queryMigrations(
      pgClient, document, upMigrationFiles, logger,
    )
  }

  if (shouldContinue) {
    shouldContinue = await queryMigrations(
      pgClient, document, postMigrationFiles, logger,
    )
  }
}

async function queryMigrations(
  pgClient: PostgresClient,
  document: TextDocument,
  files: string[],
  logger: Logger,
): Promise<boolean> {
  for await (const file of files) {
    try {
      if (document.uri.endsWith(file)) {
        // allow us to revisit and work on any migration/post-migration file
        logger.info("Stopping migration execution at the current file")

        return false
      }

      logger.info(`Migration ${file}`)

      const migration = (await fs.readFile(file, { encoding: "utf8" }))
        .replace(BEGIN_RE, (m) => "-".repeat(m.length))
        .replace(COMMIT_RE, (m) => "-".repeat(m.length))
        .replace(ROLLBACK_RE, (m) => "-".repeat(m.length))

      await pgClient.query(migration)
    } catch (error: unknown) {
      const errorMessage = (error as DatabaseError).message

      logger.error(
        `Stopping migration execution at ${path.basename(file)}: ${errorMessage}`,
      )

      throw new MigrationError(document, errorMessage)
    }
  }

  return true
}
