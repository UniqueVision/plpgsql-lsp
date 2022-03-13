import { LocationLink, URI } from "vscode-languageserver"

import { Statement } from "@/postgres/parsers/statement"
import { DefinitionCandidate } from "@/server/definitionMap"
import { findIndexFromBuffer, getRangeFromBuffer } from "@/utilities/text"

export function getDefinitions(
  fileText: string,
  stmts: Statement[],
  uri: URI,
  defaultSchema: string,
): DefinitionCandidate[] {
  return stmts.flatMap(
    (stmt) => {
      if (stmt?.stmt?.CreateStmt !== undefined) {
        return getTableDefinitions(fileText, stmt, uri, defaultSchema)
      }
      else if (stmt?.stmt?.ViewStmt !== undefined) {
        return getViewDefinitions(fileText, stmt, uri, defaultSchema)
      }
      else if (stmt?.stmt?.CompositeTypeStmt !== undefined) {
        return getTypeDefinitions(fileText, stmt, uri, defaultSchema)
      }
      else if (stmt?.stmt?.CreateFunctionStmt !== undefined) {
        return getFunctionDefinitions(fileText, stmt, uri, defaultSchema)
      }
      else {
        return []
      }
    },
  )
}

export function getTableDefinitions(
  fileText: string,
  stmt: Statement,
  uri: URI,
  defaultSchema: string,
): DefinitionCandidate[] {
  const createStmt = stmt?.stmt?.CreateStmt
  if (createStmt === undefined) {
    return []
  }

  const schemaname = createStmt.relation.schemaname
  const relname = createStmt.relation.relname
  const definitionLink = LocationLink.create(
    uri,
    getRangeFromBuffer(
      fileText,
      stmt.stmt_location,
      stmt.stmt_location + stmt.stmt_len,
    ),
    getRangeFromBuffer(
      fileText,
      createStmt.relation.location,
      createStmt.relation.location
      + (schemaname !== undefined ? (schemaname + ".").length : 0)
      + relname.length,
    ),
  )

  const candidates = [
    {
      definition: (schemaname || defaultSchema) + "." + relname,
      definitionLink,
    },
  ]

  // When default schema, add raw relname candidate.
  if (schemaname === undefined || schemaname === defaultSchema) {
    candidates.push({
      definition: relname,
      definitionLink,
    })
  }

  return candidates
}

export function getViewDefinitions(
  fileText: string,
  stmt: Statement,
  uri: URI,
  defaultSchema: string,
): DefinitionCandidate[] {
  const createStmt = stmt?.stmt?.ViewStmt
  if (createStmt === undefined) {
    return []
  }

  const schemaname = createStmt.view.schemaname
  const relname = createStmt.view.relname
  const definitionLink = LocationLink.create(
    uri,
    getRangeFromBuffer(
      fileText,
      stmt.stmt_location,
      stmt.stmt_location + stmt.stmt_len,
    ),
    getRangeFromBuffer(
      fileText,
      createStmt.view.location,
      createStmt.view.location
      + (schemaname !== undefined ? (schemaname + ".").length : 0)
      + relname.length,
    ),
  )

  const candidates = [
    {
      definition: (schemaname || defaultSchema) + "." + relname,
      definitionLink,
    },
  ]

  // When default schema, add raw relname candidate.
  if (schemaname === undefined || schemaname === defaultSchema) {
    candidates.push({
      definition: relname,
      definitionLink,
    })
  }

  return candidates
}

export function getTypeDefinitions(
  fileText: string,
  stmt: Statement,
  uri: URI,
  defaultSchema: string,
): DefinitionCandidate[] {
  const compositTypeStmt = stmt?.stmt?.CompositeTypeStmt
  if (compositTypeStmt === undefined) {
    return []
  }
  const relname = compositTypeStmt.typevar.relname
  const schemaname = compositTypeStmt.typevar.schemaname

  const definitionLink = LocationLink.create(
    uri,
    getRangeFromBuffer(
      fileText,
      stmt.stmt_location,
      stmt.stmt_location + stmt.stmt_len,
    ),
    getRangeFromBuffer(
      fileText,
      compositTypeStmt.typevar.location,
      compositTypeStmt.typevar.location + relname.length,
    ),
  )

  const candidates = [
    {
      definition: (schemaname || defaultSchema) + "." + relname,
      definitionLink,
    },
  ]

  // When default schema, add raw relname candidate.
  if (schemaname === undefined || schemaname === defaultSchema) {
    candidates.push({
      definition: relname,
      definitionLink,
    })
  }

  return candidates
}

export function getFunctionDefinitions(
  fileText: string,
  stmt: Statement,
  uri: URI,
  defaultSchema: string,
): DefinitionCandidate[] {
  const createFunctionStmt = stmt?.stmt?.CreateFunctionStmt
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
    fileText, definition, stmt.stmt_location,
  )

  const definitionLink = LocationLink.create(
    uri,
    getRangeFromBuffer(
      fileText,
      stmt.stmt_location,
      stmt.stmt_location + stmt.stmt_len,
    ),
    getRangeFromBuffer(
      fileText,
      functionNameLocation,
      functionNameLocation + definition.length,
    ),
  )

  const candidates = [
    {
      definition: (schemaname || defaultSchema) + "." + functionName,
      definitionLink,
    },
  ]

  if (schemaname === undefined || schemaname === defaultSchema) {
    candidates.push({
      definition: functionName,
      definitionLink,
    })
  }

  return candidates
}
