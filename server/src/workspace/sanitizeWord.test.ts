import { sanitizeDynamicPartitionTable, sanitizeNumberPartitionTable, sanitizeQuotedTable, sanitizeUuidPartitionTable } from "./sanitizeWord"

test("sanitize queted table", () => {
    expect(sanitizeQuotedTable('public."table_name"')).toBe("public.table_name")
    expect(sanitizeQuotedTable('"table_name"')).toBe("table_name")
})

test("sanitize dynamic partition table", () => {
    expect(sanitizeDynamicPartitionTable('public."table_name_$$')).toBe("public.table_name")
    expect(sanitizeDynamicPartitionTable('"table_name_$$')).toBe("table_name")
})

test("sanitize number partition table", () => {
    expect(sanitizeNumberPartitionTable("public.table_name_1234")).toBe("public.table_name")
    expect(sanitizeNumberPartitionTable("table_name_1234")).toBe("table_name")
    expect(sanitizeNumberPartitionTable("public.\"table_name_1234\"")).toBe("public.table_name")
    expect(sanitizeNumberPartitionTable("\"table_name_1234\"")).toBe("table_name")
})

test("sanitize uuid partition table", () => {
    expect(sanitizeUuidPartitionTable("public.table_name_12345678-1234-1234-1234-123456789012")).toBe("public.table_name")
    expect(sanitizeUuidPartitionTable("table_name_12345678-1234-1234-1234-123456789012")).toBe("table_name")
    expect(sanitizeUuidPartitionTable("public.\"table_name_12345678-1234-1234-1234-123456789012\"")).toBe("public.table_name")
    expect(sanitizeUuidPartitionTable("\"table_name_12345678-1234-1234-1234-123456789012\"")).toBe("table_name")
})
