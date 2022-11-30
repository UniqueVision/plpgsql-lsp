import path from "path"
import { Diagnostic, DiagnosticSeverity, Logger } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"
import { URI } from "vscode-uri"
import { uriToFsPath } from "vscode-uri/lib/umd/uri"

import { MigrationError } from "@/errors"
import { PostgresClient, PostgresPool } from "@/postgres"
import { QueryParameterInfo } from "@/postgres/parameters"
import { parseFunctions } from "@/postgres/parsers/parseFunctions"
import { queryFileStaticAnalysis } from "@/postgres/queries/queryFileStaticAnalysis"
import { queryFileSyntaxAnalysis } from "@/postgres/queries/queryFileSyntaxAnalysis"
import { runMigration } from "@/services/migrations"
import { Settings, StatementsSettings } from "@/settings"
import { getTextAllRange } from "@/utilities/text"

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
  const diagnostics: Diagnostic[] = []

  const pgClient = await pgPool.connect()

  await setupEnvironment(pgClient, options)

  try {
    await pgClient.query("BEGIN")

    if (settings.migrations) {
      await runMigration(
        pgClient,
        document,
        settings.migrations,
        logger,
      )
    }
  } catch (error: unknown) {
    if (error instanceof MigrationError) {
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: getTextAllRange(document),
        message: `${error.migrationPath}: ${error.message}`,
        relatedInformation: [
          {
            location: {
              uri: path.resolve(error.migrationPath),
              range: getTextAllRange(document),
            },
            message: error.message,
          },
        ],
      })
    }

    // Restart transaction.
    await pgClient.query("ROLLBACK")
    await pgClient.query("BEGIN")
  } finally {
    await pgClient.query("SAVEPOINT migrations")
  }

  const syntaxDiagnostics = await validateSyntaxAnalysis(
    pgClient,
    document,
    options,
    settings,
    logger,
  )
  diagnostics.push(...syntaxDiagnostics)

  if (diagnostics.filter(d => d.severity === DiagnosticSeverity.Error).length === 0) {
    await pgClient.query("SAVEPOINT validated_syntax")
    const staticDiagnostics = await validateStaticAnalysis(
      pgClient,
      document,
      options,
      logger,
    )
    diagnostics.push(...staticDiagnostics)
  }

  await pgClient.query("ROLLBACK")
  pgClient.release()

  return diagnostics
}

async function setupEnvironment(
  pgClient: PostgresClient,
  options: ValidateTextDocumentOptions,
) {
  const plpgsqlCheckSchema = options.plpgsqlCheckSchema
  // outside transaction
  if (plpgsqlCheckSchema) {
    await pgClient.query(`
    SELECT
    set_config(
      'search_path',
      current_setting('search_path') || ',${plpgsqlCheckSchema}',
      false
    )
    WHERE current_setting('search_path') !~ '(^|,)${plpgsqlCheckSchema}(,|$)'
    `)
  }
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
  pgClient: PostgresClient,
  document: TextDocument,
  options: ValidateTextDocumentOptions,
  settings: Settings,
  logger: Logger,
): Promise<Diagnostic[]> {
  return await queryFileSyntaxAnalysis(
    pgClient,
    document,
    options,
    settings,
    logger,
  )
}

async function validateStaticAnalysis(
  pgClient: PostgresClient,
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
    pgClient,
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
