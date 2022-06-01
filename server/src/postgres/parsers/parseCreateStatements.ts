import { Range } from "vscode-languageserver"

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
): CreateStatementInfo[] {
  return statements.flatMap(
    (statement) => {
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

  const schemaName = createStmt.relation.schemaname
  const relationName = createStmt.relation.relname
  const stmtLocation = statement.stmt_location || 0

  return [
    {
      kind: PostgresKind.Table,
      schema: schemaName,
      name: relationName,
      targetRange: getRangeFromBuffer(
        fileText,
        stmtLocation,
        stmtLocation + statement.stmt_len,
      ),
      targetSelectionRange: getRangeFromBuffer(
        fileText,
        createStmt.relation.location,
        createStmt.relation.location
        + (schemaName !== undefined ? (schemaName + ".").length : 0)
        + relationName.length,
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

  const schemaName = createStmt.view.schemaname
  const relationName = createStmt.view.relname
  const stmtLocation = statement.stmt_location || 0

  return [
    {
      kind: PostgresKind.View,
      schema: schemaName,
      name: relationName,
      targetRange: getRangeFromBuffer(
        fileText,
        stmtLocation,
        stmtLocation + statement.stmt_len,
      ),
      targetSelectionRange: getRangeFromBuffer(
        fileText,
        createStmt.view.location,
        createStmt.view.location
        + (schemaName !== undefined ? (schemaName + ".").length : 0)
        + relationName.length,
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
  const relationName = compositTypeStmt.typevar.relname
  const schemaName = compositTypeStmt.typevar.schemaname
  const stmtLocation = statement.stmt_location || 0

  return [
    {
      kind: PostgresKind.Type,
      schema: schemaName,
      name: relationName,
      targetRange: getRangeFromBuffer(
        fileText,
        stmtLocation,
        stmtLocation + statement.stmt_len,
      ),
      targetSelectionRange: getRangeFromBuffer(
        fileText,
        compositTypeStmt.typevar.location,
        compositTypeStmt.typevar.location + relationName.length,
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

  return [
    {
      kind: PostgresKind.Domain,
      schema: schemaName,
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

  return [
    {
      kind: PostgresKind.Function,
      schema: schemaName,
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

  const indexName = IndexStmt.idxname
  const indexNameLocation = findIndexFromBuffer(
    fileText, indexName, statement.stmt_location,
  )
  const stmtLocation = statement.stmt_location || 0

  return [
    {
      kind: PostgresKind.Index,
      schema: undefined,
      name: indexName,
      targetRange: getRangeFromBuffer(
        fileText,
        stmtLocation,
        stmtLocation + statement.stmt_len,
      ),
      targetSelectionRange: getRangeFromBuffer(
        fileText,
        indexNameLocation,
        indexNameLocation + indexName.length,
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

  const triggerName = createTrigStmt.trigname
  const triggerNameLocation = findIndexFromBuffer(
    fileText, triggerName, statement.stmt_location,
  )
  const stmtLocation = statement.stmt_location || 0

  return [
    {
      kind: PostgresKind.Trigger,
      schema: undefined,
      name: triggerName,
      targetRange: getRangeFromBuffer(
        fileText,
        stmtLocation,
        stmtLocation + statement.stmt_len,
      ),
      targetSelectionRange: getRangeFromBuffer(
        fileText,
        triggerNameLocation,
        triggerNameLocation + triggerName.length,
      ),
    },
  ]
}

export function parseMaterializedViewCreateStatements(
  fileText: string,
  statement: Statement,
): CreateStatementInfo[] {
  const CreateTableAsStmt = statement?.stmt?.CreateTableAsStmt
  if (CreateTableAsStmt === undefined) {
    return []
  }

  const schemaName = CreateTableAsStmt.into.rel.schemaname
  const viewName = CreateTableAsStmt.into.rel.relname
  const viewNameLocation = findIndexFromBuffer(
    fileText, viewName, statement.stmt_location,
  )
  const stmtLocation = statement.stmt_location || 0

  return [
    {
      kind: PostgresKind.MaterializedView,
      schema: schemaName,
      name: viewName,
      targetRange: getRangeFromBuffer(
        fileText,
        stmtLocation,
        stmtLocation + statement.stmt_len,
      ),
      targetSelectionRange: getRangeFromBuffer(
        fileText,
        viewNameLocation,
        viewNameLocation + viewName.length,
      ),
    },
  ]
}
