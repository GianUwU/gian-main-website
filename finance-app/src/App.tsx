import { useAuth } from "./AuthContext";
import FinanceTracker from "./components/FinanceTracker";
import Stats from "./components/Stats";
import Login from "./components/Login";

function App() {
  const { isAuthenticated, isLoading } = useAuth();
  const path = window.location.pathname;

  // Wait for auth bootstrap before rendering
  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#213547' }}>
        Loading...
      </div>
    );
  }

  // If on login route or not authenticated, render Login component
  if (!isAuthenticated || path === "/login" || path === "/login/") {
    return <Login />;
  }

  return (
    <>
      {path === "/stats" || path === "/stats/" ? <Stats /> : <FinanceTracker />}
    </>
  );
}

export default App;
