/**
 * Cookie utilities for secure token storage across subdomains
 */

export function setCookie(name: string, value: string, days: number = 30) {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  
  // Set cookie with domain to share across subdomains
  // Secure flag ensures it's only sent over HTTPS
  // SameSite=Lax provides CSRF protection while allowing navigation
  const isProduction = window.location.hostname.includes('gian.ink');
  const cookieAttributes = [
    `${name}=${value}`,
    `expires=${expires.toUTCString()}`,
    `path=/`,
    `SameSite=Lax`
  ];
  
  if (isProduction) {
    cookieAttributes.push('domain=.gian.ink');
    cookieAttributes.push('Secure');
  }
  
  document.cookie = cookieAttributes.join('; ');
}

export function getCookie(name: string): string | null {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  
  return null;
}

export function deleteCookie(name: string) {
  // Set expiry to past date to delete
  const isProduction = window.location.hostname.includes('gian.ink');
  const cookieAttributes = [
    `${name}=`,
    `expires=Thu, 01 Jan 1970 00:00:00 UTC`,
    `path=/`,
    `SameSite=Lax`
  ];
  
  if (isProduction) {
    cookieAttributes.push('domain=.gian.ink');
    cookieAttributes.push('Secure');
  }
  
  document.cookie = cookieAttributes.join('; ');
}

// Clean up any legacy isAdmin cookies (migration helper)
export function cleanupLegacyCookies() {
  deleteCookie('isAdmin');
  console.log('🧹 Cleaned up legacy isAdmin cookie');
}
