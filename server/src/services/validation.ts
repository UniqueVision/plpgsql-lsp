import { Diagnostic, DiagnosticSeverity, Logger } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { QueryParameterInfo } from "@/postgres/parameters"
import { getFunctions } from "@/postgres/parsers/getFunctions"
import { PostgresPool } from "@/postgres/pool"
import {
  queryFileStaticAnalysis,
} from "@/postgres/queries/queryFileStaticAnalysis"
import {
  queryFileSyntaxAnalysis,
} from "@/postgres/queries/queryFileSyntaxAnalysis"

type ValidateTextDocumentOptions = {
  isComplete: boolean,
  hasDiagnosticRelatedInformationCapability: boolean,
  queryParameterInfo: QueryParameterInfo | null,
}

export async function validateTextDocument(
  pgPool: PostgresPool,
  document: TextDocument,
  options: ValidateTextDocumentOptions,
  logger: Logger,
): Promise<Diagnostic[]> {
  let diagnostics: Diagnostic[] = []
  diagnostics = await checkSyntaxAnalysis(
    pgPool,
    document,
    options,
    logger,
  )

  if (diagnostics.length === 0) {
    diagnostics = await checkStaticAnalysis(
      pgPool,
      document,
      options,
      logger,
    )
  }

  return diagnostics
}

export async function checkFileValidation(
  pgPool: PostgresPool,
  document: TextDocument,
  logger: Logger,
) {
  const diagnostics = await validateTextDocument(
    pgPool,
    document,
    {
      isComplete: false,
      queryParameterInfo: null,
      hasDiagnosticRelatedInformationCapability: false,
    },
    logger,
  )

  // Check file has no validation error.
  return diagnostics.filter(diagnostic => {
    return diagnostic.severity === DiagnosticSeverity.Error
  }).length === 0
}

async function checkSyntaxAnalysis(
  pgPool: PostgresPool,
  document: TextDocument,
  options: ValidateTextDocumentOptions,
  logger: Logger,
): Promise<Diagnostic[]> {
  const errors = await queryFileSyntaxAnalysis(
    pgPool,
    document,
    {
      isComplete: options.isComplete,
      queryParameterInfo: options.queryParameterInfo,
    },
    logger,
  )

  return errors.map(({ range, message }) => {
    const diagnostic: Diagnostic = {
      severity: DiagnosticSeverity.Error,
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
          message: `Syntax ${message}`,
        },
      ]
    }

    return diagnostic
  })
}

async function checkStaticAnalysis(
  pgPool: PostgresPool,
  document: TextDocument,
  options: ValidateTextDocumentOptions,
  logger: Logger,
): Promise<Diagnostic[]> {
  const errors = await queryFileStaticAnalysis(
    pgPool,
    document,
    await getFunctions(document.uri, options.queryParameterInfo, logger),
    {
      isComplete: options.isComplete,
      queryParameterInfo: options.queryParameterInfo,
    },
    logger,
  )

  return errors.flatMap(
    ({ level, range, message }) => {
      let severity: DiagnosticSeverity | undefined = undefined
      if (level === "warning") {
        severity = DiagnosticSeverity.Warning
      }
      else if (level === "warning extra") {
        severity = DiagnosticSeverity.Warning
      }
      else {
        severity = DiagnosticSeverity.Error
      }

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
