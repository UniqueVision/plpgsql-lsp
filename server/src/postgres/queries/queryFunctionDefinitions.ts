import dedent from "ts-dedent/dist"
import { Logger } from "vscode-languageserver"

import { PostgresPool } from "@/postgres"
import { makeSchemas } from "@/utilities/schema"

interface FunctionDefinition {
  schema: string
  functionName: string
  functionArgs: string[]
  functionIdentityArgs: string[]
  isSetOf: boolean
  returnType: string
  languageName: string
  volatile: string | null
  parallel: string | null
}

export async function queryFunctionDefinitions(
  pgPool: PostgresPool,
  schema: string | undefined,
  functionName: string | undefined,
  defaultSchema: string,
  logger: Logger,
): Promise<FunctionDefinition[]> {
  let definitions: FunctionDefinition[] = []

  const pgClient = await pgPool.connect()
  try {
    // https://dataedo.com/kb/query/postgresql/list-stored-procedures
    const results = await pgClient.query(
      `
      SELECT
        ns.nspname AS schema,
        p.proname AS function_name,
        string_to_array(
          pg_get_function_arguments(p.oid),
          ', '
        ) as arguments,
        string_to_array(
          pg_get_function_identity_arguments(p.oid),
          ', '
        ) as identity_arguments,
        p.proretset AS is_setof,
        t.typname AS return_type,
        l.lanname AS language_name,
        CASE p.provolatile
        WHEN 'i' THEN
          'IMMUTABLE'
        WHEN 's' THEN
          'STABLE'
        WHEN 'v' THEN
          'VOLATILE'
        ELSE
          NULL
        END AS volatile,
        CASE p.proparallel
        WHEN 's' THEN
          'PARALLEL SAFE'
        WHEN 'r' THEN
          'PARALLEL RESTRICTED'
        WHEN 'u' THEN
          'PARALLEL UNSAFE'
        ELSE
          NULL
        END AS parallel
      FROM
        pg_proc p
        INNER JOIN pg_namespace ns ON
          p.pronamespace = ns.oid
          AND ns.nspname = ANY($1)
          AND ($2::text IS NULL OR p.proname = $2::text)
        INNER JOIN pg_type t ON
          p.prorettype = t.oid
        INNER JOIN pg_language l ON
          p.prolang = l.oid
      ORDER BY
        ns.nspname,
        p.proname
      `,
      [makeSchemas(schema, defaultSchema), functionName?.toLowerCase()],
    )

    definitions = results.rows.map(
      (row) => ({
        schema: row.schema,
        functionName: row.function_name,
        functionArgs: row.arguments as string[],
        functionIdentityArgs: row.identity_arguments as string[],
        isSetOf: row.is_setof,
        returnType: row.return_type,
        languageName: row.language_name,
        volatile: row.volatile,
        parallel: row.parallel,
      }),
    )
  }
  catch (error: unknown) {
    logger.error(`${(error as Error).message}`)
  }
  finally {
    pgClient.release()
  }

  return definitions
}

export function makeFunctionDefinitionText(definition: FunctionDefinition): string {
  const {
    schema,
    functionName,
    functionArgs,
    returnType,
    isSetOf,
    languageName,
    volatile,
    parallel,
  } = definition

  let argsString = ""
  if (functionArgs.length > 0) {
    argsString = `\n  ${functionArgs.join(",\n  ")}\n`
  }

  const definitionText = dedent`
    FUNCTION ${schema}.${functionName}(${argsString})
      RETURNS ${isSetOf ? "SETOF " + returnType : returnType}
      LANGUAGE ${languageName}
      ${[volatile, parallel].filter(x => x !== null).join(" ")}
  `

  return definitionText.trim()
}

export function makeInsertFunctionText(
  definition: FunctionDefinition,
): string {
  const {
    functionName,
    functionIdentityArgs,
  } = definition

  if (functionIdentityArgs.length === 0) {
    return `${functionName}()`
  }
  else {
    const callArgs = functionIdentityArgs.map(
      (arg, index) => {
        const splitted = arg.split(" ")
        // positional argument
        if (splitted.length === 1 || splitted[1] === '"any"') {
          return `$\{${index + 1}:${splitted[0]}}`
        }
        // keyword argument
        else {
          return `${splitted[0]} := $\{${index + 1}:${splitted[0]}}`
        }
      },
    )

    return dedent`
      ${functionName}(
        ${callArgs.join(",\n")}
      )
    `
  }
}
