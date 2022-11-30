export function escapeRegex(string: string): string {
  return string.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")
}


export const SQL_COMMENT_RE = /\/\*[\s\S]*?\*\/|([^:]|^)--.*$/gm
export const BEGIN_RE = /^([\s]*begin[\s]*;)/igm
export const COMMIT_RE = /^([\s]*commit[\s]*;)/igm
export const ROLLBACK_RE = /^([\s]*rollback[\s]*;)/igm

// eslint-disable-next-line max-len
export const DISABLE_STATEMENT_VALIDATION_RE = /^ *-- +plpgsql-language-server:disable *$/m
