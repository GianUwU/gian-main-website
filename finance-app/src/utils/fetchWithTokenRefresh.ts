/**
 * Fetch wrapper that automatically handles token refresh on auth errors
 * This prevents users from being logged out when their token expires
 */

import { getCookie } from "./cookies";

let refreshTokenFn: (() => Promise<void>) | null = null;

export function setRefreshTokenFunction(fn: () => Promise<void>) {
  refreshTokenFn = fn;
}

function isAuthStatus(status: number): boolean {
  return status === 401 || status === 403;
}

function withAuthHeader(options: RequestInit, token: string | null): Headers {
  const headers = new Headers(options.headers);
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
}

export async function fetchWithTokenRefresh(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const initialToken = getCookie("authToken");
  let headers = withAuthHeader(options, initialToken);

  let response = await fetch(url, {
    ...options,
    headers,
    credentials: options.credentials ?? "include",
  });

  // If we get an auth error, try to refresh the token and retry.
  if (isAuthStatus(response.status) && refreshTokenFn) {
    try {
      await refreshTokenFn();

      const newToken = getCookie("authToken");
      if (!newToken) {
        return response;
      }

      headers = new Headers(options.headers);
      headers.set("Authorization", `Bearer ${newToken}`);

      // Retry the original request with the new token
      response = await fetch(url, {
        ...options,
        headers,
        credentials: options.credentials ?? "include",
      });
    } catch (error) {
      console.error("Token refresh failed:", error);
    }
  }

  return response;
}
