import React, { useState } from "react";
import { useAuth } from "../AuthContext";
import BackendStatusIndicator from "./BackendStatusIndicator";
import "../Login.css";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const { login, register } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!username || !password) {
      setLocalError("Please enter both username and password");
      return;
    }

    try {
      if (isRegistering) {
        await register(username, password);
      } else {
        await login(username, password);
      }
    } catch {
      setLocalError(
        isRegistering
          ? "Registration failed. Username might already exist."
          : "Login failed. Check your credentials."
      );
    }
  };

  return (
    <>
      <BackendStatusIndicator />
      <div className="login-page">
        <div className="login-container">
          <div className="login-card">
            <h1>Gian's Apps</h1>
            <p className="login-subtitle">
              {isRegistering ? "Create an account" : "Sign in to your account"}
            </p>

            <form onSubmit={handleSubmit} className="login-form">
              <div className="form-group">
                <label htmlFor="username">Username</label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="login-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="login-input"
                />
              </div>

              {localError && <div className="login-error">{localError}</div>}

              <button type="submit" className="login-button">
                {isRegistering ? "Create Account" : "Sign In"}
              </button>
            </form>

            <p className="login-toggle">
              {isRegistering ? "Already have an account? " : "Don't have an account? "}
              <button
                type="button"
                onClick={() => {
                  setIsRegistering(!isRegistering);
                  setLocalError(null);
                  setUsername("");
                  setPassword("");
                }}
                className="toggle-button"
              >
                {isRegistering ? "Sign In" : "Create Account"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
