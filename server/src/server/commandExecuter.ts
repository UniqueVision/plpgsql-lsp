import { Logger } from "vscode-jsonrpc/node"
import {
  Connection,
  ExecuteCommandParams, TextDocuments,
} from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument/lib/umd/main"

import { CommandName } from "@/commands"
import { FILE_QUERY_COMMAND } from "@/commands/executeFileQuery"
import { WORKSPACE_VALIDATION_COMMAND } from "@/commands/validateWorkspace"
import {
  CannotExecuteCommandWithQueryParametersError,
  CommandNotFoundError,
  DisableLanguageServerError,
  ExecuteFileQueryCommandDisabledError,
  NotCoveredFileError,
  PostgresPoolNotFoundError,
  WorkspaceNotFound,
  WrongCommandArgumentsError,
} from "@/errors"
import { getPool, PostgresPoolMap } from "@/postgres"
import { getQueryParameterInfo } from "@/postgres/parameters"
import { disableLanguageServer } from "@/utilities/disableLanguageServer"

import { SettingsManager } from "./settingsManager"

export type CommandExecuterOptions = {
  hasDiagnosticRelatedInformationCapability: boolean
}

export type CommandResultInfo = {
  needWorkspaceValidation?: boolean,
  document: TextDocument,
}

export class CommandExecuter {
  constructor(
    private readonly connection: Connection,
    private readonly pgPools: PostgresPoolMap,
    private readonly documents: TextDocuments<TextDocument>,
    private readonly settingsManager: SettingsManager,
    private readonly options: CommandExecuterOptions,
    private readonly logger: Logger,
  ) { }

  async execute(params: ExecuteCommandParams): Promise<CommandResultInfo> {
    const commandName = params.command as CommandName

    switch (commandName) {
      case FILE_QUERY_COMMAND.name: {
        return await this.executeFileQueryCommand(params)
      }
      case WORKSPACE_VALIDATION_COMMAND.name: {
        return await this.executeWorkspaceValidationCommand(params)
      }
      default: {
        const unknownCommand: never = commandName
        throw new CommandNotFoundError(unknownCommand)
      }
    }
  }

  private async executeFileQueryCommand(
    params: ExecuteCommandParams,
  ): Promise<CommandResultInfo> {
    if (params.arguments === undefined) {
      throw new WrongCommandArgumentsError()
    }

    const documentUri = params.arguments[0]
    const document = this.documents.get(documentUri)
    if (document === undefined) {
      throw new NotCoveredFileError()
    }

    if (disableLanguageServer(document)) {
      throw new DisableLanguageServerError()
    }

    const settings = await this.settingsManager.get(documentUri)
    if (!settings.enableExecuteFileQueryCommand) {
      throw new ExecuteFileQueryCommandDisabledError()
    }

    if (getQueryParameterInfo(document, settings, this.logger) !== null) {
      throw new CannotExecuteCommandWithQueryParametersError()
    }

    const pgPool = await getPool(this.pgPools, settings, this.logger)
    if (pgPool === undefined) {
      throw new PostgresPoolNotFoundError()
    }

    await FILE_QUERY_COMMAND.execute(pgPool, document, this.logger)

    return {
      needWorkspaceValidation: true,
      document,
    }
  }

  private async executeWorkspaceValidationCommand(
    params: ExecuteCommandParams,
  ): Promise<CommandResultInfo> {
    if (params.arguments === undefined) {
      throw new WrongCommandArgumentsError()
    }

    const documentUri = params.arguments[0]
    const document = this.documents.get(documentUri)
    if (document === undefined) {
      throw new NotCoveredFileError()
    }

    const workspaceFolder = await this.settingsManager.getWorkspaceFolder(
      document.uri,
    )
    if (workspaceFolder === undefined) {
      throw new WorkspaceNotFound()
    }

    const settings = await this.settingsManager.get(documentUri)

    const pgPool = await getPool(this.pgPools, settings, this.logger)
    if (pgPool === undefined) {
      throw new PostgresPoolNotFoundError()
    }

    await WORKSPACE_VALIDATION_COMMAND.execute(
      this.connection,
      pgPool,
      workspaceFolder,
      settings,
      {
        isComplete: true,
        hasDiagnosticRelatedInformationCapability:
          this.options.hasDiagnosticRelatedInformationCapability,
      },
      this.logger,
    )

    return {
      needWorkspaceValidation: false,
      document,
    }
  }
}
