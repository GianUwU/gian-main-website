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
    // Clean up any legacy isAdmin cookies
    deleteCookie("isAdmin");
    
    const savedToken = getCookie("authToken");
    const savedUsername = getCookie("username");
    const savedRefreshToken = getCookie("refreshToken");
    
    console.log("Main App - Loading auth from cookies:", {
      hasToken: !!savedToken,
      hasRefreshToken: !!savedRefreshToken,
      username: savedUsername
    });
    
    if (savedRefreshToken) {
      if (savedUsername) {
        setUsername(savedUsername);
      }

      const loadUserInfo = (accessToken: string) => {
        fetch("/users/info", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
          .then(res => res.ok ? res.json() : null)
          .then(userInfo => {
            if (userInfo) {
              if (userInfo.username) {
                setUsername(userInfo.username);
              }
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
      };

      if (savedToken) {
        setToken(savedToken);
        console.log("✅ Set auth state from cookies - user is authenticated");
        loadUserInfo(savedToken);
      } else {
        console.log("🔄 Missing access token cookie, attempting silent refresh");
        fetch("/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token: savedRefreshToken }),
        })
          .then(res => {
            if (!res.ok) {
              throw new Error("Token refresh failed during bootstrap");
            }
            return res.json();
          })
          .then(data => {
            const newToken = data.accessToken;
            if (!newToken) {
              throw new Error("No access token returned during bootstrap");
            }
            setToken(newToken);
            setCookie("authToken", newToken, 1);
            console.log("✅ Bootstrapped new access token from refresh token");
            loadUserInfo(newToken);
          })
          .catch(err => {
            console.warn("❌ Bootstrap refresh failed, user not authenticated:", err);
            setToken(null);
            setUsername(null);
            setIsAdmin(false);
            setIsLoading(false);
          });
      }
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

        const response = await fetch("/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token: savedRefreshToken }),
        });

        if (!response.ok) {
          throw new Error("Token refresh failed");
        }

        const data = await response.json();
        const newToken = data.accessToken;
        setToken(newToken);
        setCookie("authToken", newToken, 1); // 1 day for access token
        console.log("✅ Token refreshed successfully");
        
        // ALWAYS re-fetch admin status after token refresh from server
        try {
          const userResponse = await fetch("/users/info", {
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

  const login = async (username: string, password: string) => {
    setError(null);
    try {
      const response = await fetch("/users/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        throw new Error("Invalid credentials");
      }

      const data = await response.json();
      setToken(data.accessToken);
      setUsername(username);
      setCookie("authToken", data.accessToken, 1); // 1 day for access token
      setCookie("refreshToken", data.refreshToken, 30); // 30 days for refresh token
      setCookie("username", username, 30);
      
      // ALWAYS fetch admin status from server - NEVER store in cookie
      try {
        const userResponse = await fetch("/users/info", {
          headers: {
            Authorization: `Bearer ${data.accessToken}`,
          },
        });
        
        if (userResponse.ok) {
          const userInfo = await userResponse.json();
          const adminStatus = userInfo.is_admin || false;
          setIsAdmin(adminStatus);
          console.log("✅ User info loaded - Username:", userInfo.username, "| Admin:", adminStatus);
        } else {
          console.warn("⚠️ Failed to fetch user info (status:", userResponse.status, ") - defaulting to non-admin");
          setIsAdmin(false);
        }
      } catch (userInfoErr) {
        console.warn("❌ Error fetching user info:", userInfoErr);
        setIsAdmin(false);
      }

      // Check for redirect URL in query parameters
      const urlParams = new URLSearchParams(window.location.search);
      const redirectUrl = urlParams.get('redirect');
      if (redirectUrl) {
        console.log("✅ Redirecting to:", redirectUrl);
        window.location.href = redirectUrl;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      setError(message);
      throw err;
    }
  };

  const register = async (username: string, password: string) => {
    setError(null);
    try {
      const response = await fetch("/users/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Registration failed");
      }

      // Auto-login after registration (will handle redirect)
      await login(username, password);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Registration failed";
      setError(message);
      throw err;
    }
  };

  const logout = async () => {
    // Try to revoke refresh token on server
    try {
      const refreshToken = getCookie("refreshToken");
      if (refreshToken) {
        await fetch("/users/logout", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token: refreshToken }),
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
