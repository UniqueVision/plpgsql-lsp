import { PostgresClient } from "../client"

interface FunctionDifinition {
    schema: string
    functionName: string
    functionArgs: string[]
    functionIdentityArgs: string[]
    isSetOf: boolean
    returnType: string
    volatile?: string
    parallel?: string
}

export async function getFunctionDefinitions(
    pgClient: PostgresClient,
    schema: string | undefined,
    defaultSchema: string,
    functionName?: string,
): Promise<FunctionDifinition[]> {
    let definitions: FunctionDifinition[] = []

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
            WHERE
                ${schemaCondition}
                ${functionNameCondition}
            ORDER BY
                ns.nspname,
                p.proname
        `)
        definitions = results.rows.map(row => {
            return {
                schema: row.schema,
                functionName: row.function_name,
                functionArgs: row.arguments as string[],
                functionIdentityArgs: row.identity_arguments as string[],
                isSetOf: row.is_setof,
                returnType: row.return_type,
                volatile: row.volatile,
                parallel: row.parallel,
            }
        })
    }
    catch (error: unknown) {
        console.error(`${error}`)
    }
    finally {
        pgClient.release()
    }

    return definitions
}
