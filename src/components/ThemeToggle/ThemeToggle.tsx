import React from "react";
import { useTheme } from "../../context/ThemeContext";
import "./ThemeToggle.css";

export const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <label className="theme-toggle-switch">
      <input 
        type="checkbox" 
        checked={theme === "dark"} 
        onChange={toggleTheme}
        aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
      />
      <span className="slider"></span>
    </label>
  );
};
