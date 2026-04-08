import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Spinner from '../components/ui/Spinner';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // Check for error params in the URL immediately.
    const params = new URLSearchParams(window.location.search);
    if (params.has('error')) {
      void navigate('/?error=auth_failed', { replace: true });
      return;
    }

    // The Supabase client (detectSessionInUrl: true, flowType: 'pkce') handles
    // the PKCE code exchange automatically on init. Just wait for SIGNED_IN.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === 'SIGNED_IN') {
          void navigate('/', { replace: true });
        }
      },
    );

    // Safety timeout — redirect after 10 s if event never fires.
    const timer = setTimeout(() => {
      void navigate('/?error=auth_failed', { replace: true });
    }, 10_000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [navigate]);

  return (
    <div className="flex flex-col justify-center items-center min-h-screen gap-3">
      <Spinner size="lg" />
      <p className="text-sm text-gray-500">Completing sign in...</p>
    </div>
  );
}
