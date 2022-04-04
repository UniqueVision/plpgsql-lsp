import { Logger, URI } from "vscode-languageserver"

import {
  QueryParameterInfo, sanitizeFileWithQueryParameters,
} from "@/postgres/parameters"
import { getStmtements, Statement } from "@/postgres/parsers/statement"
import { readFileFromUri } from "@/utilities/text"

export interface FunctionInfo {
  functionName: string,
  location: number | undefined,
}

export async function getFunctions(
  uri: URI,
  queryParameterInfo: QueryParameterInfo | null,
  logger: Logger,
): Promise<FunctionInfo[]> {
  const [fileText] = sanitizeFileWithQueryParameters(
    readFileFromUri(uri), queryParameterInfo, logger,
  )

  const stmtements = await getStmtements(fileText)
  if (stmtements === undefined) {
    return []
  }

  return stmtements.flatMap(
    (statement) => {
      if (statement?.stmt?.CreateFunctionStmt !== undefined) {
        return getCreateFunctions(statement)
      }
      else {
        return []
      }
    },
  )
}

function getCreateFunctions(
  statement: Statement,
): FunctionInfo[] {
  const createFunctionStmt = statement?.stmt?.CreateFunctionStmt
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
