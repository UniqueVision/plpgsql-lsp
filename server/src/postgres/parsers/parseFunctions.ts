import { Logger, URI } from "vscode-languageserver"

import { ParsedTypeError } from "@/errors"
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
        try {
          return getCreateFunctions(statement)
        }
        catch (error: unknown) {
          logger.error(`ParseFunctionError: ${(error as Error).message} (${uri})`)
        }
      }

      return []
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
  const funcname = createFunctionStmt.funcname
  const options = createFunctionStmt.options
  if (funcname === undefined) {
    throw new ParsedTypeError("createFunctionStmt.funcname is undefined!")
  }
  if (options === undefined) {
    throw new ParsedTypeError("createFunctionStmt.options is undefined!")
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
