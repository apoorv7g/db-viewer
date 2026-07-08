"use client";

import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { JsonEditor } from "./json-editor";
import type { ColumnInfo } from "@/types/database";

function isJsonColumn(col: ColumnInfo) {
  return ["json", "jsonb"].includes(col.udtName.toLowerCase());
}

interface RowFormProps {
  columns: ColumnInfo[];
  initialValues?: Record<string, unknown>;
  onSubmit: (values: Record<string, unknown>) => void;
  readOnly?: boolean;
  primaryKeys?: string[];
}

function getFormDefaults(
  columns: ColumnInfo[],
  initialValues: Record<string, unknown>
): Record<string, unknown> {
  const defaults: Record<string, unknown> = { ...initialValues };

  for (const col of columns) {
    if (!col.isNullable) continue;
    defaults[`${col.name}__null`] = initialValues[col.name] === null;
  }

  return defaults;
}

export function RowForm({
  columns,
  initialValues = {},
  onSubmit,
  readOnly,
  primaryKeys = [],
}: RowFormProps) {
  const defaultValues = useMemo(
    () => getFormDefaults(columns, initialValues),
    [columns, initialValues]
  );
  const { register, handleSubmit, setValue, watch, reset } = useForm({
    defaultValues: defaultValues as Record<string, string>,
  });

  useEffect(() => {
    reset(defaultValues as Record<string, string>);
  }, [defaultValues, reset]);

  const nullFields = watch();

  const handleFormSubmit = (data: Record<string, string>) => {
    const result: Record<string, unknown> = {};
    for (const col of columns) {
      const key = col.name;
      if (nullFields[`${key}__null`]) {
        result[key] = null;
        continue;
      }
      const raw = data[key];
      if (raw === undefined || raw === "") {
        if (col.isNullable) result[key] = null;
        continue;
      }
      if (isJsonColumn(col)) {
        try {
          result[key] = JSON.parse(raw);
        } catch {
          result[key] = raw;
        }
      } else if (
        ["int2", "int4", "int8", "float4", "float8", "numeric"].includes(
          col.udtName
        )
      ) {
        result[key] = Number(raw);
      } else if (col.udtName === "bool") {
        result[key] = raw === "true";
      } else {
        result[key] = raw;
      }
    }
    onSubmit(result);
  };

  return (
    <form
      id="row-form"
      onSubmit={handleSubmit(handleFormSubmit)}
      className="grid max-h-[68vh] grid-cols-1 gap-4 overflow-y-auto pr-2 sm:grid-cols-2"
    >
      {columns.map((col) => {
        const isPk = primaryKeys.includes(col.name);
        const disabled = readOnly || (isPk && Object.keys(initialValues).length > 0);
        const isNull = Boolean(nullFields[`${col.name}__null`]);
        const inputDisabled = disabled || isNull;
        const isWideField =
          isJsonColumn(col) ||
          (["text", "varchar"].includes(col.dataType) &&
            (col.characterMaximumLength ?? 0) > 200);

        return (
          <div
            key={col.name}
            className={`space-y-3 rounded-xl border border-border bg-surface/40 p-4 ${
              isWideField ? "sm:col-span-2" : ""
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <Label className="text-sm font-medium">{col.name}</Label>
                <p className="text-xs text-muted-foreground">
                  {col.udtName}
                  {col.isNullable ? "" : " · required"}
                  {isPk ? " · primary key" : ""}
                </p>
              </div>
              {col.isNullable && (
                <label className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground">
                  <Checkbox
                    {...register(`${col.name}__null`, {
                      onChange: (event) => {
                        if (event.target.checked) {
                          setValue(col.name, "");
                        }
                      },
                    })}
                    disabled={disabled}
                  />
                  NULL
                </label>
              )}
            </div>
            {isJsonColumn(col) ? (
              <JsonEditor
                value={
                  typeof initialValues[col.name] === "object"
                    ? JSON.stringify(initialValues[col.name], null, 2)
                    : (initialValues[col.name] as string) ?? "{}"
                }
                onChange={(v) => setValue(col.name, v)}
                disabled={inputDisabled}
              />
            ) : col.udtName === "bool" ? (
              <Select
                {...register(col.name)}
                disabled={inputDisabled}
                className="h-11 rounded-lg text-sm"
              >
                <option value="true">true</option>
                <option value="false">false</option>
              </Select>
            ) : ["text", "varchar"].includes(col.dataType) &&
              (col.characterMaximumLength ?? 0) > 200 ? (
              <Textarea
                {...register(col.name)}
                disabled={inputDisabled}
                className="min-h-32 rounded-lg px-3 py-2.5 text-sm leading-6"
              />
            ) : (
              <Input
                {...register(col.name)}
                disabled={inputDisabled}
                className="h-11 rounded-lg px-3 py-2 text-sm"
              />
            )}
          </div>
        );
      })}
    </form>
  );
}
