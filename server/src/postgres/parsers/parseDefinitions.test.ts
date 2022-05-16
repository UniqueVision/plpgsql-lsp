import { Range, uinteger } from "vscode-languageserver"

import { loadSampleFile } from "@/__tests__/helpers/file"

import {
  parseFunctionDefinitions,
  parseTableDefinitions,
  parseTypeDefinitions,
  parseViewDefinitions,
} from "./parseDefinitions"
import { parseStmtements, Statement } from "./statement"

test.each([
  [
    "definitions/table/companies.pgsql",
    Array(2).fill(Range.create(2, 13, 2, 22)),
  ],
  [
    "definitions/table/public_users.pgsql",
    Array(2).fill(Range.create(2, 13, 2, 25)),
  ],
  [
    "definitions/table/campaign_participants.pgsql",
    [Range.create(2, 13, 2, 34)],
  ],
])(
  'parseTableDefinitions <- "%s"',
  async (file, expected) => {
    const fileText = loadSampleFile(file)
    const statements = parseTableDefinitions(
      fileText, await parseStmtement(fileText, 1), `file://${file}`, "public",
    )

    expect(
      statements.map(
        (statement) => statement.definitionLink.targetSelectionRange,
      ),
    ).toStrictEqual(expected)
  },
)

test.each([
  [
    "definitions/view/deleted_users.pgsql",
    Array(2).fill(Range.create(2, 12, 2, 25)),
  ],
  [
    "definitions/view/public_deleted_users.pgsql",
    Array(2).fill(Range.create(2, 12, 2, 32)),
  ],
  [
    "definitions/view/campaign_deleted_participants.pgsql",
    [Range.create(2, 12, 2, 41)],
  ],
])(
  'parseViewDefinitions <- "%s"', async (file, expected) => {
    const fileText = loadSampleFile(file)
    const statements = parseViewDefinitions(
      fileText, await parseStmtement(fileText, 1), `file://${file}`, "public",
    )

    expect(
      statements.map(
        (statement) => statement.definitionLink.targetSelectionRange,
      ),
    ).toStrictEqual(expected)
  },
)

test.each([
  [
    "definitions/type/type_user.pgsql",
    Array(2).fill(Range.create(2, 12, 2, 21)),
  ],
])(
  'parseTypeDefinitions <- "%s"', async (file, expected) => {
    const fileText = loadSampleFile(file)
    const statements = parseTypeDefinitions(
      fileText, await parseStmtement(fileText, 1), `file://${file}`, "public",
    )

    expect(
      statements.map(
        (statement) => statement.definitionLink.targetSelectionRange,
      ),
    ).toStrictEqual(expected)
  },
)

test.each([
  [
    "definitions/function/correct_function.pgsql",
    Array(2).fill(Range.create(2, 16, 2, 32)),
  ],
])(
  'parseFunctionDefinitions <- "%s"',
  async (file, expected) => {
    const fileText = loadSampleFile(file)
    const statements = parseFunctionDefinitions(
      fileText, await parseStmtement(fileText, 1), `file://${file}`, "public",
    )

    expect(
      statements.map(
        (statement) => statement.definitionLink.targetSelectionRange,
      ),
    ).toStrictEqual(expected)
  },
)


async function parseStmtement(fileText: string, index: uinteger): Promise<Statement> {
  return ((await parseStmtements(fileText)) || [])[index]
}
