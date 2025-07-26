import MajorPage from "./pages/SelectMajorPage";
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  "https://nvpoyzntpigsyqteqdql.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52cG95em50cGlnc3lxdGVxZHFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1ODE4MjQsImV4cCI6MjA2ODE1NzgyNH0.nbcChGfs74mI-gLHg9O1-5AnoNI-3uHvWGOnZT59QTg"
)

export default function App() {

  return <MajorPage />
}