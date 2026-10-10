import { createContext, useContext } from "react";
import type { User } from "@supabase/supabase-js";

import type { CmsRole } from "@/lib/cms-access";

export type AuthState =
  | { status: "loading" }
  | { status: "configuration-error" }
  | { status: "signed-out" }
  | { status: "session-error"; message: string }
  | { status: "role-error"; user: User; message: string }
  | { status: "signed-in"; user: User; role: CmsRole };

export type AuthContextValue = {
  state: AuthState;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<string | null>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}
