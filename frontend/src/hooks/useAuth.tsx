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

const signOutFn = async (): Promise<void> => {
  await supabase.auth.signOut();
};

const initialState: AuthContextValue = {
  user: null,
  role: null,
  isLoading: true,
  isApproved: false,
  isAdmin: false,
  signOut: signOutFn,
};

const AuthContext = createContext<AuthContextValue | null>(null);

function buildSignedOutState(): AuthContextValue {
  return {
    user: null,
    role: null,
    isLoading: false,
    isApproved: false,
    isAdmin: false,
    signOut: signOutFn,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthContextValue>(initialState);

  useEffect(() => {
    // Shared logic: fetch role from DB and update state for a given auth user.
    // setTimeout(0) avoids Supabase deadlock when called inside onAuthStateChange.
    const loadUser = (authUser: { id: string; email?: string }, defer: boolean) => {
      const run = () => {
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
              signOut: signOutFn,
            });
          });
      };
      if (defer) {
        setTimeout(run, 0);
      } else {
        run();
      }
    };

    // Explicitly load the current session on mount so that a session already
    // established (e.g. after an OAuth PKCE redirect to '/') is detected even
    // if onAuthStateChange fires before this effect runs.
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadUser(session.user, false);
      } else {
        setState(buildSignedOutState());
      }
    });

    // Subscribe for subsequent auth events (sign-in, sign-out, token refresh).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setState(buildSignedOutState());
        return;
      }
      // defer=true inside onAuthStateChange to avoid Supabase re-entrancy deadlock
      loadUser(session.user, true);
    });

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
