import SelectProgrammesPage from "./pages/SelectProgrammesPage";
import { supabase } from "./config/supabase";
import { useState, useEffect } from "react";
import { Session } from "@supabase/supabase-js";
import { useUIStore } from "./store/useUIStore";


export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const { setUserLoggedIn } = useUIStore();

  useEffect(() => {
    // One time thing
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    // Active listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    // clean up function in useEffect
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    setUserLoggedIn(!!session); // true if user is logged in
  }, [session, setUserLoggedIn]);

  return <SelectProgrammesPage />;
}