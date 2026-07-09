import React, { useState, useEffect } from "react";

interface UserAvatarProps {
  userId: string;
  role: "student" | "lecturer";
  size?: number;
  initials?: string;
  className?: string;
  refreshTrigger?: number; // Force reload when the user captures a new avatar
}

export default function UserAvatar({
  userId,
  role,
  size = 32,
  initials = "",
  className = "",
  refreshTrigger = 0,
}: UserAvatarProps) {
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }
    
    // Check localStorage first for instant rendering of the logged-in user's own avatar
    const cached = localStorage.getItem(`futo_avatar_${userId}`);
    if (cached) {
      setAvatarUrl(cached);
      setIsLoading(false);
    }

    // Always fetch from the backend to ensure synchronization and support of other users
    const token = localStorage.getItem("edu_token");
    fetch(`/api/user/avatar/${role}/${userId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error("Avatar not found");
        }
        return res.json();
      })
      .then((data) => {
        if (data && data.avatar) {
          setAvatarUrl(data.avatar);
          localStorage.setItem(`futo_avatar_${userId}`, data.avatar);
        } else {
          setAvatarUrl("");
          localStorage.removeItem(`futo_avatar_${userId}`);
        }
      })
      .catch((err) => {
        // Fail silently and use fallback state
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [userId, role, refreshTrigger]);

  const initialsMarkup = initials ? initials.trim().substring(0, 2).toUpperCase() : "?";

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={`${role} profile avatar`}
        className={`object-cover rounded-none border border-slate-200 dark:border-slate-800 ${className}`}
        style={{ width: size, height: size }}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 select-none ${className}`}
      style={{ 
        width: size, 
        height: size,
        fontSize: size * 0.36 
      }}
    >
      {initialsMarkup}
    </div>
  );
}
