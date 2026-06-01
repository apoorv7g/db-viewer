import { z } from "zod";

const postgresUriRegex =
  /^postgres(ql)?:\/\/([^:@\s]+)(:([^@\s]*))?@([^:\/\s]+)(:(\d+))?\/([^?\s]+)/i;

export const connectionSchema = z.object({
  uri: z
    .string()
    .min(1, "Connection URI is required")
    .refine((val) => postgresUriRegex.test(val), {
      message:
        "Invalid PostgreSQL URI. Expected: postgresql://user:pass@host:port/database",
    }),
  readOnly: z.boolean(),
  queryTimeoutMs: z.number().min(1000).max(120000),
  resultLimit: z.number().min(1).max(10000),
});

export const querySchema = z.object({
  sql: z.string().min(1, "SQL query is required"),
  limit: z.number().min(1).max(10000).optional(),
  confirmed: z.boolean().optional().default(false),
});

const PAGE_SIZES = [10, 50, 100, 500] as const;

export const tableDataQuerySchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  pageSize: z.coerce
    .number()
    .transform((n) =>
      PAGE_SIZES.includes(n as (typeof PAGE_SIZES)[number]) ? n : 50
    )
    .optional()
    .default(50),
  sortColumn: z.string().optional(),
  sortDirection: z.enum(["asc", "desc"]).optional().default("asc"),
  filterColumn: z.string().optional(),
  filterValue: z.string().optional(),
  schema: z.string().optional().default("public"),
});

export const insertDataSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())).min(1),
  confirmed: z.boolean().optional().default(false),
  schema: z.string().optional().default("public"),
});

export const updateDataSchema = z.object({
  data: z.record(z.string(), z.unknown()),
  where: z.record(z.string(), z.unknown()),
  confirmed: z.boolean().optional().default(false),
  schema: z.string().optional().default("public"),
});

export const deleteDataSchema = z.object({
  where: z.union([
    z.record(z.string(), z.unknown()),
    z.array(z.record(z.string(), z.unknown())),
  ]),
  confirmed: z.boolean().optional().default(false),
  schema: z.string().optional().default("public"),
});

export type ConnectionInput = z.infer<typeof connectionSchema>;
export type QueryInput = z.infer<typeof querySchema>;
