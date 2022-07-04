export class PlpgsqlLanguageServerError extends Error {
  get name(): string {
    return this.constructor.name
  }
}

export class NeverReachError extends PlpgsqlLanguageServerError {
}

export class ParsedTypeError extends PlpgsqlLanguageServerError {
}

export class NotCoveredFileError extends PlpgsqlLanguageServerError {
  constructor() {
    super("This file is not covered by Language Server.")
  }
}

export class WorkspaceNotFound extends PlpgsqlLanguageServerError {
  constructor() {
    super("Workspace not found.")
  }
}

export class DisableLanguageServerError extends PlpgsqlLanguageServerError {
  constructor() {
    super("Disable Language Server.")
  }
}

export class PostgresPoolNotFoundError extends PlpgsqlLanguageServerError {
  constructor() {
    super("PostgresPool not found.")
  }
}

export class CommandNotFoundError extends PlpgsqlLanguageServerError {
  constructor(command: string) {
    super(`Command '${command}' not found`)
  }
}

export class WrongCommandArgumentsError extends PlpgsqlLanguageServerError {
  constructor() {
    super("Arguments of the command are wrong.")
  }
}

export class CannotExecuteCommandWithQueryParametersError
  extends PlpgsqlLanguageServerError {
  constructor() {
    super("Cannot execute the command with query parameters.")
  }
}

export class ExecuteFileQueryCommandDisabledError extends PlpgsqlLanguageServerError {
  constructor() {
    super("\"settings.enableExecuteFileQueryCommand\" is false.")
  }
}

export class WorkspaceValidationTargetFilesEmptyError
  extends PlpgsqlLanguageServerError {
  constructor() {
    super("\"settings.workspaceValidationTargetFiles\" is empty.")
  }
}
