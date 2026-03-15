import { useEffect, useState, createContext, useContext, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type UserRole = "admin" | "manager" | "operator" | "viewer" | "tenant";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
  tenant_id: string | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  mustChangePassword: boolean;
  signOut: () => Promise<void>;
  hasPermission: (requiredRole: UserRole) => boolean;
  refreshProfile: () => Promise<void>;
}

const roleHierarchy: Record<UserRole, number> = {
  admin: 5,
  manager: 4,
  operator: 3,
  viewer: 2,
  tenant: 1,
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  mustChangePassword: false,
  signOut: async () => {},
  hasPermission: () => false,
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();
    if (data) {
      const p = data as unknown as Profile;
      // Always call getUser() to get fresh data from the server (not cached JWT)
      // Needed for: tenant_id fallback + must_change_password flag
      let freshUser: User | null = null;
      try {
        const { data: { user: u } } = await supabase.auth.getUser();
        freshUser = u;
        // Fallback: if tenant_id is not in profiles table, get from user_metadata
        if (!p.tenant_id && freshUser?.user_metadata?.tenant_id) {
          p.tenant_id = freshUser.user_metadata.tenant_id;
        }
      } catch (e) {
        console.warn("Could not fetch fresh user data:", e);
      }
      // Check if user must change password on first login
      setMustChangePassword(!!freshUser?.user_metadata?.must_change_password);
      setProfile(p);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  }, [user, fetchProfile]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchProfile(session.user.id), 0);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const hasPermission = (requiredRole: UserRole): boolean => {
    if (!profile) return false;
    return roleHierarchy[profile.role] >= roleHierarchy[requiredRole];
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signOut, hasPermission, refreshProfile, mustChangePassword }}>
      {children}
    </AuthContext.Provider>
  );
};
