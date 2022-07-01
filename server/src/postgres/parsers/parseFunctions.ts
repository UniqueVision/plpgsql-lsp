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
  const fileText = await readFileFromUri(uri)
  if (fileText === null) {
    return []
  }

  const [sanitizedFileText] = sanitizeFileWithQueryParameters(
    fileText, queryParameterInfo, logger,
  )

  const stmtements = await parseStmtements(uri, sanitizedFileText, logger)
  if (stmtements === undefined) {
    return []
  }

  return stmtements.flatMap(
    (statement) => {
      if (statement?.stmt?.CreateFunctionStmt !== undefined) {
        return getCreateFunctions(statement, logger)
      }
      else {
        return []
      }
    },
  )
}

function getCreateFunctions(
  statement: Statement,
  logger: Logger,
): FunctionInfo[] {
  const createFunctionStmt = statement?.stmt?.CreateFunctionStmt
  if (createFunctionStmt === undefined) {
    return []
  }
  const funcname = createFunctionStmt.funcname
  const options = createFunctionStmt.options
  if (funcname === undefined) {
    logger.warn("createFunctionStmt.funcname is undefined!")

    return []
  }
  if (options === undefined) {
    logger.warn("createFunctionStmt.options is undefined!")

    return []
  }

  return funcname.flatMap(
    (funcname) => {
      const functionName = funcname.String.str
      if (functionName === undefined) {
        return []
      }

      const locationCandidates = options
        .filter((option) => option.DefElem.defname === "as")
        .map((option) => option.DefElem.location)

      return [
        {
          functionName,
          location: locationCandidates?.[0] ?? undefined,
        },
      ]
    },
  )
}
