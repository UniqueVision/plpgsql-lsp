interface Records {
  "log": string[],
  "info": string[],
  "warn": string[],
  "error": string[],
}

export class RecordLogger {

  private records: Records = {
    "log": [],
    "info": [],
    "warn": [],
    "error": [],
  }

  get(level: keyof Records): string[] {
    return this.records[level]
  }

  isEmpty(): boolean {
    return (Object.values(this.records) as string[][]).reduce(
      (total, value) => { return total + value.length },
      0,
    ) === 0
  }

  log(message: string): void {
    this.records["log"].push(message)
  }

  info(message: string): void {
    this.records["info"].push(message)
  }

  warn(message: string): void {
    this.records["warn"].push(message)
  }

  error(message: string): void {
    this.records["error"].push(message)
  }
}
