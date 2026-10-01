"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Keeps a render error in one part of the app from blanking the whole page. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <h2 className="text-lg font-semibold">Something went wrong</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          {this.state.error.message}
        </p>
        <Button onClick={() => this.setState({ error: null })}>Try again</Button>
      </div>
    );
  }
}
