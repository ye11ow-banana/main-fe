import React, { useEffect, useMemo, useRef, useState } from "react";
import type { UserInfo } from "../../api/auth";
import { updateAvatar, deleteAvatar, getMe } from "../../api/auth";
import { getApps, type AppDTO } from "../../api/apps";
import { ApiError } from "../../api/http";
import {
  getAllSettings,
  updateSettings,
  type AllSettingsResponseDTO,
  type CalorieSettingDTO,
} from "../../api/settings";
import { Header } from "../../components/Header/Header";
import { useTheme } from "../../context/useTheme";
import {
  CALORIES_APP_ID,
  getSettingsGroupsForScope,
  type SettingsScope,
} from "./settingsRegistry";
import "./Profile.css";

interface ProfileProps {
  user: UserInfo;
  settingsScope: SettingsScope;
}

type ProfileTab = "profile" | "notifications" | "settings";

function isProfileTab(value: string | null): value is ProfileTab {
  return value === "profile" || value === "notifications" || value === "settings";
}

function findCaloriesApp(apps: AppDTO[]): AppDTO | undefined {
  return apps.find((app) => app.id === CALORIES_APP_ID)
    ?? apps.find((app) => app.name.toLowerCase().includes("calorie"));
}

export const Profile: React.FC<ProfileProps> = ({ user: initialUser, settingsScope }) => {
  const { theme } = useTheme();
  const [user, setUser] = useState(initialUser);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<AllSettingsResponseDTO | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [savingSettingKey, setSavingSettingKey] = useState<keyof CalorieSettingDTO | null>(null);
  const [settingSaveError, setSettingSaveError] = useState<{
    key: keyof CalorieSettingDTO;
    message: string;
  } | null>(null);
  const [caloriesAppName, setCaloriesAppName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const profileUrl = settingsScope === "calorie" ? "/calories/profile" : "/profile";
  const activeTabStorageKey = `profile_active_tab:v1:${profileUrl}`;
  const [activeTab, setActiveTab] = useState<ProfileTab>(() => {
    const savedTab = localStorage.getItem(activeTabStorageKey);
    return isProfileTab(savedTab) ? savedTab : "profile";
  });
  const visibleGroups = useMemo(
    () => getSettingsGroupsForScope(settingsScope),
    [settingsScope],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      setSettingsLoading(true);
      setSettingsError(null);

      try {
        const res = await getAllSettings();
        if (isMounted) setSettings(res.data);
      } catch (err) {
        if (!isMounted) return;
        if (err instanceof ApiError) setSettingsError(err.message);
        else setSettingsError("Failed to load settings");
      } finally {
        if (isMounted) setSettingsLoading(false);
      }
    }

    void loadSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(activeTabStorageKey, activeTab);
  }, [activeTab, activeTabStorageKey]);

  useEffect(() => {
    let isMounted = true;

    async function loadAppNames() {
      try {
        const res = await getApps();
        const apps = Array.isArray(res.data) ? res.data : [res.data];
        const caloriesApp = findCaloriesApp(apps);

        if (isMounted && caloriesApp) {
          setCaloriesAppName(caloriesApp.name);
        }
      } catch {
        // Keep registry fallback names if apps cannot be loaded.
      }
    }

    void loadAppNames();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("pending_email");
    window.location.href = "/sign-in";
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setUser(prev => ({ ...prev, avatar_url: previewUrl }));

    setIsUploading(true);
    setError(null);

    try {
      await updateAvatar(file);
      const res = await getMe();
      setUser(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update avatar");
      const res = await getMe();
      setUser(res.data);
    } finally {
      setIsUploading(false);
      URL.revokeObjectURL(previewUrl);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDeleteAvatar = async () => {
    if (!user.avatar_url) return;

    setIsUploading(true);
    setError(null);

    try {
      await deleteAvatar();
      const res = await getMe();
      setUser(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete avatar");
    } finally {
      setIsUploading(false);
    }
  };

  const handleCalorieSettingChange = (
    key: keyof CalorieSettingDTO,
    value: boolean,
  ) => {
    if (!settings) return;

    const previousValue = settings.calorie_setting[key];

    setSettings((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        calorie_setting: {
          ...prev.calorie_setting,
          [key]: value,
        },
      };
    });
    setSavingSettingKey(key);
    setSettingSaveError(null);

    updateSettings({ calorie_setting: { [key]: value } })
      .catch((err) => {
        setSettings((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            calorie_setting: {
              ...prev.calorie_setting,
              [key]: previousValue,
            },
          };
        });
        setSettingSaveError({
          key,
          message: err instanceof ApiError ? err.message : "Failed to save setting",
        });
      })
      .finally(() => {
        setSavingSettingKey((currentKey) => (currentKey === key ? null : currentKey));
      });
  };

  const renderSettingsContent = () => {
    if (settingsLoading) {
      return <p className="settings-state">Loading settings...</p>;
    }

    if (settingsError) {
      return <p className="settings-state settings-state--error">{settingsError}</p>;
    }

    if (!settings || visibleGroups.length === 0) {
      return <p className="settings-state">No settings available.</p>;
    }

    return (
      <div className="settings-groups">
        {visibleGroups.map((group) => {
          if (group.settingGroupKey !== "calorie_setting") return null;

          const groupValues = settings.calorie_setting;
          const appName = caloriesAppName ?? group.appNameFallback;

          return (
            <section className="settings-group" key={group.settingGroupKey}>
              <div className="settings-group-header">
                <h3>{appName}</h3>
                <a className="settings-group-link" href={group.appRoute}>
                  Open app
                </a>
              </div>

              <div className="settings-list">
                {group.settings.map((setting) => {
                  const settingKey = setting.key as keyof CalorieSettingDTO;
                  const isSaving = savingSettingKey === settingKey;

                  return (
                    <label className="setting-row" key={setting.key}>
                      <span className="setting-copy">
                        <span className="setting-label">{setting.label}</span>
                        <span className="setting-description">{setting.description}</span>
                        {!isSaving && settingSaveError?.key === settingKey && (
                          <span className="setting-status setting-status--error">
                            {settingSaveError.message}
                          </span>
                        )}
                      </span>

                      <span className="setting-toggle">
                        <input
                          type="checkbox"
                          checked={groupValues[settingKey]}
                          onChange={(event) =>
                            handleCalorieSettingChange(settingKey, event.target.checked)
                          }
                          disabled={isSaving}
                          aria-label={`${setting.label} for ${appName}`}
                        />
                        <span className="setting-toggle-slider" aria-hidden="true" />
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    );
  };

  const renderProfileContent = () => (
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
  );

  const renderNotificationsContent = () => (
    <div className="profile-card profile-empty-card">
      <h2>Notifications</h2>
      <p>Notification settings are not available yet.</p>
    </div>
  );

  const pageTitle = activeTab === "settings"
    ? "Settings"
    : activeTab === "notifications"
      ? "Notifications"
      : "Profile";

  return (
    <div className={`profile-page theme-${theme}`}>
      <Header user={user} profileUrl={profileUrl} />

      <main className="main">
        <div className="container profile-container">
          <aside className="profile-sidebar">
            <nav className="profile-nav">
              <button
                type="button"
                className={`profile-nav-item ${activeTab === "profile" ? "active" : ""}`}
                onClick={() => setActiveTab("profile")}
                aria-current={activeTab === "profile" ? "page" : undefined}
              >
                Profile
              </button>
              <button
                type="button"
                className={`profile-nav-item ${activeTab === "notifications" ? "active" : ""}`}
                onClick={() => setActiveTab("notifications")}
                aria-current={activeTab === "notifications" ? "page" : undefined}
              >
                Notifications
              </button>
              <button
                type="button"
                className={`profile-nav-item ${activeTab === "settings" ? "active" : ""}`}
                onClick={() => setActiveTab("settings")}
                aria-current={activeTab === "settings" ? "page" : undefined}
              >
                Settings
              </button>
              <button className="profile-nav-item signout-button" onClick={handleSignOut}>
                Sign Out
              </button>
            </nav>
          </aside>

          <section className="profile-content">
            <h1 className="page-title">{pageTitle}</h1>

            {activeTab === "profile" && renderProfileContent()}
            {activeTab === "notifications" && renderNotificationsContent()}
            {activeTab === "settings" && renderSettingsContent()}
          </section>
        </div>
      </main>
    </div>
  );
};
