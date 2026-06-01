"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Database, Loader2, Eye, EyeOff, Shield, Clock, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { connectionSchema, type ConnectionInput } from "@/lib/validation";
import { useConnection } from "@/hooks/use-connection";

export function ConnectionForm() {
  const { connect, isConnecting } = useConnection();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<ConnectionInput>({
    resolver: zodResolver(connectionSchema),
    defaultValues: {
      uri: "",
      readOnly: false,
      queryTimeoutMs: 30000,
      resultLimit: 1000,
    },
  });

  const readOnly = watch("readOnly");

  const onSubmit = async (data: ConnectionInput) => {
    await connect(data);
  };

  return (
    <Card className="relative w-full max-w-lg shadow-xl shadow-black/10 dark:shadow-black/30">
      <CardHeader className="space-y-1 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-muted">
            <Database className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Connect to PostgreSQL</CardTitle>
            <CardDescription>
              Session only. Nothing stored on disk.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="uri">Connection URI</Label>
            <div className="relative">
              <Input
                id="uri"
                type={showPassword ? "text" : "password"}
                placeholder="postgresql://user:password@localhost:5432/mydb"
                className="pr-10 font-mono text-sm"
                {...register("uri")}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide URI" : "Show URI"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.uri && (
              <p className="text-sm text-destructive">{errors.uri.message}</p>
            )}
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-surface px-3 py-3 transition-colors hover:border-muted">
            <Checkbox
              checked={readOnly}
              onChange={(e) => setValue("readOnly", e.target.checked)}
            />
            <div className="flex-1">
              <span className="flex items-center gap-2 text-sm font-medium">
                <Shield className="h-4 w-4 text-amber-500" />
                Read-only mode
              </span>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Safe for production. Blocks writes.
              </p>
            </div>
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="timeout" className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                Query timeout (ms)
              </Label>
              <Input
                id="timeout"
                type="number"
                {...register("queryTimeoutMs", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="limit" className="flex items-center gap-1.5">
                <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                Result limit
              </Label>
              <Input
                id="limit"
                type="number"
                {...register("resultLimit", { valueAsNumber: true })}
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isConnecting}>
            {isConnecting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Testing connection
              </>
            ) : (
              <>
                <Database className="h-4 w-4" />
                Connect
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
