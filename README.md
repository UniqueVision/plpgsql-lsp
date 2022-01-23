# PL/pgSQL Language Server

## Features

- [x] table name completion.
- [x] stored procedure/function name completion.
- [x] stored procedure/function args completion.
- [x] go to the type/table/function definition.
- [x] syntax error check.
- [x] static analysis check (when use [plpgsql_check](https://github.com/okbob/plpgsql_check)) .
- [x] Multi-root Workspaces support.

## Usage

1. Set your database connection to VSCode settings.
1. Open `.pgsql` file and edit your code!

## VSCode Settings sample

```jsonc
{
  "plpgsqlLanguageServer.database": "your_database_name",
  "plpgsqlLanguageServer.user": "your_database_user",
  "plpgsqlLanguageServer.password": "your_database_password",
  "plpgsqlLanguageServer.definitionFiles": [
    // Support glob.
    "**/*.sql",
    "**/*.psql",
    "**/*.pgsql"
  ],
  // The supported extention types are ['*.pgsql', '*.psql'].
  // If you want to use this extension in '*.sql', add the following settings.
  "files.associations": {
    "*.sql": "postgres"
  }
}
```
