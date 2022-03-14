import { Connection } from "vscode-languageserver"

export class ConsoleLogger {
  constructor(private readonly connection: Connection) { }

  log(message: string): void {
    this.connection.console.log(message)
  }

  info(message: string): void {
    this.connection.console.info(message)
  }

  warn(message: string): void {
    this.connection.console.warn(message)
  }

  error(message: string): void {
    this.connection.console.error(message)
  }
}
