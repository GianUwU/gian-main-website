import { useState, useEffect } from 'react';
import './BackendStatusIndicator.css';

export default function BackendStatusIndicator() {
  const [isBackendDown, setIsBackendDown] = useState(false);

  useEffect(() => {
    // Check backend health on mount and every 30 seconds
    const checkBackend = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        const response = await fetch('/api/health', {
          signal: controller.signal,
          cache: 'no-cache'
        });

        clearTimeout(timeoutId);
        
        if (response.ok) {
          setIsBackendDown(false);
        } else {
          setIsBackendDown(true);
        }
      } catch (error) {
        // Network error or timeout - backend is down
        console.error('Backend health check failed:', error);
        setIsBackendDown(true);
      }
    };

    // Check immediately
    checkBackend();

    // Then check every 30 seconds
    const interval = setInterval(checkBackend, 30000);

    return () => clearInterval(interval);
  }, []);

  // Listen for fetch errors globally
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);
        
        // If we get a successful response to an API endpoint, mark backend as up
        if (response.ok && typeof args[0] === 'string' && args[0].startsWith('/')) {
          setIsBackendDown(false);
        }
        
        return response;
      } catch (error) {
        // Network error - check if it's an API call
        if (typeof args[0] === 'string' && args[0].startsWith('/')) {
          setIsBackendDown(true);
        }
        throw error;
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  if (!isBackendDown) {
    return null;
  }

  return (
    <div className="backend-status-banner">
      <div className="backend-status-content">
        <span className="backend-status-icon">⚠️</span>
        <div className="backend-status-text">
          <strong>Backend Server Unavailable</strong>
          <span className="backend-status-subtext">
            Cannot connect to the server. Please check if the backend is running.
          </span>
        </div>
        <button 
          className="backend-status-retry"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    </div>
  );
}
