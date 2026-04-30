import React, { createContext, useState, useContext, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { setRefreshTokenFunction } from "./utils/fetchWithTokenRefresh";

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

  const markAuthenticated = (value: boolean) => {
    setToken(value ? "cookie-session" : null);
  };

  const fetchCurrentUser = async (): Promise<{ username: string; is_admin: boolean } | null> => {
    const response = await fetch("/users/info", {
      credentials: "include",
    });

    if (!response.ok) {
      return null;
    }

    const userInfo = await response.json();
    return {
      username: userInfo.username,
      is_admin: Boolean(userInfo.is_admin),
    };
  };

  // Bootstrap from HttpOnly cookies by asking the backend for the current user.
  useEffect(() => {
    (async () => {
      try {
        let userInfo = await fetchCurrentUser();
        if (!userInfo) {
          await fetch("/token", {
            method: "POST",
            credentials: "include",
          });
          userInfo = await fetchCurrentUser();
        }

        if (userInfo) {
          markAuthenticated(true);
          setUsername(userInfo.username);
          setIsAdmin(Boolean(userInfo.is_admin));
          return;
        }

        markAuthenticated(false);
        setUsername(null);
        setIsAdmin(false);
      } catch (err) {
        console.warn("Auth bootstrap failed:", err);
        markAuthenticated(false);
        setUsername(null);
        setIsAdmin(false);
      } finally {
        setIsLoading(false);
      }
    })();
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
        const response = await fetch("/token", {
          method: "POST",
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Token refresh failed");
        }

        const userInfo = await fetchCurrentUser();
        if (!userInfo) {
          throw new Error("Token refresh succeeded but user session is unavailable");
        }

        markAuthenticated(true);
        setUsername(userInfo.username);
        setIsAdmin(Boolean(userInfo.is_admin));
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

  const login = async (username: string, password: string) => {
    void username
    void password
    // Redirect to main login page with redirect URL
    const redirectUrl = encodeURIComponent(window.location.origin + window.location.pathname);
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const mainAppUrl = isLocalhost ? 'http://localhost:5173' : 'https://gian.ink';
    window.location.href = `${mainAppUrl}/login?redirect=${redirectUrl}`;
  };

  const register = async (username: string, password: string) => {
    void username
    void password
    // Redirect to main login page with redirect URL
    const redirectUrl = encodeURIComponent(window.location.origin + window.location.pathname);
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const mainAppUrl = isLocalhost ? 'http://localhost:5173' : 'https://gian.ink';
    window.location.href = `${mainAppUrl}/login?redirect=${redirectUrl}`;
  };

  const logout = async () => {
    // Try to revoke refresh token on server
    try {
      await fetch("/users/logout", {
        method: "DELETE",
        credentials: "include",
      });
    } catch (err) {
      console.error("Logout request failed:", err);
    }

    // Clear local state regardless of server response
    markAuthenticated(false);
    setUsername(null);
    setIsAdmin(false);
    setError(null);
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
