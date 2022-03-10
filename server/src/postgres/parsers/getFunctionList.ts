import { readFileSync } from "fs"
import { parseQuery } from "libpg-query"
import { URI } from "vscode-languageserver"

import { Statement } from "@/postgres/statement"
import { asyncFlatMap } from "@/utilities/asyncFlatMap"

export interface FunctionInfo {
  functionName: string,
  location: number | undefined,
}

export async function getFunctionList(
  resource: URI,
): Promise<FunctionInfo[]> {
  const fileText = readFileSync(resource.replace(/^file:\/\//, "")).toString()
  const query = await parseQuery(fileText)

  const stmts: Statement[] | undefined = query?.["stmts"]
  if (stmts === undefined) {
    return []
  }

  return asyncFlatMap(
    stmts,
    async (stmt) => {
      if (stmt?.stmt?.CreateFunctionStmt !== undefined) {
        return await getCreateFunctionList(stmt)
      }
      else {
        return []
      }
    },
  )
}

async function getCreateFunctionList(
  stmt: Statement,
): Promise<FunctionInfo[]> {
  const createFunctionStmt = stmt?.stmt?.CreateFunctionStmt
  if (createFunctionStmt === undefined) {
    return []
  }

  return createFunctionStmt.funcname.flatMap(
    (funcname) => {
      const functionName = funcname.String.str
      if (functionName === undefined) {
        return []
      }

      const locationCandidates = createFunctionStmt.options
        .filter((option) => option.DefElem.defname === "as")
        .map((option) => option.DefElem.location)

      return [
        {
          functionName,
          location: locationCandidates?.[0] || undefined,
        },
      ]
    },
  )
}
