import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Session } from "@supabase/supabase-js";
import { supabase } from "./config/supabase";
import { useUIStore } from "./store/useUIStore";
import Header from "./components/Header";
import PlannerPage from "./pages/PlannerPage";
import LoginPage from "./pages/LoginPage";
import SelectProgrammesPage from "./pages/SelectProgrammesPage";


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

  return (
    <Router>
      <Header />
      <Routes>
        <Route path="/" element={<Navigate to="/select" />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/select" element={<SelectProgrammesPage />} />
        <Route path="/planner" element={<PlannerPage onBack={() => window.history.back()} />} />
      </Routes>
    </Router>
  );
}