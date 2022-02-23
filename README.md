# PL/pgSQL Language Server

## Features

- type/table/view/function/procedure name completion.
- go to the type/table/view/function/procedure definition.
- hover type/table/view/function/procedure definition.
- syntax check.
- static analysis check (when [plpgsql_check](https://github.com/okbob/plpgsql_check) use) .
- [Multi-root Workspace](https://code.visualstudio.com/docs/editor/multi-root-workspaces) support.

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
