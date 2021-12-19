// The example settings
export interface LanguageServerSettings {
  host: string;
  port: number;
  database: string;
  user?: string;
  password?: string;
}

export const DEFAULT_SETTINGS: LanguageServerSettings = {
  host: 'localhost',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'postgres'
};
