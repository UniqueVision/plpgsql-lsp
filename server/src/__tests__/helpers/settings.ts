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

  with(settings: Partial<Settings>): SettingsBuilder {
    this.settings = { ...this.settings, ...settings }

    return this
  }
}
