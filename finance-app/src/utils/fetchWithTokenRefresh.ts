/**
 * Fetch wrapper that automatically handles token refresh on 401 errors
 * This prevents users from being logged out when their token expires
 */

let refreshTokenFn: (() => Promise<void>) | null = null;

export function setRefreshTokenFunction(fn: () => Promise<void>) {
  refreshTokenFn = fn;
}

export async function fetchWithTokenRefresh(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  let response = await fetch(url, options);

  // If we get a 401 (Unauthorized), try to refresh the token and retry
  if (response.status === 401 && refreshTokenFn) {
    try {
      // Refresh the token silently
      await refreshTokenFn();

      // Get the new token from localStorage
      const newToken = localStorage.getItem("authToken");
      if (!newToken) {
        // If there's no token after refresh, user must re-login
        return response;
      }

      // Update the Authorization header with the new token
      const updatedOptions = { ...options };
      if (!updatedOptions.headers) {
        updatedOptions.headers = {};
      }

      const headers = updatedOptions.headers as Record<string, string>;
      headers.Authorization = `Bearer ${newToken}`;

      // Retry the original request with the new token
      response = await fetch(url, updatedOptions);
    } catch (error) {
      console.error("Token refresh failed, user will need to re-login:", error);
      // Return the original 401 response
    }
  }

  return response;
}
