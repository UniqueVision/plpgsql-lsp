import { parseQuery } from "libpg-query"
import { Logger, URI } from "vscode-languageserver"

import {
  QueryParameterInfo, sanitizeFileWithQueryParameters,
} from "@/postgres/parameters"
import { Statement } from "@/postgres/parsers/statement"
import { asyncFlatMap } from "@/utilities/functool"
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
  const [fileText] = await sanitizeFileWithQueryParameters(
    readFileFromUri(uri), queryParameterInfo, logger,
  )
  const query = await parseQuery(fileText)

  const statements: Statement[] | undefined = query?.["stmts"]
  if (statements === undefined) {
    return []
  }

  return asyncFlatMap(
    statements,
    async (statement) => {
      if (statement?.stmt?.CreateFunctionStmt !== undefined) {
        return await getCreateFunctions(statement)
      }
      else {
        return []
      }
    },
  )
}

async function getCreateFunctions(
  statement: Statement,
): Promise<FunctionInfo[]> {
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
