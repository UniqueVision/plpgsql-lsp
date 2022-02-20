import { PostgresClient } from "../client"

interface TableDifinition {
    schema: string
    tableName: string
    fields: {
        columnName: string,
        dataType: string,
    }[]
}

export async function getTableDefinitions(
    pgClient: PostgresClient,
    schema: string | undefined,
    defaultSchema: string,
    tableName?: string,
): Promise<TableDifinition[]> {
    let definitions: TableDifinition[] = []

    let schemaCondition = ""
    if (schema === undefined) {
        schemaCondition = `table_schema in ('${defaultSchema}', 'pg_catalog')`
    }
    else {
        schemaCondition = `table_schema = '${schema.toLowerCase()}'`
    }

    let tableNameCondition = ""
    if (tableName !== undefined) {
        tableNameCondition = `AND table_name = '${tableName.toLowerCase()}'`
    }

    try {
        const results = await pgClient.query(`
            SELECT
                table_schema as schema,
                table_name as table_name,
                json_agg(
                    json_build_object(
                        'columnName', column_name,
                        'dataType', data_type
                    )
                    ORDER BY
                        ordinal_position
                ) AS fields
            FROM
                information_schema.columns
            WHERE
                ${schemaCondition}
                ${tableNameCondition}
            GROUP BY
                table_schema,
                table_name
            ORDER BY
                table_schema,
                table_name
        `)
        definitions = results.rows.map(row => {
            return {
                schema: row.schema,
                tableName: row.table_name,
                fields: row.fields as { columnName: string, dataType: string }[],
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
