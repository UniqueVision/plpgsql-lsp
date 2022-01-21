
export interface Statement {
  stmt: StatementData
}

export interface StatementData {
  CreateStmt?: CreateStmt
  CompositeTypeStmt?: CompositeTypeStmt
  CreateFunctionStmt?: CreateFunctionStmt
}

export interface CreateStmt {
  relation: CreateStmtRelation
}

export interface CreateStmtRelation {
  schemaname?: string
  relname?:string
}

export interface CompositeTypeStmt {
  typevar?: CompositeTypeStmtTypevar
}

export interface CompositeTypeStmtTypevar {
  relname?: string
}

export interface CreateFunctionStmt {
  funcname?: CreateFunctionStmtFuncName[]
}

export interface CreateFunctionStmtFuncName {
  String?: CreateFunctionStmtFuncNameString
}

export interface CreateFunctionStmtFuncNameString {
  str?: string
}
