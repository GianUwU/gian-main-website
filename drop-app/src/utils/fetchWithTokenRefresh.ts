/**
 * Utility for making authenticated fetch requests with automatic token refresh.
 * When a request fails with 401, automatically attempts to refresh the token
 * and retry the request once.
 */

let refreshTokenFunction: (() => Promise<void>) | null = null;

export function setRefreshTokenFunction(fn: () => Promise<void>) {
  refreshTokenFunction = fn;
}

export async function fetchWithTokenRefresh(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // Get the current token from localStorage
  const token = localStorage.getItem("authToken");

  // Add Authorization header if token exists and not already present
  const headers = new Headers(options.headers);
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Make the initial request
  let response = await fetch(url, {
    ...options,
    headers,
  });

  // If we get a 401 and have a refresh function, try refreshing the token
  if (response.status === 401 && refreshTokenFunction) {
    console.log("🔄 Got 401, attempting token refresh...");
    
    try {
      // Attempt to refresh the token
      await refreshTokenFunction();
      
      // Get the new token
      const newToken = localStorage.getItem("authToken");
      if (!newToken) {
        throw new Error("No token after refresh");
      }

      // Update the Authorization header with the new token
      headers.set("Authorization", `Bearer ${newToken}`);

      // Retry the original request with the new token
      response = await fetch(url, {
        ...options,
        headers,
      });

      console.log("✅ Request retried successfully after token refresh");
    } catch (error) {
      console.error("❌ Token refresh failed:", error);
      // Let the 401 response be returned
    }
  }

  return response;
}
