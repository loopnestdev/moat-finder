export function useAuth() {
  return {
    user: null as null,
    role: null as string | null,
    session: null as null,
    loading: false,
  };
}
