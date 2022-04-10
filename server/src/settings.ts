export interface Settings {
  host: string;
  port: number;
  database?: string;
  user?: string;
  password?: string;
  definitionFiles: string[];
  defaultSchema: string;
  queryParameterPattern: string
  keywordQueryParameterPattern?: string,
  enableExecuteFileQueryCommand: boolean,
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
  defaultSchema: "public",
  queryParameterPattern: /\$[1-9][0-9]*/.source,
  keywordQueryParameterPattern: undefined,
  enableExecuteFileQueryCommand: true,
}
