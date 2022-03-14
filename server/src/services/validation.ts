import {
  Diagnostic, DiagnosticSeverity, Logger,
} from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { getFunctionList } from "@/postgres/parsers/getFunctionList"
import { PostgresPool } from "@/postgres/pool"
import {
  queryFileFunctionsAnalysis,
} from "@/postgres/queries/queryFileFunctionsAnalysis"
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
  let diagnostics = await checkSyntax(
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

async function checkSyntax(
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
  const errors = await queryFileFunctionsAnalysis(
    pgPool,
    textDocument,
    await getFunctionList(textDocument.uri),
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
