import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";

import { isCmsRole } from "@/lib/cms-access";
import { getSupabaseClient } from "@/lib/supabase";
import { AuthContext, type AuthContextValue, type AuthState } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const supabase = getSupabaseClient();

  useEffect(() => {
    if (!supabase) {
      setState({ status: "configuration-error" });
      return;
    }

    let active = true;
    let requestId = 0;

    const updateSession = async (user: User | null) => {
      const currentRequest = ++requestId;
      if (!user) {
        setState({ status: "signed-out" });
        return;
      }

      setState({ status: "loading" });
      const { data, error } = await supabase
        .from("cms_user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!active || currentRequest !== requestId) return;
      if (error) {
        setState({ status: "role-error", user, message: error.message });
      } else if (!isCmsRole(data?.role)) {
        setState({
          status: "role-error",
          user,
          message: "This account has no valid CMS role. Ask an owner to assign one.",
        });
      } else {
        setState({ status: "signed-in", user, role: data.role });
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      queueMicrotask(() => {
        void updateSession(session?.user ?? null);
      });
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setState({ status: "session-error", message: error.message });
      } else {
        void updateSession(data.session?.user ?? null);
      }
    });

    return () => {
      active = false;
      requestId += 1;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      signIn: async (email, password) => {
        if (!supabase) return "Supabase is not configured.";
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return error?.message ?? null;
      },
      signOut: async () => {
        if (!supabase) return "Supabase is not configured.";
        const { error } = await supabase.auth.signOut();
        return error?.message ?? null;
      },
    }),
    [state, supabase],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
