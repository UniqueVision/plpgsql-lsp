import {
  SymbolInformation,
  SymbolKind,
  URI,
} from "vscode-languageserver"

import { PostgresKind } from "@/postgres/kind"
import { parseStmtements, Statement } from "@/postgres/parsers/statement"
import { neverReach } from "@/utilities/neverReach"
import { findIndexFromBuffer, getRangeFromBuffer } from "@/utilities/text"

function convertToSymbleKind(kind: PostgresKind): SymbolKind {
  switch (kind) {
    case PostgresKind.Schema:
      return SymbolKind.Module
    case PostgresKind.Table:
      return SymbolKind.Class
    case PostgresKind.View:
      return SymbolKind.Class
    case PostgresKind.MaterializedView:
      return SymbolKind.Class
    case PostgresKind.Type:
      return SymbolKind.Struct
    case PostgresKind.Domain:
      return SymbolKind.Struct
    case PostgresKind.Index:
      return SymbolKind.Struct
    case PostgresKind.Function:
      return SymbolKind.Function
    case PostgresKind.Trigger:
      return SymbolKind.Event
    default: {
      const unknownKind: never = kind
      neverReach( `"${unknownKind}" is unknown "PostgresKind".` )
    }
  }
}

export async function parseDocumentSymbols(
  fileText: string,
  uri: URI,
  defaultSchema: string,
): Promise<SymbolInformation[] | undefined> {
  const statements = await parseStmtements(fileText)
  if (statements === undefined) {
    return undefined
  }

  return statements.flatMap(
    (statement) => {
      if (statement?.stmt?.CreateStmt !== undefined) {
        return parseTableDocumentSymbols(fileText, statement, uri, defaultSchema)
      }
      else if (statement?.stmt?.ViewStmt !== undefined) {
        return parseViewDocumentSymbols(fileText, statement, uri, defaultSchema)
      }
      else if (statement?.stmt?.CompositeTypeStmt !== undefined) {
        return parseTypeDocumentSymbols(fileText, statement, uri, defaultSchema)
      }
      else if (statement?.stmt?.CreateDomainStmt !== undefined) {
        return parseDomainDocumentSymbols(fileText, statement, uri, defaultSchema)
      }
      else if (statement?.stmt?.CreateFunctionStmt !== undefined) {
        return parseFunctionDocumentSymbols(fileText, statement, uri, defaultSchema)
      }
      else if (statement?.stmt?.CreateTrigStmt !== undefined) {
        return parseTriggerDocumentSymbols(fileText, statement, uri)
      }
      else if (statement?.stmt?.IndexStmt !== undefined) {
        return parseIndexDocumentSymbols(fileText, statement, uri)
      }
      else if (statement?.stmt?.CreateTableAsStmt !== undefined) {
        if (statement?.stmt?.CreateTableAsStmt?.relkind === "OBJECT_MATVIEW") {
          return parseMaterializedViewDocumentSymbols(
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

export function parseTableDocumentSymbols(
  fileText: string,
  statement: Statement,
  uri: URI,
  defaultSchema: string,
): SymbolInformation[] {
  const createStmt = statement?.stmt?.CreateStmt
  if (createStmt === undefined) {
    return []
  }

  const schemaName = createStmt.relation.schemaname || defaultSchema
  const relationName = createStmt.relation.relname

  return [
    {
      name: `${schemaName}.${relationName}`,
      kind: convertToSymbleKind(PostgresKind.Table),
      location: {
        uri: uri,
        range: getRangeFromBuffer(
          fileText,
          createStmt.relation.location,
          createStmt.relation.location
          + (schemaName !== undefined ? (schemaName + ".").length : 0)
          + relationName.length,
        ),
      },
    },
  ]
}

export function parseViewDocumentSymbols(
  fileText: string,
  statement: Statement,
  uri: URI,
  defaultSchema: string,
): SymbolInformation[] {
  const createStmt = statement?.stmt?.ViewStmt
  if (createStmt === undefined) {
    return []
  }

  const schemaName = createStmt.view.schemaname || defaultSchema
  const relationName = createStmt.view.relname

  return [
    {
      name: `${schemaName}.${relationName}`,
      kind: convertToSymbleKind(PostgresKind.View),
      location: {
        uri,
        range: getRangeFromBuffer(
          fileText,
          createStmt.view.location,
          createStmt.view.location
          + (schemaName !== undefined ? (schemaName + ".").length : 0)
          + relationName.length,
        ),
      },
    },
  ]
}

export function parseTypeDocumentSymbols(
  fileText: string,
  statement: Statement,
  uri: URI,
  defaultSchema: string,
): SymbolInformation[] {
  const compositTypeStmt = statement?.stmt?.CompositeTypeStmt
  if (compositTypeStmt === undefined) {
    return []
  }
  const relationName = compositTypeStmt.typevar.relname || defaultSchema
  const schemaName = compositTypeStmt.typevar.schemaname

  return [
    {
      name: `${schemaName}.${relationName}`,
      kind: convertToSymbleKind(PostgresKind.Type),
      location: {
        uri, range: getRangeFromBuffer(
          fileText,
          compositTypeStmt.typevar.location,
          compositTypeStmt.typevar.location + relationName.length,
        ),
      },
    },
  ]
}

export function parseDomainDocumentSymbols(
  fileText: string,
  statement: Statement,
  uri: URI,
  defaultSchema: string,
): SymbolInformation[] {
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
    schemaName = defaultSchema
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

  return [
    {
      name: `${schemaName}.${domainName}`,
      kind: convertToSymbleKind(PostgresKind.Domain),
      location: {
        uri,
        range: getRangeFromBuffer(
          fileText,
          domainNameLocation,
          domainNameLocation + definition.length,
        ),
      },
    },
  ]
}

export function parseFunctionDocumentSymbols(
  fileText: string,
  statement: Statement,
  uri: URI,
  defaultSchema: string,
): SymbolInformation[] {
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
    schemaName = defaultSchema
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

  return [
    {
      name: `${schemaName}.${functionName}`,
      kind: convertToSymbleKind(PostgresKind.Function),
      location: {
        uri,
        range: getRangeFromBuffer(
          fileText,
          functionNameLocation,
          functionNameLocation + definition.length,
        ),
      },
    },
  ]
}

export function parseIndexDocumentSymbols(
  fileText: string,
  statement: Statement,
  uri: URI,
): SymbolInformation[] {
  const IndexStmt = statement?.stmt?.IndexStmt
  if (IndexStmt === undefined) {
    return []
  }

  const indexName = IndexStmt.idxname
  const indexNameLocation = findIndexFromBuffer(
    fileText, indexName, statement.stmt_location,
  )

  return [
    {
      name: indexName,
      kind: convertToSymbleKind(PostgresKind.Index),
      location: {
        uri,
        range: getRangeFromBuffer(
          fileText,
          indexNameLocation,
          indexNameLocation + indexName.length,
        ),
      },
    },
  ]
}

export function parseTriggerDocumentSymbols(
  fileText: string,
  statement: Statement,
  uri: URI,
): SymbolInformation[] {
  const createTrigStmt = statement?.stmt?.CreateTrigStmt
  if (createTrigStmt === undefined) {
    return []
  }

  const triggerName = createTrigStmt.trigname
  const triggerNameLocation = findIndexFromBuffer(
    fileText, triggerName, statement.stmt_location,
  )

  return [
    {
      name: triggerName,
      kind: convertToSymbleKind(PostgresKind.Trigger),
      location: {
        uri,
        range: getRangeFromBuffer(
          fileText,
          triggerNameLocation,
          triggerNameLocation + triggerName.length,
        ),
      },
    },
  ]
}

export function parseMaterializedViewDocumentSymbols(
  fileText: string,
  statement: Statement,
  uri: URI,
  defaultSchema: string,
): SymbolInformation[] {
  const CreateTableAsStmt = statement?.stmt?.CreateTableAsStmt
  if (CreateTableAsStmt === undefined) {
    return []
  }

  const schemaName = CreateTableAsStmt.into.rel.schemaname || defaultSchema
  const viewName = CreateTableAsStmt.into.rel.relname
  const viewNameLocation = findIndexFromBuffer(
    fileText, viewName, statement.stmt_location,
  )

  return [
    {
      name: `${schemaName}.${viewName}`,
      kind: convertToSymbleKind(PostgresKind.MaterializedView),
      location: {
        uri,
        range: getRangeFromBuffer(
          fileText,
          viewNameLocation,
          viewNameLocation + viewName.length,
        ),
      },
    },
  ]
}
