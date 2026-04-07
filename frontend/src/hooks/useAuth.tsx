/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from '../lib/supabase';

interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  role: string | null;
  isLoading: boolean;
  isApproved: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
}

const initialState: AuthContextValue = {
  user: null,
  role: null,
  isLoading: true,
  isApproved: false,
  isAdmin: false,
  signOut: async () => {},
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthContextValue>(initialState);

  useEffect(() => {
    const handleSignOut = (): void => {
      setState({
        user: null,
        role: null,
        isLoading: false,
        isApproved: false,
        isAdmin: false,
        signOut: async () => {
          await supabase.auth.signOut();
        },
      });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session?.user) {
          handleSignOut();
          return;
        }

        const authUser = session.user;

        // Use setTimeout(0) to avoid Supabase deadlock from calling Supabase
        // inside an onAuthStateChange callback synchronously
        setTimeout(() => {
          void supabase
            .from('users')
            .select('role, display_name')
            .eq('id', authUser.id)
            .single()
            .then(({ data }) => {
              const role = (data as { role?: string } | null)?.role ?? 'pending';
              const displayName =
                (data as { display_name?: string | null } | null)?.display_name ??
                null;
              setState({
                user: {
                  id: authUser.id,
                  email: authUser.email ?? '',
                  displayName,
                },
                role,
                isLoading: false,
                isApproved: role === 'approved' || role === 'admin',
                isAdmin: role === 'admin',
                signOut: async () => {
                  await supabase.auth.signOut();
                },
              });
            });
        }, 0);
      },
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
