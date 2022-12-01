import { DatabaseError } from "pg"
import {
  Diagnostic, DiagnosticSeverity, Logger, uinteger,
} from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { PostgresClient } from "@/postgres"
import {
  getQueryParameterInfo, QueryParameterInfo,
  sanitizeFileWithQueryParameters,
} from "@/postgres/parameters"
import { Settings, StatementsSettings } from "@/settings"
import { neverReach } from "@/utilities/neverReach"
import {
  BEGIN_RE, COMMIT_RE, DISABLE_STATEMENT_VALIDATION_RE, ROLLBACK_RE, SQL_COMMENT_RE,
} from "@/utilities/regex"
import { getCurrentLineFromIndex, getTextAllRange } from "@/utilities/text"

export type SyntaxAnalysisOptions = {
  isComplete: boolean
  queryParameterInfo: QueryParameterInfo | null
  statements?: StatementsSettings
};

export async function queryFileSyntaxAnalysis(
  pgClient: PostgresClient,
  document: TextDocument,
  options: SyntaxAnalysisOptions,
  settings: Settings,
  logger: Logger,
): Promise<Diagnostic[]> {
  const diagnostics: Diagnostic[] = []
  const documentText = document.getText()

  let preparedStatements = [documentText]
  let statementSepRE: RegExp | undefined
  if (options.statements) {
    statementSepRE = new RegExp(`(${options.statements.separatorPattern})`, "g")
    preparedStatements = documentText.split(statementSepRE)
  }

  const statementNames: string[] = []
  for (let i = 0; i < preparedStatements.length; i++) {
    // Query each statements.
    const currentTextIndex = preparedStatements.slice(0, i).join("").length
    const statement = queryStatement(
      document,
      preparedStatements[i],
      currentTextIndex,
      statementNames,
      options,
      settings,
      logger,
    )
    if ("message" in statement) {
      diagnostics.push(statement)
      continue
    }
    const { sanitizedStatement, parameterSize } = statement

    try {
      await pgClient.query(sanitizedStatement, Array(parameterSize).fill(null))
    } catch (error: unknown) {
      diagnostics.push(statementError(
        document,
        options,
        error as DatabaseError,
        currentTextIndex,
        logger,
      ))
      if (preparedStatements.length > 0) {
        await pgClient.query("ROLLBACK TO migrations")
      }
    }
  }

  return diagnostics
}

function statementError(
  document: TextDocument,
  options: SyntaxAnalysisOptions,
  error: DatabaseError,
  currentTextIndex: number,
  logger: Logger,
): Diagnostic {
  const databaseError = error as DatabaseError
  const code = databaseError.code ?? "unknown"
  const message = databaseError.message
  if (options.isComplete) {
    logger.error(`SyntaxError ${code}: ${message} (${document.uri})`)
  }

  const range = (() => {
    if (error instanceof DatabaseError && error.position !== undefined) {
      const errorPosition = Number(error.position) + currentTextIndex

      return getCurrentLineFromIndex(document.getText(), errorPosition)
    } else {
      return getTextAllRange(document)
    }
  })()

  return {
    severity: DiagnosticSeverity.Error,
    range,
    message,
  }
}

function queryStatement(
  document: TextDocument,
  statement: string,
  currentTextIndex: number,
  statementNames: string[],
  options: SyntaxAnalysisOptions,
  settings: Settings,
  logger: Logger,
): { sanitizedStatement: string, parameterSize: uinteger } | Diagnostic {
  const maskedStatement = statement
    // do not execute the current file (e.g. migrations)
    .replace(BEGIN_RE, (m) => "-".repeat(m.length))
    .replace(COMMIT_RE, (m) => "-".repeat(m.length))
    .replace(ROLLBACK_RE, (m) => "-".repeat(m.length))

  if (options.statements
    && DISABLE_STATEMENT_VALIDATION_RE.test(maskedStatement)
    && options.statements?.diagnosticsLevels?.disableFlag === "warning"
  ) {
    return {
      severity: DiagnosticSeverity.Warning,
      range: getCurrentLineFromIndex(document.getText(), currentTextIndex),
      message: "Validation disabled",
    }
  }

  const queryParameterInfo = getQueryParameterInfo(
    document,
    maskedStatement.replace(SQL_COMMENT_RE, ""), // ignore possible matches with comments
    settings,
    logger,
  )

  if (queryParameterInfo !== null && !("type" in queryParameterInfo)) {
    return queryParameterInfo
  }

  const sanitized = sanitizeStatement(queryParameterInfo, maskedStatement)

  if (options.statements) {
    if (statementNames.includes(sanitized)) {
      return {
        severity: DiagnosticSeverity.Error,
        range: getCurrentLineFromIndex(document.getText(), currentTextIndex),
        message: `Duplicated statement '${sanitized}'`,
      }
    }
    statementNames.push(sanitized)
  }

  const [sanitizedStatement, parameterSize] = sanitizeFileWithQueryParameters(
    sanitized,
    queryParameterInfo,
    logger,
  )

  return {
    sanitizedStatement, parameterSize,
  }
}

function sanitizeStatement(
  queryParameterInfo: QueryParameterInfo | null,
  statement: string,
) {

  // replace inside single quotes only if any given pattern matches,
  // else we are overriding uuids, booleans in string form, etc.
  let re: RegExp
  if (queryParameterInfo) {
    const parameterInfoType = queryParameterInfo.type
    switch (parameterInfoType) {
      case undefined:
        break

      case "default":
        queryParameterInfo.queryParameterPattern.map(pattern => {
          re = makeParamPatternInStringPattern(pattern)
          statement = statement.replace(
            re, (match) => `${"_".repeat(match.length)}`,
          )
        })

        // remove parameters that were matched ignoring single quotes (can't replace
        // beforehand since given pattern may contain single quoted text)
        // to get all plausible params but don't exist after replacing
        queryParameterInfo.queryParameters =
          queryParameterInfo.queryParameters.filter(
            (param) => statement.includes(param),
          )

        break

      case "keyword":
        queryParameterInfo.keywordQueryParameterPattern.map(pattern => {
          re = makeParamPatternInStringPattern(pattern)
          statement = statement.replace(
            re, (match) => `${"_".repeat(match.length)}`,
          )
        })

        // remove parameters that were matched ignoring single quotes (can't replace
        // beforehand since given pattern may contain single quoted text)
        // to get all plausible params but don't exist after replacing
        queryParameterInfo.keywordParameters =
          queryParameterInfo.keywordParameters.filter(
            (param) => statement.includes(param),
          )

        break

      case "position":
        break

      default: {
        const unknwonType: never = parameterInfoType
        neverReach(`"${unknwonType}" is unknown "queryParameterInfo.type".`)
      }
    }
  }

  return statement
}

function makeParamPatternInStringPattern(
  paramPattern: string,
): RegExp {
  return new RegExp(
    "(?<=')[^']*.?"
    + paramPattern.replace("{keyword}", "[^']*?")
    + "(?='(?:[^']*'[^']*')*[^']*$)",
    "g",
  )
}
