import { Logger } from "vscode-jsonrpc/node"
import {
  CodeAction, CodeActionKind,
} from "vscode-languageserver-protocol/node"
import { TextDocument } from "vscode-languageserver-textdocument/lib/umd/main"

import { FILE_QUERY_COMMAND_INFO } from "@/commands/executeFileQuery"
import { getQueryParameterInfo } from "@/postgres/parameters"
import { PostgresPool } from "@/postgres/pool"
import { Settings } from "@/settings"

import { isCorrectFileValidation } from "./validation"


export async function getCodeActions(
  pgPool: PostgresPool,
  document: TextDocument,
  settings: Settings,
  logger: Logger,
): Promise<CodeAction[]> {
  const actions: CodeAction[] = []
  if (
    settings.enableExecuteFileQueryCommand
    && getQueryParameterInfo(document, settings, logger) === null
    && await isCorrectFileValidation(pgPool, document, logger)
  ) {
    actions.push(makeExecuteFileQueryCommandCodeAction(document))
  }

  return actions
}

export function makeExecuteFileQueryCommandCodeAction(
  document: TextDocument,
): CodeAction {
  return CodeAction.create(
    FILE_QUERY_COMMAND_INFO.title,
    {
      title: FILE_QUERY_COMMAND_INFO.title,
      command: FILE_QUERY_COMMAND_INFO.command,
      arguments: [document.uri],
    },
    CodeActionKind.Source,
  )
}
