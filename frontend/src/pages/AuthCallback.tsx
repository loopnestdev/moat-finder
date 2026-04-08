import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Spinner from '../components/ui/Spinner';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // Wait for Supabase to exchange the PKCE code in the URL for a session,
    // then redirect to the home page regardless of outcome.
    void supabase.auth.getSession().then(() => {
      void navigate('/', { replace: true });
    });
  }, [navigate]);

  return (
    <div className="flex justify-center items-center min-h-screen">
      <Spinner size="lg" />
    </div>
  );
}
