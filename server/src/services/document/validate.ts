import {
  Diagnostic, DiagnosticSeverity, Logger,
} from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { getFunctionList } from "@/postgres/parsers/getFunctionList"
import { PostgresPool } from "@/postgres/pool"
import { analyzeFileFunctions } from "@/postgres/queries/analyzeFileFunctions"
import { analyzeFileSyntax } from "@/postgres/queries/analyzeFileSyntax"

export async function validateTextDocument(
  pgPool: PostgresPool,
  textDocument: TextDocument,
  logger: Logger,
  hasDiagnosticRelatedInformationCapability = false,
  isComplete = false,
): Promise<Diagnostic[] | undefined> {
  let diagnostics = await checkSyntax(
    pgPool,
    textDocument,
    logger,
    hasDiagnosticRelatedInformationCapability,
    isComplete,
  )

  if (diagnostics === undefined) {
    diagnostics = await checkStaticAnalysis(
      pgPool,
      textDocument,
      logger,
      hasDiagnosticRelatedInformationCapability,
      isComplete,
    )
  }

  return diagnostics

}

async function checkSyntax(
  pgPool: PostgresPool,
  textDocument: TextDocument,
  logger: Logger,
  hasDiagnosticRelatedInformationCapability = false,
  isComplete = false,
): Promise<Diagnostic[] | undefined> {

  const errors = await analyzeFileSyntax(
    pgPool,
    textDocument,
    isComplete,
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

    if (hasDiagnosticRelatedInformationCapability) {
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
  logger: Logger,
  hasDiagnosticRelatedInformationCapability = false,
  isComplete = false,
): Promise<Diagnostic[] | undefined> {

  const errors = await analyzeFileFunctions(
    pgPool,
    textDocument,
    await getFunctionList(textDocument.uri),
    isComplete,
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

      if (hasDiagnosticRelatedInformationCapability) {
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
