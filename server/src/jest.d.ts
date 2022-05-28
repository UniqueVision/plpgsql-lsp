import { CompletionItem, URI } from "vscode-languageserver"

declare global {
  namespace jest {
    interface Matchers<R> {
      completionItemContaining(
        expected: CompletionItem,
      ): R

      toHoverCodeEqual(
        expectedCode: string,
      ): R

      toDefinitionUriEqual(
        expectedUir: URI,
      ): R
    }
  }
}
