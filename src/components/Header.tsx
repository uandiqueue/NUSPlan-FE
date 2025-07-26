import React from "react";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import { useUIStore } from "../store/useUIStore";
import logo from "../assets/nusplan-logo.png";
import LoginPage from "../pages/LoginPage";
import { supabase } from "../config/supabase";

export default function Header() {
    const { userLoggedIn } = useUIStore();

    const handleSignIn = () => {
        return <LoginPage />;
    };

    const handleSignOut = async () => {
        async function signOut() {
            const { error } = await supabase.auth.signOut()
        }
    };

    return (
        <AppBar
            position="static"
            color="default"
            elevation={0}
            sx={{ background: "#fff", borderBottom: "1px solid #e0e0e0" }}
        >
            <Toolbar
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    minHeight: 72,
                    px: 3,
                }}
            >
                <Box sx={{ display: "flex", alignItems: "center" }}>
                    <img
                        src={logo}
                        alt="NUSPlan Logo"
                        style={{ height: 72 }}
                    />
                </Box>
                <Box>
                    {userLoggedIn ? (
                        <Button
                            variant="text"
                            color="primary"
                            size="medium"
                            onClick={handleSignOut}
                            sx={{
                                fontWeight: 600,
                                fontSize: "1.1rem",
                                px: 4,
                                py: 1.5,
                            }}
                        >
                            Sign Out
                        </Button>
                    ) : (
                        <Button
                            variant="text"
                            color="primary"
                            size="medium"
                            onClick={handleSignIn}
                            sx={{
                                fontWeight: 600,
                                fontSize: "1.1rem",
                                px: 4,
                                py: 1.5,
                            }}
                        >
                            Sign In
                        </Button>
                    )}
                </Box>
            </Toolbar>
        </AppBar>
    );
}