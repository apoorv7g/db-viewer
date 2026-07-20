"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Database,
  Loader2,
  Eye,
  EyeOff,
  Shield,
  Clock,
  Hash,
  ListTree,
} from "lucide-react";
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
import { useDatabases } from "@/hooks/use-databases";
import { withDatabase } from "@/lib/uri";
import { formatBytes } from "@/lib/utils";

export function ConnectionForm() {
  const { connect, isConnecting } = useConnection();
  const { databases, listDatabases, isListing, reset: resetDatabases } =
    useDatabases();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    getValues,
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
  const uri = watch("uri");

  const onSubmit = async (data: ConnectionInput) => {
    await connect(data);
  };

  const handleBrowseDatabases = async () => {
    const valid = await connectionSchema.shape.uri.safeParseAsync(uri);
    if (!valid.success) return;
    await listDatabases(uri);
  };

  const handleSelectDatabase = async (databaseName: string) => {
    const targetUri = withDatabase(uri, databaseName);
    setValue("uri", targetUri);
    resetDatabases();
    await connect({ ...getValues(), uri: targetUri });
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

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              disabled={!uri || isListing}
              onClick={handleBrowseDatabases}
            >
              {isListing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ListTree className="h-3.5 w-3.5" />
              )}
              Browse databases on this server
            </Button>

            {databases && (
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border bg-surface p-1.5">
                {databases.length === 0 ? (
                  <p className="px-2 py-1.5 text-xs text-muted-foreground">
                    No accessible databases found on this server.
                  </p>
                ) : (
                  databases.map((db) => (
                    <button
                      key={db.name}
                      type="button"
                      disabled={isConnecting}
                      onClick={() => handleSelectDatabase(db.name)}
                      className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-surface-hover disabled:pointer-events-none disabled:opacity-50"
                    >
                      <span className="flex items-center gap-2 truncate">
                        <Database className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate font-mono">{db.name}</span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatBytes(db.sizeBytes)}
                      </span>
                    </button>
                  ))
                )}
              </div>
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
