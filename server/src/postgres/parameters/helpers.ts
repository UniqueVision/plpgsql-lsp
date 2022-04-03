import { uinteger } from "vscode-languageserver"

export function makePositionalParamter(
  index: uinteger,
  keywordParameter: string,
): string {
  let positionalParameter = `$${index + 1}`

  // Add padding to maintain query length
  positionalParameter += " ".repeat(
    Math.max(0, keywordParameter.length - positionalParameter.length),
  )

  return positionalParameter
}
