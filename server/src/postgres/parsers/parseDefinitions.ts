import { DefinitionLink, LocationLink, URI } from "vscode-languageserver"

import { Statement } from "@/postgres/parsers/statement"
import { DefinitionCandidate } from "@/server/definitionsManager"
import { findIndexFromBuffer, getRangeFromBuffer } from "@/utilities/text"

export function parseDefinitions(
  fileText: string,
  statements: Statement[],
  uri: URI,
  defaultSchema: string,
): DefinitionCandidate[] {
  return statements.flatMap(
    (statement) => {
      if (statement?.stmt?.CreateStmt !== undefined) {
        return parseTableDefinitions(fileText, statement, uri, defaultSchema)
      }
      else if (statement?.stmt?.ViewStmt !== undefined) {
        return parseViewDefinitions(fileText, statement, uri, defaultSchema)
      }
      else if (statement?.stmt?.CompositeTypeStmt !== undefined) {
        return parseTypeDefinitions(fileText, statement, uri, defaultSchema)
      }
      else if (statement?.stmt?.CreateDomainStmt !== undefined) {
        return parseDomainDefinitions(fileText, statement, uri, defaultSchema)
      }
      else if (statement?.stmt?.CreateFunctionStmt !== undefined) {
        return parseFunctionDefinitions(fileText, statement, uri, defaultSchema)
      }
      else if (statement?.stmt?.CreateTrigStmt !== undefined) {
        return parseTriggerDefinitions(fileText, statement, uri)
      }
      else if (statement?.stmt?.IndexStmt !== undefined) {
        return parseIndexDefinitions(fileText, statement, uri)
      }
      else if (statement?.stmt?.CreateTableAsStmt !== undefined) {
        if (statement?.stmt?.CreateTableAsStmt?.relkind === "OBJECT_MATVIEW") {
          return parseMaterializedViewDefinitions(
            fileText, statement, uri, defaultSchema,
          )
        }
        else {
          return []
        }
      }
      else {
        return []
      }
    },
  )
}

export function parseTableDefinitions(
  fileText: string,
  statement: Statement,
  uri: URI,
  defaultSchema: string,
): DefinitionCandidate[] {
  const createStmt = statement?.stmt?.CreateStmt
  if (createStmt === undefined) {
    return []
  }

  const schemaName = createStmt.relation.schemaname
  const relationName = createStmt.relation.relname
  const stmtLocation = statement.stmt_location || 0

  const definitionLink = LocationLink.create(
    uri,
    getRangeFromBuffer(
      fileText,
      stmtLocation,
      stmtLocation + statement.stmt_len,
    ),
    getRangeFromBuffer(
      fileText,
      createStmt.relation.location,
      createStmt.relation.location
      + (schemaName !== undefined ? (schemaName + ".").length : 0)
      + relationName.length,
    ),
  )

  return makeMultiSchemaDefinitionCandidates(
    relationName,
    definitionLink,
    schemaName,
    defaultSchema,
  )
}

export function parseViewDefinitions(
  fileText: string,
  statement: Statement,
  uri: URI,
  defaultSchema: string,
): DefinitionCandidate[] {
  const createStmt = statement?.stmt?.ViewStmt
  if (createStmt === undefined) {
    return []
  }

  const schemaName = createStmt.view.schemaname
  const relationName = createStmt.view.relname
  const stmtLocation = statement.stmt_location || 0

  const definitionLink = LocationLink.create(
    uri,
    getRangeFromBuffer(
      fileText,
      stmtLocation,
      stmtLocation + statement.stmt_len,
    ),
    getRangeFromBuffer(
      fileText,
      createStmt.view.location,
      createStmt.view.location
      + (schemaName !== undefined ? (schemaName + ".").length : 0)
      + relationName.length,
    ),
  )

  return makeMultiSchemaDefinitionCandidates(
    relationName,
    definitionLink,
    schemaName,
    defaultSchema,
  )
}

export function parseTypeDefinitions(
  fileText: string,
  statement: Statement,
  uri: URI,
  defaultSchema: string,
): DefinitionCandidate[] {
  const compositTypeStmt = statement?.stmt?.CompositeTypeStmt
  if (compositTypeStmt === undefined) {
    return []
  }
  const relationName = compositTypeStmt.typevar.relname
  const schemaName = compositTypeStmt.typevar.schemaname
  const stmtLocation = statement.stmt_location || 0

  const definitionLink = LocationLink.create(
    uri,
    getRangeFromBuffer(
      fileText,
      stmtLocation,
      stmtLocation + statement.stmt_len,
    ),
    getRangeFromBuffer(
      fileText,
      compositTypeStmt.typevar.location,
      compositTypeStmt.typevar.location + relationName.length,
    ),
  )

  return makeMultiSchemaDefinitionCandidates(
    relationName,
    definitionLink,
    schemaName,
    defaultSchema,
  )
}

export function parseDomainDefinitions(
  fileText: string,
  statement: Statement,
  uri: URI,
  defaultSchema: string,
): DefinitionCandidate[] {
  const createDomainStmt = statement?.stmt?.CreateDomainStmt
  if (createDomainStmt === undefined) {
    return []
  }

  let schemaName = undefined
  let domainName = undefined
  const nameList = createDomainStmt.domainname
    .filter((name) => "String" in name)
    .map((name) => name.String.str)

  if (nameList.length === 1) {
    domainName = nameList[0]
  }
  else if (nameList.length === 2) {
    schemaName = nameList[0]
    domainName = nameList[1]
  }
  else {
    return []
  }

  const definition = nameList.join(".")

  const domainNameLocation = findIndexFromBuffer(
    fileText, definition, statement.stmt_location,
  )
  const stmtLocation = statement.stmt_location || 0

  const definitionLink = LocationLink.create(
    uri,
    getRangeFromBuffer(
      fileText,
      stmtLocation,
      stmtLocation + statement.stmt_len,
    ),
    getRangeFromBuffer(
      fileText,
      domainNameLocation,
      domainNameLocation + definition.length,
    ),
  )

  return makeMultiSchemaDefinitionCandidates(
    domainName,
    definitionLink,
    schemaName,
    defaultSchema,
  )
}

export function parseFunctionDefinitions(
  fileText: string,
  statement: Statement,
  uri: URI,
  defaultSchema: string,
): DefinitionCandidate[] {
  const createFunctionStmt = statement?.stmt?.CreateFunctionStmt
  if (createFunctionStmt === undefined) {
    return []
  }

  let schemaName = undefined
  let functionName = undefined
  const nameList = createFunctionStmt.funcname
    .filter((name) => "String" in name)
    .map((name) => name.String.str)

  if (nameList.length === 1) {
    functionName = nameList[0]
  }
  else if (nameList.length === 2) {
    schemaName = nameList[0]
    functionName = nameList[1]
  }
  else {
    return []
  }

  const definition = nameList.join(".")

  const functionNameLocation = findIndexFromBuffer(
    fileText, definition, statement.stmt_location,
  )
  const stmtLocation = statement.stmt_location || 0


  const definitionLink = LocationLink.create(
    uri,
    getRangeFromBuffer(
      fileText,
      stmtLocation,
      stmtLocation + statement.stmt_len,
    ),
    getRangeFromBuffer(
      fileText,
      functionNameLocation,
      functionNameLocation + definition.length,
    ),
  )

  return makeMultiSchemaDefinitionCandidates(
    functionName,
    definitionLink,
    schemaName,
    defaultSchema,
  )
}

export function parseIndexDefinitions(
  fileText: string,
  statement: Statement,
  uri: URI,
): DefinitionCandidate[] {
  const IndexStmt = statement?.stmt?.IndexStmt
  if (IndexStmt === undefined) {
    return []
  }

  const indexName = IndexStmt.idxname
  const indexNameLocation = findIndexFromBuffer(
    fileText, indexName, statement.stmt_location,
  )
  const stmtLocation = statement.stmt_location || 0

  const definitionLink = LocationLink.create(
    uri,
    getRangeFromBuffer(
      fileText,
      stmtLocation,
      stmtLocation + statement.stmt_len,
    ),
    getRangeFromBuffer(
      fileText,
      indexNameLocation,
      indexNameLocation + indexName.length,
    ),
  )

  return [
    {
      definition: indexName,
      definitionLink,
    },
  ]
}

export function parseTriggerDefinitions(
  fileText: string,
  statement: Statement,
  uri: URI,
): DefinitionCandidate[] {
  const createTrigStmt = statement?.stmt?.CreateTrigStmt
  if (createTrigStmt === undefined) {
    return []
  }

  const triggerName = createTrigStmt.trigname
  const triggerNameLocation = findIndexFromBuffer(
    fileText, triggerName, statement.stmt_location,
  )
  const stmtLocation = statement.stmt_location || 0

  const definitionLink = LocationLink.create(
    uri,
    getRangeFromBuffer(
      fileText,
      stmtLocation,
      stmtLocation + statement.stmt_len,
    ),
    getRangeFromBuffer(
      fileText,
      triggerNameLocation,
      triggerNameLocation + triggerName.length,
    ),
  )

  return [
    {
      definition: triggerName,
      definitionLink,
    },
  ]
}

export function parseMaterializedViewDefinitions(
  fileText: string,
  statement: Statement,
  uri: URI,
  defaultSchema: string,
): DefinitionCandidate[] {
  const CreateTableAsStmt = statement?.stmt?.CreateTableAsStmt
  if (CreateTableAsStmt === undefined) {
    return []
  }

  const schemaName = CreateTableAsStmt.into.rel.schemaname || defaultSchema
  const viewName = CreateTableAsStmt.into.rel.relname
  const viewNameLocation = findIndexFromBuffer(
    fileText, viewName, statement.stmt_location,
  )
  const stmtLocation = statement.stmt_location || 0

  const definitionLink = LocationLink.create(
    uri,
    getRangeFromBuffer(
      fileText,
      stmtLocation,
      stmtLocation + statement.stmt_len,
    ),
    getRangeFromBuffer(
      fileText,
      viewNameLocation,
      viewNameLocation + viewName.length,
    ),
  )

  return makeMultiSchemaDefinitionCandidates(
    viewName,
    definitionLink,
    schemaName,
    defaultSchema,
  )
}

function makeMultiSchemaDefinitionCandidates(
  definitionName: string,
  definitionLink: DefinitionLink,
  schema: string | undefined,
  defaultSchema: string,
): DefinitionCandidate[] {
  const candidates = [
    {
      definition: (schema || defaultSchema) + "." + definitionName,
      definitionLink,
    },
  ]

  // On the default schema, add candidate without schema.
  if (schema === undefined || schema === defaultSchema) {
    candidates.push({
      definition: definitionName,
      definitionLink,
    })
  }

  return candidates
}
