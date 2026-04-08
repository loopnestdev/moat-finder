import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Spinner from '../components/ui/Spinner';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    void (async () => {
      const { error } = await supabase.auth.exchangeCodeForSession(
        window.location.href,
      );
      if (error) {
        void navigate('/?error=auth_failed', { replace: true });
      } else {
        void navigate('/', { replace: true });
      }
    })();
  }, [navigate]);

  return (
    <div className="flex flex-col justify-center items-center min-h-screen gap-3">
      <Spinner size="lg" />
      <p className="text-sm text-gray-500">Completing sign in...</p>
    </div>
  );
}
