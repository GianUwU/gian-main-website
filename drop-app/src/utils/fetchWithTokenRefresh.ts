/**
 * Utility for making authenticated fetch requests with automatic token refresh.
 * When a request fails with 401/403, it refreshes auth cookies and retries once.
 */

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
  // Make the initial request
  let response = await fetch(url, {
    ...options,
    credentials: options.credentials ?? "include",
  });

  // If we get an auth error and have a refresh function, try refreshing the token.
  if (isAuthStatus(response.status) && refreshTokenFunction) {
    console.log("🔄 Got auth error, attempting token refresh...");
    
    try {
      // Attempt to refresh the token
      await refreshTokenFunction();

      // Retry the original request with the new token
      response = await fetch(url, {
        ...options,
        credentials: options.credentials ?? "include",
      });

      console.log("✅ Request retried successfully after token refresh");
    } catch (error) {
      console.error("❌ Token refresh failed:", error);
      // Let the original auth-error response be returned
    }
  }

  return response;
}
