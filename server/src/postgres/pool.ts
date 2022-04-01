import { Pool, PoolClient } from "pg"
import { Logger } from "vscode-languageserver"

import { Settings } from "@/settings"

export type PostgresConfig = {
  host: string,
  port: number,
  database: string,
  user: string,
  password: string,
}
export type PostgresPool = Pool
export type PostgresClient = PoolClient

export type PostgresPoolMap = Map<PostgresConfig, PostgresPool>

export async function getPool(
  pgPools: PostgresPoolMap,
  settings: Settings,
  logger: Logger,
): Promise<PostgresPool | undefined> {
  if (
    settings.database === undefined
    || settings.user === undefined
    || settings.password === undefined
  ) {
    return undefined
  }

  const pgConfig: PostgresConfig = {
    host: settings.host,
    port: settings.port,
    database: settings.database,
    user: settings.user,
    password: settings.password,
  }

  let pgPool = pgPools.get(pgConfig)
  if (pgPool === undefined) {
    try {
      pgPool = new Pool(pgConfig)

      // Try connection.
      await (await pgPool.connect()).release()
    }
    catch (error: unknown) {
      logger.error((error as Error).toString())

      return undefined
    }

    pgPools.set(pgConfig, pgPool)
  }

  return pgPool
}
