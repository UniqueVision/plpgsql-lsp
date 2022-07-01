import { Logger, Range } from "vscode-languageserver"

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
  fileText: string,
  statements: Statement[],
  logger: Logger,
): CreateStatementInfo[] {
  return statements.flatMap(
    (statement) => {
      if (statement?.stmt?.CreateStmt !== undefined) {
        return parseTableCreateStatements(fileText, statement, logger)
      }
      else if (statement?.stmt?.ViewStmt !== undefined) {
        return parseViewCreateStatements(fileText, statement, logger)
      }
      else if (statement?.stmt?.CompositeTypeStmt !== undefined) {
        return parseTypeCreateStatements(fileText, statement, logger)
      }
      else if (statement?.stmt?.CreateDomainStmt !== undefined) {
        return parseDomainCreateStatements(fileText, statement, logger)
      }
      else if (statement?.stmt?.CreateFunctionStmt !== undefined) {
        return parseFunctionCreateStatements(fileText, statement, logger)
      }
      else if (statement?.stmt?.CreateTrigStmt !== undefined) {
        return parseTriggerCreateStatements(fileText, statement, logger)
      }
      else if (statement?.stmt?.IndexStmt !== undefined) {
        return parseIndexCreateStatements(fileText, statement, logger)
      }
      else if (statement?.stmt?.CreateTableAsStmt !== undefined) {
        if (statement?.stmt?.CreateTableAsStmt?.relkind === "OBJECT_MATVIEW") {
          return parseMaterializedViewCreateStatements(fileText, statement, logger)
        }
      }

      return []
    },
  )
}

export function parseTableCreateStatements(
  fileText: string,
  statement: Statement,
  logger: Logger,
): CreateStatementInfo[] {
  const createStmt = statement?.stmt?.CreateStmt
  if (createStmt === undefined) {
    return []
  }

  const schemaname = createStmt.relation.schemaname
  const relname = createStmt.relation.relname
  const stmtLocation = statement.stmt_location ?? 0

  if (relname === undefined) {
    logger.warn("CreateStmt.relation.relname is undefined!")

    return []
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
  logger: Logger,
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
    logger.warn("ViewStmt.view.relname is undefined!")

    return []
  }
  else if (location === undefined) {
    logger.warn("ViewStmt.view.location is undefined!")

    return []
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
  logger: Logger,
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
    logger.warn("CompositeTypeStmt.typevar.relname is undefined!")

    return []
  }
  else if (location === undefined) {
    logger.warn("CompositeTypeStmt.typevar.location is undefined!")

    return []
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
  logger: Logger,
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
    logger.warn("CreateDomainStmt.domainname is undefined!")

    return []
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
  logger: Logger,
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
    logger.warn("CreateFunctionStmt.funcname is undefined!")

    return []
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
  logger: Logger,
): CreateStatementInfo[] {
  const IndexStmt = statement?.stmt?.IndexStmt
  if (IndexStmt === undefined) {
    return []
  }

  const idxname = IndexStmt?.idxname

  if (idxname === undefined) {
    logger.warn("IndexStmt.idxname is undefined!")

    return []
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
  logger: Logger,
): CreateStatementInfo[] {
  const createTrigStmt = statement?.stmt?.CreateTrigStmt
  if (createTrigStmt === undefined) {
    return []
  }

  const trigname = createTrigStmt.trigname
  if (trigname === undefined) {
    logger.warn("CreateTrigStmt.trigname is undefined!")

    return []
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
  logger: Logger,
): CreateStatementInfo[] {
  const createTableAsStmt = statement?.stmt?.CreateTableAsStmt
  if (createTableAsStmt === undefined) {
    return []
  }

  const schemaname = createTableAsStmt.into.rel.schemaname
  const relname = createTableAsStmt.into.rel.relname
  if (relname === undefined) {
    logger.warn("CreateTableAsStmt.into.rel.relname is undefined!")

    return []
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
