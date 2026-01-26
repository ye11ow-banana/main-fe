import React, { useState, useRef } from "react";
import type { UserInfo } from "../../api/auth";
import { updateAvatar, deleteAvatar, getMe } from "../../api/auth";
import { Header } from "../../components/Header/Header";
import { useTheme } from "../../context/ThemeContext";
import "./Profile.css";

interface ProfileProps {
  user: UserInfo;
}

export const Profile: React.FC<ProfileProps> = ({ user: initialUser }) => {
  const { theme } = useTheme();
  const [user, setUser] = useState(initialUser);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSignOut = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("pending_email");
    window.location.href = "/sign-in";
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      await updateAvatar(file);
      const res = await getMe();
      setUser(res.data);
    } catch (err: any) {
      setError(err.message || "Failed to update avatar");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDeleteAvatar = async () => {
    if (!user.avatar_url) return;
    if (!confirm("Are you sure you want to delete your avatar?")) return;

    setIsUploading(true);
    setError(null);

    try {
      await deleteAvatar();
      const res = await getMe();
      setUser(res.data);
    } catch (err: any) {
      setError(err.message || "Failed to delete avatar");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={`profile-page theme-${theme}`}>
      <Header user={user} />

      <main className="main">
        <div className="container profile-container">
          <aside className="profile-sidebar">
            <nav className="profile-nav">
              <a href="/profile" className="profile-nav-item active">
                Profile
              </a>
              <a href="#" className="profile-nav-item">
                Notifications
              </a>
              <a href="#" className="profile-nav-item">
                Settings
              </a>
              <button className="profile-nav-item signout-button" onClick={handleSignOut}>
                Sign Out
              </button>
            </nav>
          </aside>

          <section className="profile-content">
            <h1 className="page-title">Profile Settings</h1>
            
            <div className="profile-card">
              <div className="avatar-section">
                <div className="avatar-wrapper" onClick={() => !isUploading && fileInputRef.current?.click()} style={{ cursor: isUploading ? "default" : "pointer" }}>
                  <img
                    className="profile-avatar-large"
                    src={user.avatar_url || "/profile.webp"}
                    alt={user.username}
                  />
                  <div className="avatar-overlay">
                    <span>Click to update</span>
                  </div>
                  {isUploading && <div className="avatar-loader">Uploading...</div>}
                </div>
                
                <div className="avatar-actions">
                  {user.avatar_url && (
                    <button 
                      className="btn btn-outline-danger" 
                      onClick={handleDeleteAvatar}
                      disabled={isUploading}
                    >
                      Delete Avatar
                    </button>
                  )}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    style={{ display: "none" }}
                  />
                </div>
                {error && <p className="error-message">{error}</p>}
              </div>

              <div className="profile-info">
                <div className="info-group">
                  <label>Username</label>
                  <p>{user.username}</p>
                </div>
                <div className="info-group">
                  <label>Email</label>
                  <p>{user.email}</p>
                </div>
                <div className="info-group">
                  <label>Joined</label>
                  <p>{new Date(user.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};
