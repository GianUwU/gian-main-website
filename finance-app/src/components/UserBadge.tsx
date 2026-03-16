import React, { useState } from "react";
import { useAuth } from "../AuthContext";
import { fetchWithTokenRefresh } from "../utils/fetchWithTokenRefresh";

export default function UserBadge() {
  const { token, username, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState<boolean>(false);
  const [showPasswordModal, setShowPasswordModal] = useState<boolean>(false);
  const [currentPassword, setCurrentPassword] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<boolean>(false);

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("Please fill in all fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords don't match.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters.");
      return;
    }

    try {
      const res = await fetchWithTokenRefresh("/users/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "Failed to change password");
        setPasswordError(errText);
        return;
      }

      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordSuccess(false);
      }, 2000);
    } catch (err) {
      setPasswordError("Failed to change password. Please try again.");
    }
  }

  return (
    <>
      <div className="user-badge-container">
        <div 
          className="user-badge" 
          title={username || "User"}
          onClick={() => setShowUserMenu(!showUserMenu)}
        >
          <span className="user-icon" style={{display:'flex',alignItems:'center',justifyContent:'center'}}>
            {/* Hamburger menu icon (black and white SVG) */}
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect y="4" width="22" height="2.5" rx="1.25" fill="#000"/>
              <rect y="9.25" width="22" height="2.5" rx="1.25" fill="#000"/>
              <rect y="14.5" width="22" height="2.5" rx="1.25" fill="#000"/>
            </svg>
          </span>
        </div>
        {showUserMenu && (
          <div className="user-dropdown">
            <div className="user-dropdown-item user-info">
              {username}
            </div>
            <a 
              href={window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5173' : 'https://gian.ink'}
              className="user-dropdown-item"
              onClick={() => setShowUserMenu(false)}
            >
              🏠 Main Portal
            </a>
            <a 
              href={window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5174' : 'https://drop.gian.ink'}
              className="user-dropdown-item"
              onClick={() => setShowUserMenu(false)}
            >
              🗂️ Dropserver
            </a>
            <button 
              className="user-dropdown-item" 
              onClick={() => {
                setShowPasswordModal(true);
                setShowUserMenu(false);
              }}
            >
              Change Password
            </button>
            <button 
              className="user-dropdown-item logout-item" 
              onClick={logout}
            >
              Logout
            </button>
          </div>
        )}
      </div>

      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="modal password-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Change Password</h3>
            <form onSubmit={handlePasswordChange}>
              <label>Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="input"
                autoComplete="current-password"
              />

              <label>New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input"
                autoComplete="new-password"
              />

              <label>Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input"
                autoComplete="new-password"
              />

              {passwordError && <div className="form-error">{passwordError}</div>}
              {passwordSuccess && <div className="form-success">Password changed successfully!</div>}

              <div className="modal-buttons">
                <button type="submit" className="button button-confirm">
                  Change Password
                </button>
                <button 
                  type="button" 
                  className="button button-cancel" 
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPasswordError(null);
                    setPasswordSuccess(false);
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
