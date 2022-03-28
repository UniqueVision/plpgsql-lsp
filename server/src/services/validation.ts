import { Diagnostic, DiagnosticSeverity, Logger, uinteger } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

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
  queryParameterNumber: uinteger | null,
}

export async function validateTextDocument(
  pgPool: PostgresPool,
  document: TextDocument,
  options: ValidateTextDocumentOptions,
  logger: Logger,
): Promise<Diagnostic[] | undefined> {
  let diagnostics = await checkSyntaxAnalysis(
    pgPool,
    document,
    options,
    logger,
  )

  if (diagnostics === undefined) {
    diagnostics = await checkStaticAnalysis(
      pgPool,
      document,
      options,
      logger,
    )
  }

  return diagnostics
}

async function checkSyntaxAnalysis(
  pgPool: PostgresPool,
  document: TextDocument,
  options: ValidateTextDocumentOptions,
  logger: Logger,
): Promise<Diagnostic[] | undefined> {
  const errors = await queryFileSyntaxAnalysis(
    pgPool,
    document,
    {
      isComplete: options.isComplete,
      queryParameterNumber: options.queryParameterNumber,
    },
    logger,
  )

  if (errors === undefined) {
    return undefined
  }

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
): Promise<Diagnostic[] | undefined> {
  const errors = await queryFileStaticAnalysis(
    pgPool,
    document,
    await getFunctions(document.uri),
    {
      isComplete: options.isComplete,
      queryParameterNumber: options.queryParameterNumber,
    },
    logger,
  )

  if (errors === undefined) {
    return undefined
  }

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
