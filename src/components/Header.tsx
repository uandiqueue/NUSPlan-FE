import React from "react";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import { useNavigate } from "react-router-dom";
import { useUIStore } from "../store/useUIStore";
import logo from "../assets/nusplan-logo.png";
import { supabase } from "../config/supabase";

export default function Header() {
    const { userLoggedIn, setUserLoggedIn } = useUIStore();
    const navigate = useNavigate();

    const handleSignIn = () => {
        navigate("/login");
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        setUserLoggedIn(false);
        navigate("/login");
    };

    const handleGoPlanner = () => {
        navigate("/planner");
    };

    const handleGoSelect = () => {
        navigate("/select");
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
                <Box
                    sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
                    onClick={handleGoSelect}
                >
                    <img
                        src={logo}
                        alt="NUSPlan Logo"
                        style={{ height: 72 }}
                    />
                </Box>
                <Box sx={{ display: "flex", gap: 2 }}>
                    <Button
                        variant="text"
                        color="primary"
                        size="medium"
                        onClick={handleGoSelect}
                        sx={{
                            fontWeight: 600,
                            fontSize: "1.1rem",
                            px: 4,
                            py: 1.5,
                        }}
                    >
                        Select Programme
                    </Button>
                    <Button
                        variant="text"
                        color="primary"
                        size="medium"
                        onClick={handleGoPlanner}
                        sx={{
                            fontWeight: 600,
                            fontSize: "1.1rem",
                            px: 4,
                            py: 1.5,
                        }}
                    >
                        Planner
                    </Button>
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
