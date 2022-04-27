import { DefinitionLink, LocationLink, URI } from "vscode-languageserver"

import { Statement } from "@/postgres/parsers/statement"
import { DefinitionCandidate } from "@/server/definitionsManager"
import { findIndexFromBuffer, getRangeFromBuffer } from "@/utilities/text"

export function getDefinitions(
  fileText: string,
  statements: Statement[],
  uri: URI,
  defaultSchema: string,
): DefinitionCandidate[] {
  return statements.flatMap(
    (statement) => {
      if (statement?.stmt?.CreateStmt !== undefined) {
        return getTableDefinitions(fileText, statement, uri, defaultSchema)
      }
      else if (statement?.stmt?.ViewStmt !== undefined) {
        return getViewDefinitions(fileText, statement, uri, defaultSchema)
      }
      else if (statement?.stmt?.CompositeTypeStmt !== undefined) {
        return getTypeDefinitions(fileText, statement, uri, defaultSchema)
      }
      else if (statement?.stmt?.CreateFunctionStmt !== undefined) {
        return getFunctionDefinitions(fileText, statement, uri, defaultSchema)
      }
      else if (statement?.stmt?.CreateTrigStmt !== undefined) {
        return getTriggerDefinitions(fileText, statement, uri)
      }
      else if (statement?.stmt?.IndexStmt !== undefined) {
        return getIndexDefinitions(fileText, statement, uri)
      }
      else {
        return []
      }
    },
  )
}

export function getTableDefinitions(
  fileText: string,
  statement: Statement,
  uri: URI,
  defaultSchema: string,
): DefinitionCandidate[] {
  const createStmt = statement?.stmt?.CreateStmt
  if (createStmt === undefined) {
    return []
  }

  const schemaname = createStmt.relation.schemaname
  const relname = createStmt.relation.relname
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
      + (schemaname !== undefined ? (schemaname + ".").length : 0)
      + relname.length,
    ),
  )

  return makeMultiSchemaDefinitionCandidates(
    relname,
    definitionLink,
    schemaname,
    defaultSchema,
  )
}

export function getViewDefinitions(
  fileText: string,
  statement: Statement,
  uri: URI,
  defaultSchema: string,
): DefinitionCandidate[] {
  const createStmt = statement?.stmt?.ViewStmt
  if (createStmt === undefined) {
    return []
  }

  const schemaname = createStmt.view.schemaname
  const relname = createStmt.view.relname
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
      + (schemaname !== undefined ? (schemaname + ".").length : 0)
      + relname.length,
    ),
  )

  return makeMultiSchemaDefinitionCandidates(
    relname,
    definitionLink,
    schemaname,
    defaultSchema,
  )
}

export function getTypeDefinitions(
  fileText: string,
  statement: Statement,
  uri: URI,
  defaultSchema: string,
): DefinitionCandidate[] {
  const compositTypeStmt = statement?.stmt?.CompositeTypeStmt
  if (compositTypeStmt === undefined) {
    return []
  }
  const relname = compositTypeStmt.typevar.relname
  const schemaname = compositTypeStmt.typevar.schemaname
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
      compositTypeStmt.typevar.location + relname.length,
    ),
  )

  return makeMultiSchemaDefinitionCandidates(
    relname,
    definitionLink,
    schemaname,
    defaultSchema,
  )
}

export function getFunctionDefinitions(
  fileText: string,
  statement: Statement,
  uri: URI,
  defaultSchema: string,
): DefinitionCandidate[] {
  const createFunctionStmt = statement?.stmt?.CreateFunctionStmt
  if (createFunctionStmt === undefined) {
    return []
  }

  let schemaname = undefined
  let functionName = undefined
  const nameList = createFunctionStmt.funcname
    .filter((name) => "String" in name)
    .map((name) => name.String.str)

  if (nameList.length === 0) {
    return []
  }
  else if (nameList.length === 1) {
    functionName = nameList[0]
  }
  else if (nameList.length === 2) {
    schemaname = nameList[0]
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
    schemaname,
    defaultSchema,
  )
}

export function getIndexDefinitions(
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

export function getTriggerDefinitions(
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
