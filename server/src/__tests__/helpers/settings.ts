import { DEFAULT_SETTINGS, Settings } from "@/settings"

export class SettingsBuilder {
  private settings: Settings = DEFAULT_SETTINGS

  constructor() {
    this.settings.host = process.env.POSTGRES_HOST || "localhost"
    this.settings.database = process.env.POSTGRES_DB || "postgres"
    this.settings.user = process.env.POSTGRES_USER || "postgres"
    this.settings.password = process.env.POSTGRES_PASSWORD || "password"
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

  withQueryParameterPattern(
    queryParameterPattern: RegExp,
  ): SettingsBuilder {
    this.settings.queryParameterPattern = queryParameterPattern.source

    return this
  }

  withKeywordQueryParameterPattern(
    keywordQueryParameterPattern: string,
  ): SettingsBuilder {
    this.settings.keywordQueryParameterPattern = keywordQueryParameterPattern

    return this
  }
}
