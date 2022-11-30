import { Diagnostic, DiagnosticSeverity, Logger } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { PostgresPool } from "@/postgres"
import { QueryParameterInfo } from "@/postgres/parameters"
import { parseFunctions } from "@/postgres/parsers/parseFunctions"
import { queryFileStaticAnalysis } from "@/postgres/queries/queryFileStaticAnalysis"
import { queryFileSyntaxAnalysis } from "@/postgres/queries/queryFileSyntaxAnalysis"
import { Settings, StatementsSettings } from "@/settings"

type ValidateTextDocumentOptions = {
  isComplete: boolean,
  hasDiagnosticRelatedInformationCapability: boolean,
  queryParameterInfo: QueryParameterInfo | null,
  statements?: StatementsSettings,
  plpgsqlCheckSchema?: string,
  migrations?: Settings["migrations"]
}

export async function validateTextDocument(
  pgPool: PostgresPool,
  document: TextDocument,
  options: ValidateTextDocumentOptions,
  settings: Settings,
  logger: Logger,
): Promise<Diagnostic[]> {
  let diagnostics: Diagnostic[] = []
  diagnostics = await validateSyntaxAnalysis(
    pgPool,
    document,
    options,
    settings,
    logger,
  )

  // TODO static analysis for statements
  // if (diagnostics.filter(d => d.severity === DiagnosticSeverity.Error).length === 0) {
  if (diagnostics.length === 0) {
    diagnostics = await validateStaticAnalysis(
      pgPool,
      document,
      options,
      logger,
    )
  }

  return diagnostics
}

export async function isCorrectFileValidation(
  pgPool: PostgresPool,
  document: TextDocument,
  settings: Settings,
  logger: Logger,
): Promise<boolean> {
  const diagnostics = await validateTextDocument(
    pgPool,
    document,
    {
      isComplete: false,
      queryParameterInfo: null,
      hasDiagnosticRelatedInformationCapability: false,
    },
    settings,
    logger,
  )

  // Check file has no validation error.
  return diagnostics.filter(
    diagnostic => diagnostic.severity === DiagnosticSeverity.Error,
  ).length === 0
}

async function validateSyntaxAnalysis(
  pgPool: PostgresPool,
  document: TextDocument,
  options: ValidateTextDocumentOptions,
  settings: Settings,
  logger: Logger,
): Promise<Diagnostic[]> {
  return await queryFileSyntaxAnalysis(
    pgPool,
    document,
    options,
    settings,
    logger,
  )
}

async function validateStaticAnalysis(
  pgPool: PostgresPool,
  document: TextDocument,
  options: ValidateTextDocumentOptions,
  logger: Logger,
): Promise<Diagnostic[]> {
  const [functions, triggers] = await parseFunctions(
    document.uri,
    options.queryParameterInfo,
    logger,
  )
  const errors = await queryFileStaticAnalysis(
    pgPool,
    document,
    functions,
    triggers,
    {
      isComplete: options.isComplete,
      queryParameterInfo: options.queryParameterInfo,
      plpgsqlCheckSchema: options.plpgsqlCheckSchema,
      migrations: options.migrations,
    },
    logger,
  )

  return errors.flatMap(
    ({ level, range, message }) => {
      const severity = (() => {
        return (["warning", "warning extra"].includes(level))
          ? DiagnosticSeverity.Warning
          : DiagnosticSeverity.Error
      })()

      const diagnostic: Diagnostic = {
        severity,
        range,
        message,
      }

      if (options.hasDiagnosticRelatedInformationCapability) {
        diagnostic.relatedInformation = [
          {
            location: {
              uri: document.uri,
              range: Object.assign({}, diagnostic.range),
            },
            message: `Static analysis ${level}: ${message}`,
          },
        ]
      }

      return diagnostic
    },
  )
}
