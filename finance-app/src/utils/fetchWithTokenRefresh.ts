/**
 * Fetch wrapper that automatically handles token refresh on auth errors
 * This prevents users from being logged out when their token expires
 */

import { getCookie } from "./cookies";

let refreshTokenFn: (() => Promise<void>) | null = null;

export function setRefreshTokenFunction(fn: () => Promise<void>) {
  refreshTokenFn = fn;
}

function getLoginRedirectUrl(): string {
  const redirectUrl = encodeURIComponent(window.location.origin + window.location.pathname);
  const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  const mainAppUrl = isLocalhost ? "http://localhost:5173" : "https://gian.ink";
  return `${mainAppUrl}/login?redirect=${redirectUrl}`;
}

function isAuthStatus(status: number): boolean {
  return status === 401 || status === 403;
}

export async function fetchWithTokenRefresh(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  let response = await fetch(url, options);

  // If we get an auth error, try to refresh the token and retry.
  if (isAuthStatus(response.status) && refreshTokenFn) {
    try {
      // Refresh the token silently
      await refreshTokenFn();

      const newToken = getCookie("authToken");
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

      if (isAuthStatus(response.status)) {
        window.location.href = getLoginRedirectUrl();
      }
    } catch (error) {
      console.error("Token refresh failed, user will need to re-login:", error);
      window.location.href = getLoginRedirectUrl();
    }
  } else if (isAuthStatus(response.status)) {
    window.location.href = getLoginRedirectUrl();
  }

  return response;
}
