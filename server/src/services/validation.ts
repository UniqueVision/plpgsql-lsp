import { Diagnostic, DiagnosticSeverity, Logger } from "vscode-languageserver"
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
}

export async function validateTextDocument(
  pgPool: PostgresPool,
  textDocument: TextDocument,
  options: ValidateTextDocumentOptions,
  logger: Logger,
): Promise<Diagnostic[] | undefined> {
  let diagnostics = await checkSyntaxAnalysis(
    pgPool,
    textDocument,
    options,
    logger,
  )

  if (diagnostics === undefined) {
    diagnostics = await checkStaticAnalysis(
      pgPool,
      textDocument,
      options,
      logger,
    )
  }

  return diagnostics
}

async function checkSyntaxAnalysis(
  pgPool: PostgresPool,
  textDocument: TextDocument,
  options: ValidateTextDocumentOptions,
  logger: Logger,
): Promise<Diagnostic[] | undefined> {
  const errors = await queryFileSyntaxAnalysis(
    pgPool,
    textDocument,
    options.isComplete,
    logger,
  )

  if (errors === undefined) {
    return undefined
  }

  return errors.map(({ range, message }) => {
    const diagnosic: Diagnostic = {
      severity: DiagnosticSeverity.Error,
      range,
      message,
    }

    if (options.hasDiagnosticRelatedInformationCapability) {
      diagnosic.relatedInformation = [
        {
          location: {
            uri: textDocument.uri,
            range: Object.assign({}, diagnosic.range),
          },
          message: `Syntax error: ${message}`,
        },
      ]
    }

    return diagnosic
  })
}

async function checkStaticAnalysis(
  pgPool: PostgresPool,
  textDocument: TextDocument,
  options: ValidateTextDocumentOptions,
  logger: Logger,
): Promise<Diagnostic[] | undefined> {
  const errors = await queryFileStaticAnalysis(
    pgPool,
    textDocument,
    await getFunctions(textDocument.uri),
    options.isComplete,
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

      const diagnosic: Diagnostic = {
        severity,
        range,
        message,
      }

      if (options.hasDiagnosticRelatedInformationCapability) {
        diagnosic.relatedInformation = [
          {
            location: {
              uri: textDocument.uri,
              range: Object.assign({}, diagnosic.range),
            },
            message: `Static analysis ${level}: ${message}`,
          },
        ]
      }

      return diagnosic
    },
  )
}
