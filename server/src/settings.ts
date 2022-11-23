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
  enableExecuteFileQueryCommand: boolean;
  workspaceValidationTargetFiles: string[];
  migrations?: MigrationsSettings;
  statements?: StatementsSettings;
  validateOn: "save" | "change"
}

export interface StatementsSettings {
  diagnosticsLevels?: StatementsDiagnosticLevelSettings;
  separatorPattern: string;
}

export type DiagnosticLevel = "ignore" | "warning";

export interface StatementsDiagnosticLevelSettings {
  disableFlag?: DiagnosticLevel;
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
  enableExecuteFileQueryCommand: true,
  workspaceValidationTargetFiles: [],
  migrations: undefined,
  statements: undefined,
  validateOn: "change",
}
