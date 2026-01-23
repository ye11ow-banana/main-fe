import React from "react";
import { useTheme } from "../../context/ThemeContext";
import type { UserInfo } from "../../api/auth";
import { ThemeToggle } from "../ThemeToggle/ThemeToggle";
import "./Header.css";

interface HeaderProps {
  user: UserInfo;
}

export const Header: React.FC<HeaderProps> = ({ user }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="header">
      <div className="container header-inner">
        <a href="/" className="header-left" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="logo-icon" />
          <div className="logo-text">ServiceHub</div>
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

          <div className="avatar-block">
            <img
              className="avatar-image"
              src="/profile.webp"
              alt={`${user.username} profile`}
              loading="lazy"
            />
            <div className="avatar-name">{user.username}</div>
          </div>
        </div>
      </div>
    </header>
  );
};
