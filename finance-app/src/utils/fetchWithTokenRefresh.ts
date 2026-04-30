/**
 * Fetch wrapper that automatically handles token refresh on auth errors
 * This prevents users from being logged out when their token expires
 */

let refreshTokenFn: (() => Promise<void>) | null = null;

export function setRefreshTokenFunction(fn: () => Promise<void>) {
  refreshTokenFn = fn;
}

function isAuthStatus(status: number): boolean {
  return status === 401 || status === 403;
}

export async function fetchWithTokenRefresh(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  let response = await fetch(url, {
    ...options,
    credentials: options.credentials ?? "include",
  });

  // If we get an auth error, try to refresh the token and retry.
  if (isAuthStatus(response.status) && refreshTokenFn) {
    try {
      await refreshTokenFn();

      // Retry the original request with the new token
      response = await fetch(url, {
        ...options,
        credentials: options.credentials ?? "include",
      });
    } catch (error) {
      console.error("Token refresh failed:", error);
    }
  }

  return response;
}