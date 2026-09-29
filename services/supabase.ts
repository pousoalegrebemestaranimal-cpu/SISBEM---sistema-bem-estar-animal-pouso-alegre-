export {
  supabase,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  testSupabaseConnection,
  authenticateWithSupabase,
  registerWithSupabase,
  resendSupabaseConfirmation,
  resetSupabasePassword,
  mapSupabaseUserToAppUser,
  resolveSupabaseProfile,
  resolveEmailFromIdentifier,
  formatSupabaseAuthError,
} from '../src/lib/supabase';

