import { uinteger } from "vscode-languageserver"

export interface Statement {
  stmt: StatementItem
  stmt_location: uinteger
  stmt_len: uinteger
}

export interface StatementItem {
  CreateStmt?: CreateStmt
  CompositeTypeStmt?: CompositeTypeStmt
  CreateFunctionStmt?: CreateFunctionStmt
}

export interface CreateStmt {
  relation: CreateStmtRelation
}

export interface CreateStmtRelation {
  schemaname?: string
  relname: string
  location: uinteger
}

export interface CompositeTypeStmt {
  typevar: CompositeTypeStmtTypevar
}

export interface CompositeTypeStmtTypevar {
  relname: string
  relpersistence: string
  location: uinteger
}

export interface CreateFunctionStmt {
  funcname: CreateFunctionStmtFuncName[]
}

export interface CreateFunctionStmtFuncName {
  String: CreateFunctionStmtFuncNameString
}

export interface CreateFunctionStmtFuncNameString {
  str: string
}
