import { PostgresClient } from "../client"

interface FunctionDifinition {
    schema: string
    functionName: string
    fnctionArgs: string[]
    isSetOf: boolean
    returnType: string
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
                p.proretset AS is_setof,
                t.typname AS return_type
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
                p.proname
        `)
        definitions = results.rows.map(row => {
            return {
                schema: row.schema,
                functionName: row.function_name,
                fnctionArgs: row.arguments as string[],
                isSetOf: row.is_setof,
                returnType: row.return_type,
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
