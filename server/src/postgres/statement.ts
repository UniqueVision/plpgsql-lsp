import { uinteger } from "vscode-languageserver"

export interface Statement {
  stmt: StatementItem
  stmt_location: uinteger
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
  DefElem: CreateFunctionStmtOptionsDefElm
}

export interface CreateFunctionStmtOptionsDefElm {
  defname: string
  arg: CreateFunctionStmtOptionsDefElmArg
  location: uinteger
}

export interface CreateFunctionStmtOptionsDefElmArg {
  List: CreateFunctionStmtOptionsDefElmArgList
}

export interface CreateFunctionStmtOptionsDefElmArgList {
  items: CreateFunctionStmtOptionsDefElmArgListItem[]
}

export interface CreateFunctionStmtOptionsDefElmArgListItem {
  String: CreateFunctionStmtOptionsDefElmArgListItemString
}

export interface CreateFunctionStmtOptionsDefElmArgListItemString {
  str: string
}
