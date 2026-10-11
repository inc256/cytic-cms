import { useState, type FormEvent, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { canAccessPath, defaultPathForRole } from "@/lib/cms-access";
import { useAuth } from "./auth-context";

function AuthMessage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <section className="w-full max-w-md rounded-xl border bg-card p-8 shadow-soft">
        <div className="mb-5 grid size-10 place-items-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
          C
        </div>
        <h1 className="font-display text-xl font-semibold">{title}</h1>
        <div className="mt-2 text-sm leading-6 text-muted-foreground">{children}</div>
      </section>
    </main>
  );
}

function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const message = await signIn(email.trim(), password);
    setError(message);
    setSubmitting(false);
  };

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <section className="w-full max-w-md rounded-xl border bg-card p-8 shadow-soft">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-lg bg-primary font-display text-sm font-semibold text-primary-foreground">
            C
          </div>
          <div>
            <p className="font-display text-sm font-semibold">CYTIC Creatives</p>
            <p className="text-xs text-muted-foreground">Private workspace</p>
          </div>
        </div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Use the email and password provided by your workspace owner.
        </p>
        <form className="mt-7 space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button className="w-full" type="submit" disabled={submitting}>
            {submitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>
        <p className="mt-5 text-center text-xs text-muted-foreground">
          Accounts are created by an owner. Public sign-up is disabled.
        </p>
      </section>
    </main>
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { state, signOut } = useAuth();
  const path = useRouterState({ select: (router) => router.location.pathname });
  const [signOutError, setSignOutError] = useState<string | null>(null);

  if (state.status === "loading") {
    return (
      <main className="grid min-h-screen place-items-center bg-background">
        <div
          className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent"
          aria-label="Loading account"
        />
      </main>
    );
  }

  if (state.status === "configuration-error") {
    return (
      <AuthMessage title="Supabase is not configured">
        Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> to the
        environment, then restart the development server.
      </AuthMessage>
    );
  }

  if (state.status === "session-error") {
    return <AuthMessage title="Unable to check your session">{state.message}</AuthMessage>;
  }

  if (state.status === "signed-out") return <LoginScreen />;

  if (state.status === "role-error") {
    return (
      <AuthMessage title="CMS access is not set up">
        <p>{state.message}</p>
        <p className="mt-2">Signed in as {state.user.email ?? "unknown account"}.</p>
        <Button
          className="mt-4"
          variant="outline"
          onClick={async () => setSignOutError(await signOut())}
        >
          Sign out
        </Button>
        {signOutError && (
          <p role="alert" className="mt-2 text-destructive">
            Could not sign out: {signOutError}
          </p>
        )}
      </AuthMessage>
    );
  }

  if (!canAccessPath(state.role, path)) {
    const defaultPath = defaultPathForRole(state.role);
    return (
      <AuthMessage title="You don't have access to this page">
        <p>Your {state.role} role does not include this area of the CMS.</p>
        <a className="mt-4 inline-block font-medium text-primary underline" href={defaultPath}>
          Go to your workspace
        </a>
      </AuthMessage>
    );
  }

  return children;
}
