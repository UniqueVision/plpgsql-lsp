export interface SchemaCandidate {
  schema?: string, candidate: string
}

export function makeSchemas(
  schema: string | undefined, defaultSchema: string,
): string[] {
  if (schema === undefined) {
    return [defaultSchema, "pg_catalog"]
  }
  else {
    return [schema.toLowerCase()]
  }
}

export function separateSchemaFromCandidate(
  candidate: string,
): SchemaCandidate | undefined {
  const separated = candidate.split(".")

  if (separated.length === 1) {
    return {
      schema: undefined,
      candidate: separated[0],
    }

  }
  else if (separated.length === 2) {
    return {
      schema: separated[0],
      candidate: separated[1],
    }

  }
  else {
    return undefined

  }
}
