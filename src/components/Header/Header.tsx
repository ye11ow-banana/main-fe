import React, { useState, useRef, useEffect } from "react";
import type { UserInfo } from "../../api/auth";
import { ThemeToggle } from "../ThemeToggle/ThemeToggle";
import "./Header.css";

interface HeaderProps {
  user: UserInfo;
}

export const Header: React.FC<HeaderProps> = ({ user }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const handleSignOut = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("pending_email");
    window.location.href = "/sign-in";
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <header className="header">
      <div className="container header-inner">
        <a href="/" className="header-left">
          <div className="logo-icon" />
          <div className="logo-text">Cube</div>
        </a>

        <div className="header-center">
          <div className="search">
            <div className="search-icon" />
            <input className="search-input" type="text" placeholder="Search services…" />
          </div>
        </div>

        <div className="header-right">
          <button className="icon-button icon-button--search" aria-label="Search">
            🔍
          </button>
          <button className="icon-button icon-button--bell" aria-label="Notifications">
            <span className="icon-bell" aria-hidden="true" />
          </button>

          <ThemeToggle />

          <div className="avatar-container" ref={dropdownRef}>
            <div className="avatar-block" onClick={toggleDropdown} role="button" aria-haspopup="true" aria-expanded={isDropdownOpen}>
              <img
                className="avatar-image"
                src={user.avatar_url || "/profile.webp"}
                alt={`${user.username} profile`}
                loading="lazy"
              />
              <div className="avatar-name">{user.username}</div>
            </div>

            {isDropdownOpen && (
              <div className="avatar-dropdown">
                <a href="/profile" className="dropdown-item">
                  Profile
                </a>
                <button className="dropdown-item" onClick={handleSignOut}>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
