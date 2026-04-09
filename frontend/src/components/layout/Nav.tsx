import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { tickerSchema } from '../../lib/validation';
import { apiFetch } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import Badge from '../ui/Badge';
import type { User } from '../../types/report.types';

export default function Nav() {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [searchError, setSearchError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const { data: pendingCount } = useQuery({
    queryKey: ['admin', 'pending-count'],
    queryFn: async () => {
      const res = await apiFetch('/api/v1/admin/users?role=pending');
      const body = (await res.json()) as { data: User[] };
      return body.data.length;
    },
    enabled: isAdmin,
    staleTime: 60_000,
  });

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    const result = tickerSchema.safeParse(search);
    if (!result.success) {
      setSearchError(result.error.issues[0]?.message ?? 'Invalid ticker');
      return;
    }
    setSearchError('');
    setSearch('');
    setMenuOpen(false);
    void navigate(`/research/${result.data}`);
  };

  const handleSignIn = () => {
    void supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    });
  };

  return (
    <nav className="bg-navy-950 border-b border-navy-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-16 gap-4">
          {/* Logo */}
          <Link
            to="/"
            className="flex-shrink-0 text-xl font-bold text-gold font-mono tracking-tight"
          >
            moat-finder
          </Link>

          {/* Desktop search — centred */}
          <div className="hidden sm:flex flex-1 justify-center">
            <form onSubmit={handleSearch} className="w-full max-w-sm">
              <div className="relative">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value.toUpperCase());
                    setSearchError('');
                  }}
                  placeholder="Search ticker (e.g. SKYT)"
                  maxLength={10}
                  aria-label="Search ticker"
                  className={[
                    'w-full rounded-md border px-3 py-2 text-sm font-mono',
                    'bg-navy-800 text-cream placeholder:text-cream-subtle',
                    'focus:outline-none focus:ring-1 focus:ring-gold focus:border-gold',
                    searchError ? 'border-red-500' : 'border-navy-600',
                  ].join(' ')}
                />
                {searchError && (
                  <p className="absolute top-full mt-1 text-xs text-red-400">
                    {searchError}
                  </p>
                )}
              </div>
            </form>
          </div>

          {/* Desktop auth */}
          <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
            {isAdmin && pendingCount != null && pendingCount > 0 && (
              <Link to="/admin">
                <Badge variant="red">{pendingCount} pending</Badge>
              </Link>
            )}
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen((o) => !o)}
                  className="flex items-center gap-2 text-sm text-cream-muted hover:text-cream transition-colors"
                  aria-expanded={userMenuOpen}
                  aria-haspopup="true"
                >
                  <span className="h-8 w-8 rounded-full bg-navy-700 border border-gold/40 flex items-center justify-center text-gold font-medium text-xs font-mono">
                    {user.email[0]?.toUpperCase() ?? '?'}
                  </span>
                  <span className="hidden md:block max-w-32 truncate font-body text-cream">
                    {user.displayName ?? user.email}
                  </span>
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-md bg-navy-800 shadow-xl border border-navy-600 z-20">
                    {isAdmin && (
                      <Link
                        to="/admin"
                        onClick={() => setUserMenuOpen(false)}
                        className="block px-4 py-2 text-sm text-cream-muted hover:text-cream hover:bg-navy-700 transition-colors"
                      >
                        Admin panel
                      </Link>
                    )}
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        void signOut();
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-cream-muted hover:text-cream hover:bg-navy-700 transition-colors"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={handleSignIn}
                className="rounded-md border border-gold/70 px-4 py-2 text-sm font-medium text-gold hover:bg-gold hover:text-navy-950 transition-colors"
              >
                Log in
              </button>
            )}
          </div>

          {/* Mobile hamburger */}
          <div className="flex sm:hidden ml-auto">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              className="p-2 rounded-md text-cream-muted hover:text-cream hover:bg-navy-800 transition-colors"
            >
              {menuOpen ? (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="sm:hidden border-t border-navy-700 bg-navy-950 px-4 py-4 space-y-4">
          <form onSubmit={handleSearch}>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value.toUpperCase());
                setSearchError('');
              }}
              placeholder="Search ticker (e.g. SKYT)"
              maxLength={10}
              aria-label="Search ticker"
              className={[
                'w-full rounded-md border px-3 py-2 text-sm font-mono',
                'bg-navy-800 text-cream placeholder:text-cream-subtle',
                'focus:outline-none focus:ring-1 focus:ring-gold',
                searchError ? 'border-red-500' : 'border-navy-600',
              ].join(' ')}
            />
            {searchError && (
              <p className="mt-1 text-xs text-red-400">{searchError}</p>
            )}
            <button
              type="submit"
              className="mt-2 w-full rounded-md border border-gold/70 py-2 text-sm text-gold font-medium hover:bg-gold hover:text-navy-950 transition-colors"
            >
              Search
            </button>
          </form>

          {user ? (
            <div className="space-y-1">
              <p className="font-body text-sm text-cream-muted truncate">{user.email}</p>
              {isAdmin && (
                <Link
                  to="/admin"
                  onClick={() => setMenuOpen(false)}
                  className="block py-2 text-sm text-cream-muted hover:text-cream"
                >
                  Admin panel
                  {pendingCount != null && pendingCount > 0 && (
                    <Badge variant="red" className="ml-2">{pendingCount}</Badge>
                  )}
                </Link>
              )}
              <button
                onClick={() => {
                  setMenuOpen(false);
                  void signOut();
                }}
                className="w-full text-left py-2 text-sm text-cream-muted hover:text-cream"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setMenuOpen(false);
                handleSignIn();
              }}
              className="w-full rounded-md border border-gold/70 py-2 text-sm text-gold font-medium hover:bg-gold hover:text-navy-950 transition-colors"
            >
              Log in
            </button>
          )}
        </div>
      )}
    </nav>
  );
}
