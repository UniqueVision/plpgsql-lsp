import { Pool } from "pg"

import { LanguageServerSettings } from "../settings"

export type PostgresPool = Pool

export function makePool(settings: LanguageServerSettings): PostgresPool {
    return new Pool({
        host: settings.host,
        port: settings.port,
        database: settings.database,
        user: settings.user,
        password: settings.password,
    })
}
