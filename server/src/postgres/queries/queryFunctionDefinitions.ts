import { Logger } from "vscode-languageserver"

import { PostgresPool } from "@/postgres/pool"

interface FunctionDefinition {
  schema: string
  functionName: string
  functionArgs: string[]
  functionIdentityArgs: string[]
  isSetOf: boolean
  returnType: string
  languageName: string
  volatile?: string
  parallel?: string
}

export async function queryFunctionDefinitions(
  pgPool: PostgresPool,
  schema: string | undefined,
  defaultSchema: string,
  logger: Logger,
  functionName?: string,
): Promise<FunctionDefinition[]> {
  let definitions: FunctionDefinition[] = []

  let schemaCondition = ""
  if (schema === undefined) {
    schemaCondition = `ns.nspname in ('${defaultSchema}', 'pg_catalog')`
  }
  else {
    schemaCondition = `ns.nspname = '${schema.toLowerCase()}'`
  }

  let functionNameCondition = ""
  if (functionName !== undefined) {
    functionNameCondition = `AND p.proname = '${functionName.toLowerCase()}'`
  }

  const pgClient = await pgPool.connect()
  try {
    // https://dataedo.com/kb/query/postgresql/list-stored-procedures
    const results = await pgClient.query(`
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
        INNER JOIN pg_type t ON
          p.prorettype = t.oid
        INNER JOIN pg_language l ON
          p.prolang = l.oid
      WHERE
        ${schemaCondition}
        ${functionNameCondition}
      ORDER BY
        ns.nspname,
        p.proname
    `)

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
    argsString = "\n  " + functionArgs.join(",\n  ") + "\n"
  }

  let returnString = returnType
  if (isSetOf) {
    returnString = `SETOF ${returnType}`
  }

  let definitionText = [
    `FUNCTION ${schema}.${functionName}(${argsString})`,
    `  RETURNS ${returnString}`,
    `  LANGUAGE ${languageName}`,
  ].join("\n")

  const functionInfos = []
  if (volatile !== undefined) {
    functionInfos.push(volatile)
  }
  if (parallel !== undefined) {
    functionInfos.push(parallel)
  }
  if (functionInfos.length !== 0) {
    definitionText += `\n  ${functionInfos.join(" ")}`
  }

  return definitionText
}

export function makeInsertFunctionText(
  definition: FunctionDefinition,
): string {
  const {
    functionName,
    functionIdentityArgs,
  } = definition

  let callArgsString = ""
  if (functionIdentityArgs.length > 0) {
    callArgsString = "\n" + functionIdentityArgs.map(
      (arg) => {
        const splitted = arg.split(" ")
        if (splitted.length === 1 || splitted[1] === '"any"') {
          // argument
          return `  ${splitted[0]}`
        }
        else {
          // keyword argument
          return `  ${splitted[0]} := ${splitted[0]}`
        }
      },
    ).join(",\n") + "\n"
  }

  return `${functionName}(${callArgsString})`
}
