"use client";

import { useEffect } from "react";
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

export function RowForm({
  columns,
  initialValues = {},
  onSubmit,
  readOnly,
  primaryKeys = [],
}: RowFormProps) {
  const { register, handleSubmit, setValue, watch, reset } = useForm({
    defaultValues: initialValues as Record<string, string>,
  });

  useEffect(() => {
    reset(initialValues as Record<string, string>);
  }, [initialValues, reset]);

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
      className="space-y-4 max-h-[60vh] overflow-y-auto pr-2"
    >
      {columns.map((col) => {
        const isPk = primaryKeys.includes(col.name);
        const disabled = readOnly || (isPk && Object.keys(initialValues).length > 0);

        return (
          <div key={col.name} className="space-y-1">
            <div className="flex items-center justify-between">
              <Label>
                {col.name}
                <span className="ml-2 text-xs text-muted-foreground font-normal">
                  {col.udtName}
                  {col.isNullable ? "" : " · required"}
                </span>
              </Label>
              {col.isNullable && (
                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Checkbox {...register(`${col.name}__null`)} disabled={disabled} />
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
                disabled={disabled}
              />
            ) : col.udtName === "bool" ? (
              <Select {...register(col.name)} disabled={disabled}>
                <option value="true">true</option>
                <option value="false">false</option>
              </Select>
            ) : ["text", "varchar"].includes(col.dataType) &&
              (col.characterMaximumLength ?? 0) > 200 ? (
              <Textarea {...register(col.name)} disabled={disabled} />
            ) : (
              <Input {...register(col.name)} disabled={disabled} />
            )}
          </div>
        );
      })}
    </form>
  );
}
