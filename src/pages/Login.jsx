import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../api/supabaseClient";

import clothVideo from "../assets/videos/cloth-animation.mp4";
import "../assets/fonts/fonts.css";
import "./login.css";

export default function Login() {
  const navigate = useNavigate();

  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const validateEmail = (email) => /\S+@\S+\.\S+/.test(email);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!validateEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (mode === "register" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      /* =========================
         LOGIN FLOW
      ========================= */
      if (mode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        const userId = data.user.id;

        /* 🔥 FETCH USER ROLE + PERMISSIONS */
        const { data: permissionsData, error: permError } = await supabase
          .from("view_user_permissions")
          .select("*")
          .eq("user_id", userId);

        if (permError) throw permError;

        if (!permissionsData || permissionsData.length === 0) {
          throw new Error("User role not assigned. Contact admin.");
        }

        /* 🔥 EXTRACT ROLE + PERMISSIONS */
        const role = permissionsData[0].role_name;
        const permissions = permissionsData.map((p) => p.permission_key);

        /* 🔥 STORE CLEAN USER OBJECT */
        const userProfile = {
          id: userId,
          email: data.user.email,
          role,
          permissions,
        };

        console.log("User Profile:", userProfile);

        /* SAVE TO LOCAL STORAGE */
        localStorage.setItem("user", JSON.stringify(userProfile));

        navigate("/dashboard");
      }

      /* =========================
         REGISTER FLOW
      ========================= */
      if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;

        setMode("login");
        setError("Account created successfully. Please login.");
      }
    } catch (err) {
      console.error("Auth Error:", err);
      setError(err.message || "Something went wrong.");
    }

    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-container">
        {/* Left Panel with Video */}
        <div className="login-left">
          <video autoPlay muted loop playsInline className="panel-video">
            <source src={clothVideo} type="video/mp4" />
          </video>
          <div className="video-overlay"></div>
          <div className="left-content">
            <h1 className="left-title">Soham Production</h1>
            <p className="left-subtitle">Clothing Management System</p>
          </div>
        </div>

        {/* Right Panel with Form */}
        <div className="login-right">
          <div className="form-card">
            <h2 className="form-title">
              {mode === "login" ? "Welcome Back" : "Create Account"}
            </h2>
            <p className="form-subtitle">
              {mode === "login"
                ? "Sign in to continue"
                : "Register to get started"}
            </p>

            <form onSubmit={handleSubmit} noValidate>
              <div className="input-group">
                <label>Email</label>
                <input
                  type="email"
                  placeholder="admin@soham.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <label>Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {mode === "register" && (
                <div className="input-group">
                  <label>Confirm Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              )}

              {error && <div className="error-message">{error}</div>}

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading
                  ? "Processing..."
                  : mode === "login"
                  ? "Login"
                  : "Register"}
              </button>
            </form>

            <p className="toggle-mode">
              {mode === "login" ? (
                <>
                  Don't have an account?
                  <button
                    type="button"
                    onClick={() => {
                      setMode("register");
                      setError("");
                    }}
                  >
                    Register
                  </button>
                </>
              ) : (
                <>
                  Already have an account?
                  <button
                    type="button"
                    onClick={() => {
                      setMode("login");
                      setError("");
                    }}
                  >
                    Login
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}