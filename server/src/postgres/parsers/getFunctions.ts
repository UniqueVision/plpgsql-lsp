import { parseQuery } from "libpg-query"
import { Logger, URI } from "vscode-languageserver"

import {
  QueryParameterInfo, sanitizeFileWithQueryParameters,
} from "@/postgres/parameters"
import { Statement } from "@/postgres/parsers/statement"
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
  let statements: Statement[] = []
  const [fileText] = sanitizeFileWithQueryParameters(
    readFileFromUri(uri), queryParameterInfo, logger,
  )

  try {
    const query = await parseQuery(fileText)
    statements = query?.["stmts"] || []
  }
  catch (error: unknown) {
    return []
  }

  return statements.flatMap(
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
