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

### Positional Query Parameters
In the case of a file that defines a query with positional parameters,
You can validate it by adding the positional query parameter comment at the file top.

```sql
/* plpgsql-language-server:use-positional-query-parameter */

SELECT
  id,
  name
FROM
  users
WHERE
  id = $1 AND name = ANY($2);
```

This tool counts the number of parameters with a simple regular expression,
so complex queries file require the number to be specified explicitly in the comment.

```sql
/* plpgsql-language-server:use-positional-query-parameter number=2 */

SELECT
  id,
  name,
  'This text contains "$3" :('
FROM
  users
WHERE
  id = $1 AND name = ANY($2);
```

### Keyword Query Parameters
Support query with keyword parameters, same as positional parameters.

However, the format of the keyword parameter varies from library to library,
so must be indicated in the settings file.

```jsonc
{
  "plpgsqlLanguageServer.keywordQueryParameterPattern": "@{keyword}"
}
```

You have finished setting, you can validate it like this.

```sql
-- plpgsql-language-server:use-keyword-query-parameter

SELECT
  id,
  name
FROM
  users
WHERE
  id = @id AND name = ANY(@names);
```

The complex queries file require the keywords to be specified explicitly in the comment.

```sql
-- plpgsql-language-server:use-keyword-query-parameter keywords=[id, names]

SELECT
  id,
  name,
  'This text contains "@tags" :('
FROM
  users
WHERE
  id = @id AND name = ANY(@names);
```
