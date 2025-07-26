import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_PUBLIC_SUPABASE_URL || 'https://nvpoyzntpigsyqteqdql.supabase.co';
const supabaseAnonKey = process.env.REACT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52cG95em50cGlnc3lxdGVxZHFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1ODE4MjQsImV4cCI6MjA2ODE1NzgyNH0.nbcChGfs74mI-gLHg9O1-5AnoNI-3uHvWGOnZT59QTg';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL or Anon Key is not defined in environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);