import { supabase } from "../config/supabase";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from '@supabase/auth-ui-shared'
import logo from "../assets/nusplan-logo.png";

function LoginPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100vw",
        position: "relative",
        background: "#fff"
      }}
    >
      <img
        src={logo}
        alt="NUSPlan Logo"
        style={{
          position: "absolute",
          top: 24,
          left: 24,
          height: 96
        }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
          height: "100vh",
          width: "100vw"
        }}
      >
        <div style={{ marginTop: 120, transform: "scale(1.3)", transformOrigin: "top center" }}>
          <Auth
            supabaseClient={supabase}
            appearance={{ theme: ThemeSupa }}
            providers={[]}
          />
        </div>
      </div>
    </div>
  );
}

export default LoginPage;