import { parseQuery } from "libpg-query"
import { integer, Logger, uinteger, URI } from "vscode-languageserver"

export interface Statement {
  stmt: StatementItem
  stmt_location?: uinteger
  stmt_len: uinteger
}

export interface StatementItem {
  CreateStmt?: CreateStmt
  ViewStmt?: ViewStmt
  CompositeTypeStmt?: CompositeTypeStmt
  CreateDomainStmt?: CreateDomainStmt
  CreateFunctionStmt?: CreateFunctionStmt
  CreateTrigStmt?: CreateTrigStmt
  IndexStmt?: IndexStmt
  CreateTableAsStmt?: CreateTableAsStmt
}

export interface CreateStmt {
  relation: CreateStmtRelation
}

export interface CreateStmtRelation {
  schemaname?: string
  relname?: string // Expected to be required
  location: uinteger // Expected to be required
}

export interface ViewStmt {
  view: ViewStmtRelation
}

export interface ViewStmtRelation {
  schemaname?: string
  relname?: string // Expected to be required
  location?: uinteger // Expected to be required
}

export interface CompositeTypeStmt {
  typevar: CompositeTypeStmtTypevar
}

export interface CompositeTypeStmtTypevar {
  schemaname?: string
  relname?: string // Expected to be required
  relpersistence?: string // Expected to be required
  location?: uinteger // Expected to be required
}

export interface CreateDomainStmt {
  domainname?: Name[] // Expected to be required
  typeName?: CreateDomainStmtTypeName // Expected to be required
}

export interface CreateDomainStmtTypeName {
  names: Name[]
}

export interface CreateFunctionStmt {
  is_procedure?: boolean
  replace?: boolean // Expected to be required
  funcname?: Name[] // Expected to be required
  returnType?: CreateFunctionStmtReturnType // Expected to be required
  options?: CreateFunctionStmtOption[] // Expected to be required
}

export interface Name {
  String: NameString
}

export interface CreateFunctionStmtReturnType {
  location: uinteger
}
export interface NameString {
  str: string
}

export interface CreateFunctionStmtOption {
  DefElem: CreateFunctionStmtOptionsDefElem
}

export interface CreateFunctionStmtOptionsDefElem {
  defname: string
  arg: CreateFunctionStmtOptionsDefElemArg
  location: uinteger
}

export interface CreateFunctionStmtOptionsDefElemArg {
  List: CreateFunctionStmtOptionsDefElemArgList
}

export interface CreateFunctionStmtOptionsDefElemArgList {
  items: CreateFunctionStmtOptionsDefElemArgListItem[]
}

export interface CreateFunctionStmtOptionsDefElemArgListItem {
  String: CreateFunctionStmtOptionsDefElemArgListItemString
}

export interface CreateFunctionStmtOptionsDefElemArgListItemString {
  str: string
}

export interface CreateTrigStmt {
  trigname?: string // Expected to be required
  relation?: CreateTrigStmtRelation // Expected to be required
  funcname?: Name[] // Expected to be required
  row?: boolean // Expected to be required
  events?: integer // Expected to be required
}

export interface CreateTrigStmtRelation {
  schemaname?: string
  relname: string
  inh: boolean
  relpersistence: string
}

export interface IndexStmt {
  idxname?: string // Expected to be required
}

export interface CreateTableAsStmt {
  into: CreateTableAsStmtInto
  relkind: string
}

export interface CreateTableAsStmtInto {
  rel: CreateTableAsStmtRelation
}

export interface CreateTableAsStmtRelation {
  schemaname?: string
  relname?: string // Expected to be required
  inh?: boolean // Expected to be required
  relpersistence?: string // Expected to be required
}

export async function parseStmtements(
  uri: URI, query: string, logger: Logger,
): Promise<Statement[] | undefined> {
  try {
    return (await parseQuery(query))?.["stmts"]
  }
  catch (error: unknown) {
    logger.error(`The "${uri}" cannot parse. ${(error as Error).message}`)

    return undefined
  }
}
