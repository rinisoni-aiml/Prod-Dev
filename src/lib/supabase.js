import { createClient } from '@supabase/supabase-js';

// Supabase client configuration
// This is optional - only needed if you want to use Supabase directly
// Otherwise, all data operations will go through your FastAPI backend

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase = null;

// Only initialize if credentials are provided
if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

export { supabase };

// Helper function to check if Supabase is configured
export const isSupabaseConfigured = () => {
  return supabase !== null;
};
