# PL/pgSQL Language Server

[![Marketplace Version](https://vsmarketplacebadge.apphb.com/version/uniquevision.vscode-plpgsql-lsp.svg?label=VS%20Code%20Marketplace&logo=visual-studio-code&style=flat-square "Current Release")](https://marketplace.visualstudio.com/items?itemName=uniquevision.vscode-plpgsql-lsp)
[![GitHub license](https://badgen.net/github/license/Naereen/Strapdown.js?style=flat-square)](https://github.com/Naereen/StrapDown.js/blob/master/LICENSE)

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

![preview](images/preview.gif)

## VSCode Settings Sample

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

## Disable Specific File

If you want to disable the extension for a specific file, just add this comment your file top.

```sql
/* plpgsql-language-server:disable */
```

Or, if you want to disable only the validation feature, try this

```sql
/* plpgsql-language-server:disable validation */
```

## [Experimental Feature] Query Parameters

In the case of a file that defines a query with parameters,
you can validate it by setting the number of query parameters at the file top.

```sql
/* plpgsql-language-server:query-parameter-number 2 */

SELECT
  id,
  name
FROM
  users
WHERE
  id = $1 AND name = ANY($2);
```
