import { FILE_QUERY_COMMAND } from "./executeFileQuery"
import { WORKSPACE_VALIDATION_COMMAND } from "./validateWorkspace"

export const COMMANDS = [FILE_QUERY_COMMAND, WORKSPACE_VALIDATION_COMMAND] as const

export const COMMAND_NAMES = COMMANDS.map(command => command.name)

export const COMMAND_TITLE_MAP = Object.fromEntries(
  COMMANDS.map(command => [command.name, command.title]),
)

export type CommandName = (typeof COMMAND_NAMES)[number]
