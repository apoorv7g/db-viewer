"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Database, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card className="w-full max-w-xl mx-auto">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Database className="h-6 w-6" />
          <CardTitle>Connect to PostgreSQL</CardTitle>
        </div>
        <CardDescription>
          Enter a standard PostgreSQL URI. Credentials are kept in memory only for
          this session  nothing is stored on disk.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="uri">Connection URI</Label>
            <Input
              id="uri"
              type={showPassword ? "text" : "password"}
              placeholder="postgresql://user:password@localhost:5432/mydb"
              {...register("uri")}
            />
            {errors.uri && (
              <p className="text-sm text-red-600">{errors.uri.message}</p>
            )}
            <label className="flex items-center gap-2 text-sm text-zinc-500">
              <Checkbox
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
              />
              Show connection string
            </label>
          </div>

          <label className="flex items-center gap-2">
            <Checkbox
              checked={readOnly}
              onChange={(e) => setValue("readOnly", e.target.checked)}
            />
            <span className="text-sm">Read-only mode (production safe)</span>
          </label>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="timeout">Query timeout (ms)</Label>
              <Input
                id="timeout"
                type="number"
                {...register("queryTimeoutMs", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="limit">Result limit</Label>
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
                Testing connection…
              </>
            ) : (
              "Connect"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
