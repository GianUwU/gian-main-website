import { useAuth } from "./AuthContext";
import FinanceTracker from "./components/FinanceTracker";
import Stats from "./components/Stats";
import { useEffect, useState } from "react";
import { getCookie } from "./utils/cookies";

function App() {
  const { isAuthenticated, isLoading } = useAuth();
  const [shouldRedirect, setShouldRedirect] = useState(false);

  // Double-check cookies before redirecting
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Give it a moment and double-check cookies
      const hasAuthCookies = getCookie("authToken") && getCookie("refreshToken") && getCookie("username");
      if (!hasAuthCookies) {
        console.log("No auth cookies found, redirecting to login");
        setShouldRedirect(true);
      } else {
        console.log("Auth cookies exist but isAuthenticated is false - this shouldn't happen now");
        // Don't redirect if cookies exist - auth state should sync momentarily
      }
    }
  }, [isLoading, isAuthenticated]);

  // Wait for auth to load before making redirect decisions
  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      Loading...
    </div>;
  }

  if (shouldRedirect) {
    // Redirect to main login page with redirect URL
    const redirectUrl = encodeURIComponent(window.location.origin + window.location.pathname);
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const mainAppUrl = isLocalhost ? 'http://localhost:5173' : 'https://gian.ink';
    window.location.href = `${mainAppUrl}/login?redirect=${redirectUrl}`;
    return <div>Redirecting to login...</div>;
  }

  if (!isAuthenticated) {
    // Show loading while waiting for auth state to sync
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      Checking authentication...
    </div>;
  }

  const path = window.location.pathname;
  
  return (
    <>
      {path === "/stats" || path === "/stats/" ? <Stats /> : 
       <FinanceTracker />}
    </>
  );
}

export default App;
