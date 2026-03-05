import React, { createContext, useState, useContext, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { setRefreshTokenFunction } from "./utils/fetchWithTokenRefresh";
import { setCookie, getCookie, deleteCookie } from "./utils/cookies";

interface AuthContextType {
  token: string | null;
  username: string | null;
  isAdmin: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
  error: string | null;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const refreshingRef = useRef(false);
  const refreshPromiseRef = useRef<Promise<void> | null>(null);

  // Load token and username from cookies on mount
  useEffect(() => {
    const savedToken = getCookie("authToken");
    const savedUsername = getCookie("username");
    const savedRefreshToken = getCookie("refreshToken");
    
    console.log("Finance App - Loading auth from cookies:", {
      hasToken: !!savedToken,
      hasRefreshToken: !!savedRefreshToken,
      username: savedUsername,
      allCookies: document.cookie
    });
    
    if (savedToken && savedRefreshToken && savedUsername) {
      // CRITICAL FIX: Set token and username IMMEDIATELY in state
      // This must happen synchronously BEFORE any async operations
      setToken(savedToken);
      setUsername(savedUsername);
      console.log("✅ Set auth state from cookies - user is authenticated");
      
      // THEN fetch admin status from server asynchronously
      // Even if this fails, user remains authenticated
      fetch("/user/info", {
        headers: {
          Authorization: `Bearer ${savedToken}`,
        },
      })
        .then(res => {
          if (res.ok) {
            return res.json();
          } else {
            console.warn("⚠️ Failed to get user info, status:", res.status);
            return null;
          }
        })
        .then(userInfo => {
          if (userInfo) {
            const adminStatus = userInfo.is_admin || false;
            setIsAdmin(adminStatus);
            console.log("✅ Admin status from server:", adminStatus);
          } else {
            setIsAdmin(false);
            console.warn("⚠️ Failed to get admin status - defaulting to false");
          }
          setIsLoading(false);
        })
        .catch(err => {
          console.warn("❌ Failed to verify admin status:", err);
          setIsAdmin(false);
          setIsLoading(false);
        });
    } else {
      console.log("❌ Missing auth cookies - user not authenticated");
      setIsLoading(false);
    }
  }, []);

  // Register refreshToken function so it can be called from fetch wrapper
  useEffect(() => {
    setRefreshTokenFunction(refreshToken);
  }, [token]);

  const refreshToken = async () => {
    // Prevent multiple simultaneous refresh attempts
    if (refreshingRef.current) {
      return refreshPromiseRef.current || Promise.resolve();
    }

    refreshingRef.current = true;
    const refreshPromise = (async () => {
      try {
        const savedRefreshToken = getCookie("refreshToken");
        if (!savedRefreshToken) {
          throw new Error("No refresh token available");
        }

        const response = await fetch("/refresh", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ refresh_token: savedRefreshToken }),
        });

        if (!response.ok) {
          throw new Error("Token refresh failed");
        }

        const data = await response.json();
        const newToken = data.access_token;
        setToken(newToken);
        setCookie("authToken", newToken, 1); // 1 day for access token
        console.log("✅ Token refreshed successfully");
        
        // ALWAYS re-fetch admin status after token refresh from server
        try {
          const userResponse = await fetch("/user/info", {
            headers: {
              Authorization: `Bearer ${newToken}`,
            },
          });
          
          if (userResponse.ok) {
            const userInfo = await userResponse.json();
            const adminStatus = userInfo.is_admin || false;
            setIsAdmin(adminStatus);
            console.log("✅ Admin status refreshed from server:", adminStatus);
          } else {
            setIsAdmin(false);
          }
        } catch (userInfoErr) {
          console.warn("❌ Failed to refresh admin status:", userInfoErr);
          setIsAdmin(false);
        }
      } catch (err) {
        console.error("Token refresh failed:", err);
        logout();
        throw err;
      } finally {
        refreshingRef.current = false;
      }
    })();

    refreshPromiseRef.current = refreshPromise;
    return refreshPromise;
  };

  const login = async (_username: string, _password: string) => {
    // Redirect to main login page with redirect URL
    const redirectUrl = encodeURIComponent(window.location.origin + window.location.pathname);
    window.location.href = `https://gian.ink/login?redirect=${redirectUrl}`;
  };

  const register = async (_username: string, _password: string) => {
    // Redirect to main login page with redirect URL
    const redirectUrl = encodeURIComponent(window.location.origin + window.location.pathname);
    window.location.href = `https://gian.ink/login?redirect=${redirectUrl}`;
  };

  const logout = async () => {
    // Try to revoke refresh token on server
    try {
      const refreshToken = getCookie("refreshToken");
      if (token) {
        await fetch("/logout", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
      }
    } catch (err) {
      console.error("Logout request failed:", err);
    }

    // Clear local state and cookies regardless of server response
    setToken(null);
    setUsername(null);
    setIsAdmin(false);
    setError(null);
    deleteCookie("authToken");
    deleteCookie("refreshToken");
    deleteCookie("username");
    refreshingRef.current = false;
    refreshPromiseRef.current = null;
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        username,
        isAdmin,
        isAuthenticated: !!token,
        isLoading,
        login,
        register,
        logout,
        error,
        refreshToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
