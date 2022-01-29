import {
    sanitizeDynamicPartitionTable,
    sanitizeNumberPartitionTable,
    sanitizeQuotedTable,
    sanitizeTableRowType,
    sanitizeUuidPartitionTable,
} from "./sanitizeWord"


test.each(
    [
        ["public.table_name%ROWTYPE", "public.table_name"],
        ['public."table_name"%ROWTYPE', "public.table_name"],
    ],
)(
    "sanitizeTableRowType(%s)", (word, expected) => {
        expect(
            sanitizeTableRowType(word),
        ).toBe(expected)
    },
)

test.each(
    [
        ['public."table_name"', "public.table_name"],
        ['"table_name"', "table_name"],
    ],
)("sanitizeQuotedTable(%s)", (word, expected) => {
    expect(sanitizeQuotedTable(word)).toBe(expected)
})

test.each(
    [
        ['public."table_name_$$', "public.table_name"],
        ['"table_name_$$', "table_name"],
    ],
)("sanitizeDynamicPartitionTable(%s)", (word, expected) => {
    expect(sanitizeDynamicPartitionTable(word))
        .toBe(expected)
})

test.each(
    [
        ["public.table_name_1234", "public.table_name"],
        ["table_name_1234", "table_name"],
        ['public."table_name_1234"', "public.table_name"],
        ['"table_name_1234"', "table_name"],
    ],
)("sanitizeNumberPartitionTable(%s)", (word, expected) => {
    expect(sanitizeNumberPartitionTable(word))
        .toBe(expected)
})

test.each([
    [
        "public.table_name_12345678-1234-1234-1234-123456789012",
        "public.table_name",
    ],
    [
        "table_name_12345678-1234-1234-1234-123456789012",
        "table_name",
    ],
    [
        'public."table_name_12345678-1234-1234-1234-123456789012"',
        "public.table_name",
    ],
    [
        '"table_name_12345678-1234-1234-1234-123456789012"',
        "table_name",
    ],
])("sanitizeUuidPartitionTable(%s)", (word, expected) => {
    expect(sanitizeUuidPartitionTable(
        word,
    )).toBe(expected)
})
