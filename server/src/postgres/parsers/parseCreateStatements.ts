import { Logger, Range, URI } from "vscode-languageserver"

import { ParsedTypeError } from "@/errors"
import { PostgresKind } from "@/postgres/kind"
import { Statement } from "@/postgres/parsers/statement"
import { findIndexFromBuffer, getRangeFromBuffer } from "@/utilities/text"

export interface CreateStatementInfo {
  kind: PostgresKind
  schema: string | undefined,
  name: string,
  targetRange: Range
  targetSelectionRange: Range
}

export function parseCreateStatements(
  uri: URI,
  fileText: string,
  statements: Statement[],
  logger: Logger,
): CreateStatementInfo[] {
  return statements.flatMap(
    (statement) => {
      try {
        if (statement?.stmt?.CreateStmt !== undefined) {
          return parseTableCreateStatements(fileText, statement)
        }
        else if (statement?.stmt?.ViewStmt !== undefined) {
          return parseViewCreateStatements(fileText, statement)
        }
        else if (statement?.stmt?.CompositeTypeStmt !== undefined) {
          return parseTypeCreateStatements(fileText, statement)
        }
        else if (statement?.stmt?.CreateDomainStmt !== undefined) {
          return parseDomainCreateStatements(fileText, statement)
        }
        else if (statement?.stmt?.CreateFunctionStmt !== undefined) {
          return parseFunctionCreateStatements(fileText, statement)
        }
        else if (statement?.stmt?.CreateTrigStmt !== undefined) {
          return parseTriggerCreateStatements(fileText, statement)
        }
        else if (statement?.stmt?.IndexStmt !== undefined) {
          return parseIndexCreateStatements(fileText, statement)
        }
        else if (statement?.stmt?.CreateTableAsStmt !== undefined) {
          if (statement?.stmt?.CreateTableAsStmt?.relkind === "OBJECT_MATVIEW") {
            return parseMaterializedViewCreateStatements(fileText, statement)
          }
        }
      }
      catch (error: unknown) {
        logger.error(`ParseCreateStatementError: ${(error as Error).message} (${uri})`)
      }

      return []
    },
  )
}

export function parseTableCreateStatements(
  fileText: string,
  statement: Statement,
): CreateStatementInfo[] {
  const createStmt = statement?.stmt?.CreateStmt
  if (createStmt === undefined) {
    return []
  }

  const schemaname = createStmt.relation.schemaname
  const relname = createStmt.relation.relname
  const stmtLocation = statement.stmt_location ?? 0

  if (relname === undefined) {
    throw new ParsedTypeError("CreateStmt.relation.relname is undefined!")
  }

  return [
    {
      kind: PostgresKind.Table,
      schema: schemaname,
      name: relname,
      targetRange: getRangeFromBuffer(
        fileText,
        stmtLocation,
        stmtLocation + statement.stmt_len,
      ),
      targetSelectionRange: getRangeFromBuffer(
        fileText,
        createStmt.relation.location,
        createStmt.relation.location
        + (schemaname !== undefined ? (schemaname + ".").length : 0)
        + relname.length,
      ),
    },
  ]
}

export function parseViewCreateStatements(
  fileText: string,
  statement: Statement,
): CreateStatementInfo[] {
  const createStmt = statement?.stmt?.ViewStmt
  if (createStmt === undefined) {
    return []
  }

  const schemaname = createStmt.view.schemaname
  const relname = createStmt.view.relname
  const location = createStmt.view.location
  const stmtLocation = statement.stmt_location ?? 0

  if (relname === undefined) {
    throw new ParsedTypeError("ViewStmt.view.relname is undefined!")
  }
  else if (location === undefined) {
    throw new ParsedTypeError("ViewStmt.view.location is undefined!")
  }

  return [
    {
      kind: PostgresKind.View,
      schema: schemaname,
      name: relname,
      targetRange: getRangeFromBuffer(
        fileText,
        stmtLocation,
        stmtLocation + statement.stmt_len,
      ),
      targetSelectionRange: getRangeFromBuffer(
        fileText,
        location,
        location
        + (schemaname !== undefined ? (schemaname + ".").length : 0)
        + relname.length,
      ),
    },
  ]
}

export function parseTypeCreateStatements(
  fileText: string,
  statement: Statement,
): CreateStatementInfo[] {
  const compositTypeStmt = statement?.stmt?.CompositeTypeStmt
  if (compositTypeStmt === undefined) {
    return []
  }
  const relname = compositTypeStmt.typevar.relname
  const schemaname = compositTypeStmt.typevar.schemaname
  const location = compositTypeStmt.typevar.location
  const stmtLocation = statement.stmt_location ?? 0

  if (relname === undefined) {
    throw new ParsedTypeError("CompositeTypeStmt.typevar.relname is undefined!")
  }
  else if (location === undefined) {
    throw new ParsedTypeError("CompositeTypeStmt.typevar.location is undefined!")
  }

  return [
    {
      kind: PostgresKind.Type,
      schema: schemaname,
      name: relname,
      targetRange: getRangeFromBuffer(
        fileText,
        stmtLocation,
        stmtLocation + statement.stmt_len,
      ),
      targetSelectionRange: getRangeFromBuffer(
        fileText,
        location,
        location + relname.length,
      ),
    },
  ]
}

export function parseDomainCreateStatements(
  fileText: string,
  statement: Statement,
): CreateStatementInfo[] {
  const createDomainStmt = statement?.stmt?.CreateDomainStmt
  if (createDomainStmt === undefined) {
    return []
  }

  let schemaname = undefined
  let domainName = undefined
  const nameList = createDomainStmt.domainname
    ?.filter((name) => "String" in name)
    .map((name) => name.String.str)

  if (nameList === undefined) {
    throw new ParsedTypeError("CreateDomainStmt.domainname is undefined!")
  }

  if (nameList.length === 1) {
    domainName = nameList[0]
  }
  else if (nameList.length === 2) {
    schemaname = nameList[0]
    domainName = nameList[1]
  }
  else {
    return []
  }

  const definition = nameList.join(".")

  const domainNameLocation = findIndexFromBuffer(
    fileText, definition, statement.stmt_location,
  )
  const stmtLocation = statement.stmt_location ?? 0

  return [
    {
      kind: PostgresKind.Domain,
      schema: schemaname,
      name: domainName,
      targetRange: getRangeFromBuffer(
        fileText,
        stmtLocation,
        stmtLocation + statement.stmt_len,
      ),
      targetSelectionRange: getRangeFromBuffer(
        fileText,
        domainNameLocation,
        domainNameLocation + definition.length,
      ),
    },
  ]
}

export function parseFunctionCreateStatements(
  fileText: string,
  statement: Statement,
): CreateStatementInfo[] {
  const createFunctionStmt = statement?.stmt?.CreateFunctionStmt
  if (createFunctionStmt === undefined) {
    return []
  }

  let schemaname = undefined
  let functionName = undefined
  const nameList = createFunctionStmt.funcname
    ?.filter((name) => "String" in name)
    .map((name) => name.String.str)

  if (nameList === undefined) {
    throw new ParsedTypeError("CreateFunctionStmt.funcname is undefined!")
  }

  if (nameList.length === 1) {
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
  const stmtLocation = statement.stmt_location ?? 0

  return [
    {
      kind: PostgresKind.Function,
      schema: schemaname,
      name: functionName,
      targetRange: getRangeFromBuffer(
        fileText,
        stmtLocation,
        stmtLocation + statement.stmt_len,
      ),
      targetSelectionRange: getRangeFromBuffer(
        fileText,
        functionNameLocation,
        functionNameLocation + definition.length,
      ),
    },
  ]
}

export function parseIndexCreateStatements(
  fileText: string,
  statement: Statement,
): CreateStatementInfo[] {
  const IndexStmt = statement?.stmt?.IndexStmt
  if (IndexStmt === undefined) {
    return []
  }

  const idxname = IndexStmt?.idxname

  if (idxname === undefined) {
    throw new ParsedTypeError("IndexStmt.idxname is undefined!")
  }

  const indexNameLocation = findIndexFromBuffer(
    fileText, idxname, statement.stmt_location,
  )
  const stmtLocation = statement.stmt_location ?? 0

  return [
    {
      kind: PostgresKind.Index,
      schema: undefined,
      name: idxname,
      targetRange: getRangeFromBuffer(
        fileText,
        stmtLocation,
        stmtLocation + statement.stmt_len,
      ),
      targetSelectionRange: getRangeFromBuffer(
        fileText,
        indexNameLocation,
        indexNameLocation + idxname.length,
      ),
    },
  ]
}

export function parseTriggerCreateStatements(
  fileText: string,
  statement: Statement,
): CreateStatementInfo[] {
  const createTrigStmt = statement?.stmt?.CreateTrigStmt
  if (createTrigStmt === undefined) {
    return []
  }

  const trigname = createTrigStmt.trigname
  if (trigname === undefined) {
    throw new ParsedTypeError("CreateTrigStmt.trigname is undefined!")
  }

  const triggerNameLocation = findIndexFromBuffer(
    fileText, trigname, statement.stmt_location,
  )
  const stmtLocation = statement.stmt_location ?? 0

  return [
    {
      kind: PostgresKind.Trigger,
      schema: undefined,
      name: trigname,
      targetRange: getRangeFromBuffer(
        fileText,
        stmtLocation,
        stmtLocation + statement.stmt_len,
      ),
      targetSelectionRange: getRangeFromBuffer(
        fileText,
        triggerNameLocation,
        triggerNameLocation + trigname.length,
      ),
    },
  ]
}

export function parseMaterializedViewCreateStatements(
  fileText: string,
  statement: Statement,
): CreateStatementInfo[] {
  const createTableAsStmt = statement?.stmt?.CreateTableAsStmt
  if (createTableAsStmt === undefined) {
    return []
  }

  const schemaname = createTableAsStmt.into.rel.schemaname
  const relname = createTableAsStmt.into.rel.relname
  if (relname === undefined) {
    throw new ParsedTypeError("CreateTableAsStmt.into.rel.relname is undefined!")
  }

  const viewNameLocation = findIndexFromBuffer(
    fileText, relname, statement.stmt_location,
  )
  const stmtLocation = statement.stmt_location ?? 0

  return [
    {
      kind: PostgresKind.MaterializedView,
      schema: schemaname,
      name: relname,
      targetRange: getRangeFromBuffer(
        fileText,
        stmtLocation,
        stmtLocation + statement.stmt_len,
      ),
      targetSelectionRange: getRangeFromBuffer(
        fileText,
        viewNameLocation,
        viewNameLocation + relname.length,
      ),
    },
  ]
}
