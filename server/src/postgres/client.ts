import { Pool, PoolClient } from "pg"

import { LanguageServerSettings } from "../settings"

export type PostgresPool = Pool
export type PostgresClient = PoolClient

export function makePool(
    settings: LanguageServerSettings,
): PostgresPool | undefined {
    if (
        settings.database === undefined
        || settings.user === undefined
        || settings.password === undefined
    ) {
        return undefined
    }

    return new Pool({
        host: settings.host,
        port: settings.port,
        database: settings.database,
        user: settings.user,
        password: settings.password,
    })
}
