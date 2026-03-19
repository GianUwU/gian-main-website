/**
 * Utility for making authenticated fetch requests with automatic token refresh.
 * When a request fails with 401, automatically attempts to refresh the token
 * and retry the request once.
 */

import { getCookie } from "./cookies";

let refreshTokenFunction: (() => Promise<void>) | null = null;

export function setRefreshTokenFunction(fn: () => Promise<void>) {
  refreshTokenFunction = fn;
}

function isAuthStatus(status: number): boolean {
  return status === 401 || status === 403;
}

export async function fetchWithTokenRefresh(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getCookie("authToken");

  // Add Authorization header if token exists and not already present
  const headers = new Headers(options.headers);
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Make the initial request
  let response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  // If we get an auth error and have a refresh function, try refreshing the token.
  if (isAuthStatus(response.status) && refreshTokenFunction) {
    console.log("🔄 Got auth error, attempting token refresh...");
    
    try {
      // Attempt to refresh the token
      await refreshTokenFunction();
      
      // Get the new token
      const newToken = getCookie("authToken");
      if (!newToken) {
        throw new Error("No token after refresh");
      }

      // Update the Authorization header with the new token
      headers.set("Authorization", `Bearer ${newToken}`);

      // Retry the original request with the new token
      response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include',
      });

      console.log("✅ Request retried successfully after token refresh");
    } catch (error) {
      console.error("❌ Token refresh failed:", error);
      // Let the original auth-error response be returned
    }
  }

  return response;
}
