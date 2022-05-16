import { Logger, URI } from "vscode-languageserver"

import {
  QueryParameterInfo, sanitizeFileWithQueryParameters,
} from "@/postgres/parameters"
import { parseStmtements, Statement } from "@/postgres/parsers/statement"
import { readFileFromUri } from "@/utilities/text"

export interface FunctionInfo {
  functionName: string,
  location: number | undefined,
}

export async function parseFunctions(
  uri: URI,
  queryParameterInfo: QueryParameterInfo | null,
  logger: Logger,
): Promise<FunctionInfo[]> {
  const fileText = readFileFromUri(uri)
  if (fileText === null) {
    return []
  }

  const [sanitizedFileText] = sanitizeFileWithQueryParameters(
    fileText, queryParameterInfo, logger,
  )

  const stmtements = await parseStmtements(sanitizedFileText)
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
