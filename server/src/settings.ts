export const PLPGSQL_LANGUAGE_SERVER_SECTION = "plpgsqlLanguageServer"
export const DEFAULT_SCHEMA = "public"

// The example settings
export interface Settings {
  host: string;
  port: number;
  database?: string;
  user?: string;
  password?: string;
  definitionFiles: string[];
  defaultSchema: string;
}

export const DEFAULT_SETTINGS: Settings = {
  host: "localhost",
  port: 5432,
  database: undefined,
  user: undefined,
  password: undefined,
  definitionFiles: [
    "**/*.psql",
    "**/*.pgsql",
  ],
  defaultSchema: DEFAULT_SCHEMA,
}

export class SettingsBuilder {
  private settings: Settings = DEFAULT_SETTINGS

  constructor() {
    this.settings.database = "postgres"
    this.settings.user = "postgres"
    this.settings.password = "password"
  }

  build(): Settings {
    return this.settings
  }

  withHost(host: string): SettingsBuilder {
    this.settings.host = host

    return this
  }

  withPort(port: number): SettingsBuilder {
    this.settings.port = port

    return this
  }

  withDatabase(database: string): SettingsBuilder {
    this.settings.database = database

    return this
  }

  withUser(user: string): SettingsBuilder {
    this.settings.user = user

    return this
  }

  withPassword(password: string): SettingsBuilder {
    this.settings.password = password

    return this
  }

  withDefinitionFiles(definitionFiles: string[]): SettingsBuilder {
    this.settings.definitionFiles = definitionFiles

    return this
  }

  withDefaultSchema(defaultSchema: string): SettingsBuilder {
    this.settings.defaultSchema = defaultSchema

    return this
  }
}
