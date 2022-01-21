# PL/pgSQL Language Server

## Features

- [x] syntax error check.
- [x] table name completion.
- [x] stored procedure/function name completion.
- [x] stored procedure/function args completion.
- [x] go to the file top of type/table/function definition.
- [x] support Multi-root Workspaces.

## Usage

1. Set your database connection to VSCode settings.
1. Open `.pgsql` file and edit your code!

## VSCode Settings sample

```json
{
  "plpgsqlLanguageServer.database": "your_database_name",
  "plpgsqlLanguageServer.user": "your_database_user",
  "plpgsqlLanguageServer.password": "your_database_password",
  "plpgsqlLanguageServer.definitionFiles": [
    "**/*.sql" // Support glob.
  ],
  // The supported extention types are ['*.pgsql', '*.psql'].
	// If you want to use this extension in '*.sql',
	// add the following settings.
  "files.associations": {
    "*.sql": "postgres"
  }
}
```
