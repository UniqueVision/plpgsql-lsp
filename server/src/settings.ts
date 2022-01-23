// The example settings
export interface LanguageServerSettings {
    host: string;
    port: number;
    database?: string;
    user?: string;
    password?: string;
    definitionFiles?: string[];
    defaultSchema: string;
}

export const DEFAULT_SETTINGS: LanguageServerSettings = {
    host: "localhost",
    port: 5432,
    database: undefined,
    user: undefined,
    password: undefined,
    definitionFiles: undefined,
    defaultSchema: "public",
}
