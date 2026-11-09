import { useEffect } from "react";
import { useAuth } from "../AuthContext";
import "../Login.css";

export default function Login() {
  const { loginWithAuthelia, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      const urlParams = new URLSearchParams(window.location.search);
      const redirectUrl = urlParams.get('redirect');
      window.location.href = redirectUrl || '/';
    }
  }, [isAuthenticated]);

  const handleSignIn = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const redirectUrl = urlParams.get('redirect') || '/';
    loginWithAuthelia(redirectUrl);
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-card">
          <h1>Gian Finance</h1>
          <p className="login-subtitle">
            Sign in to your account
          </p>

          <button
            type="button"
            className="login-button"
            onClick={handleSignIn}
          >
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
}
