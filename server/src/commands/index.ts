import { FILE_QUERY_COMMAND_INFO } from "./executeFileQuery"


export const COMMAND_INFOS = [FILE_QUERY_COMMAND_INFO]

export const COMMANDS = COMMAND_INFOS.map(command => command.command)

export const COMMAND_TITLE_MAP = Object.fromEntries(
  COMMAND_INFOS.map(item => [item.command, item.title]),
)
