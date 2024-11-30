import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase credentials. Please check your environment variables.');
}

// Create Supabase client with service role key for admin operations
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Type for auth response
export interface AuthResponse {
  user: User | null;
  error: Error | null;
}

// Helper functions for auth operations
export const supabaseAuth = {
  async signUp(email: string, password: string): Promise<AuthResponse> {
    const { data: { user }, error } = await supabase.auth.signUp({
      email,
      password,
    });
    return { user, error };
  },

  async signIn(email: string, password: string): Promise<AuthResponse> {
    const { data: { user }, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { user, error };
  },

  async signOut(userId: string): Promise<{ error: Error | null }> {
    const { error } = await supabase.auth.admin.signOut(userId);
    return { error };
  },

  async getUser(token: string): Promise<AuthResponse> {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    return { user, error };
  }
};

export default supabase;
