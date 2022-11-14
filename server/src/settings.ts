export interface Settings {
  host: string;
  port: number;
  database?: string;
  user?: string;
  password?: string;
  definitionFiles: string[];
  defaultSchema: string;
  queryParameterPattern: string | string[];
  keywordQueryParameterPattern?: string | string[];
  statementSeparatorPattern?: string;
  enableExecuteFileQueryCommand: boolean;
  workspaceValidationTargetFiles: string[];
  migrations?: MigrationsSettings;
}

export interface MigrationsSettings {
  folder: string;
  upFilePattern: string;
  downFilePattern: string;
  postMigrations?: PostMigrationsSettings;
}

export interface PostMigrationsSettings {
  folder: string;
  filePattern: string;
}

export const DEFAULT_SETTINGS: Settings = {
  host: "localhost",
  port: 5432,
  database: undefined,
  user: undefined,
  password: undefined,
  definitionFiles: ["**/*.psql", "**/*.pgsql"],
  defaultSchema: "public",
  queryParameterPattern: /\$[1-9][0-9]*/.source,
  keywordQueryParameterPattern: undefined,
  statementSeparatorPattern: undefined,
  enableExecuteFileQueryCommand: true,
  workspaceValidationTargetFiles: [],
  migrations: undefined,
}
