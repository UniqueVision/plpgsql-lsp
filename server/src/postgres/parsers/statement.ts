import { uinteger } from "vscode-languageserver"

export interface Statement {
  stmt: StatementItem
  stmt_location?: uinteger
  stmt_len: uinteger
}

export interface StatementItem {
  CreateStmt?: CreateStmt
  ViewStmt?: ViewStmt
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

export interface ViewStmt {
  view: ViewStmtRelation
}

export interface ViewStmtRelation {
  schemaname?: string
  relname: string
  location: uinteger
}

export interface CompositeTypeStmt {
  typevar: CompositeTypeStmtTypevar
}

export interface CompositeTypeStmtTypevar {
  schemaname?: string
  relname: string
  relpersistence: string
  location: uinteger
}

export interface CreateFunctionStmt {
  is_procedure: boolean
  replace: boolean
  funcname: CreateFunctionStmtFuncName[]
  returnType: CreateFunctionStmtReturnType
  options: CreateFunctionStmtOption[]
}

export interface CreateFunctionStmtFuncName {
  String: CreateFunctionStmtFuncNameString
}

export interface CreateFunctionStmtReturnType {
  location: uinteger
}
export interface CreateFunctionStmtFuncNameString {
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
