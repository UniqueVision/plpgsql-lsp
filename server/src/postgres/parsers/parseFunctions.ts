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

export interface TriggerInfo {
  functionName: string,
  location: number | undefined,
  relname: string,
}

export async function parseFunctions(
  uri: URI,
  queryParameterInfo: QueryParameterInfo | null,
  logger: Logger,
): Promise<[FunctionInfo[], TriggerInfo[]]> {
  const fileText = await readFileFromUri(uri)
  if (fileText === null) {
    return [[], []]
  }

  const [sanitizedFileText] = sanitizeFileWithQueryParameters(
    fileText, queryParameterInfo, logger,
  )

  const stmtements = await parseStmtements(uri, sanitizedFileText, logger)
  if (stmtements === undefined) {
    return [[], []]
  }
  const functions: FunctionInfo[] = []
  const triggers: TriggerInfo[] = []
  stmtements.forEach(
    (statement) => {

      if (statement?.stmt?.CreateFunctionStmt !== undefined ) {
        try {
          functions.push(...getCreateFunctions(statement))
        }
        catch (error: unknown) {
          logger.error(`ParseFunctionError: ${(error as Error).message} (${uri})`)
        }
      }

      if (statement?.stmt?.CreateTrigStmt !== undefined ) {
        logger.info(`Statically analyzing trigger: ${JSON.stringify(statement)}`)
        try {
          triggers.push(...getCreateTriggers(statement))
        }
        catch (error: unknown) {
          logger.error(`ParseFunctionError: ${(error as Error).message} (${uri})`)
        }
      }
    },
  )

  logger.error(JSON.stringify(triggers))

  return [functions, triggers]
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


function getCreateTriggers(
  statement: Statement,
): TriggerInfo[] {
  const createTriggerStmt = statement?.stmt?.CreateTrigStmt
  if (createTriggerStmt === undefined) {
    return []
  }

  const funcname = createTriggerStmt.funcname
  if (funcname === undefined) {
    throw new ParsedTypeError("createTriggerStmt.funcname is undefined!")
  }
  let relname = createTriggerStmt.relation?.relname || ""
  if (relname === "") {
    throw new ParsedTypeError("createTriggerStmt.relation?.relname is undefined!")
  }

  const schema = createTriggerStmt.relation?.schemaname
  if (schema) {
    relname = `${schema}.${relname}`
  }

  return funcname.flatMap(
    (funcname) => {
      const functionName = funcname.String.str
      if (functionName === undefined) {
        return []
      }

      return [
        {
          functionName,
          location: undefined,
          relname,
        },
      ]
    },
  )
}
