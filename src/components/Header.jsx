import { useNavigate } from "react-router-dom";
import { supabase } from "../api/supabaseClient";
import { useEffect, useState, useCallback, useRef } from "react";
import toast from "react-hot-toast"; // 👈 Added missing import

// Helper to get public URL for an image stored in the "Soham" bucket
const getImageUrl = (path) => {
  if (!path) return "";
  const { data } = supabase.storage.from("Soham").getPublicUrl(path);
  return data.publicUrl;
};

export default function Header() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(""); // from users.role.role_name
  const [avatarUrl, setAvatarUrl] = useState(""); // from profiles.avatar_url
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [profileDropdown, setProfileDropdown] = useState(false);
  const [notifDropdown, setNotifDropdown] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);

  const notifRef = useRef(null);
  const profileRef = useRef(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifDropdown(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Get user, their role, and avatar
  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setUser(data.user);
        
        // Fetch user's role from the users table
        const { data: userData } = await supabase
          .from("users")
          .select("role:role_id(role_name)")
          .eq("id", data.user.id)
          .single();
        if (userData?.role) {
          setUserRole(userData.role.role_name);
        }

        // Fetch user's avatar from profiles table
        const { data: profileData } = await supabase
          .from("profiles")
          .select("avatar_url")
          .eq("id", data.user.id)
          .single();
        if (profileData?.avatar_url) {
          setAvatarUrl(profileData.avatar_url);
        }
      }
    };
    getUser();
  }, []);

  // Fetch unread count when user changes
  useEffect(() => {
    if (user?.id) {
      fetchUnreadCount();
    }
  }, [user]);

  const fetchUnreadCount = async () => {
    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    setUnreadCount(count || 0);
  };

  const fetchNotifications = async () => {
    setLoadingNotifs(true);
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5);
    if (!error) setNotifications(data || []);
    setLoadingNotifs(false);
  };

  const handleNotifClick = () => {
    if (!notifDropdown) {
      fetchNotifications();
    }
    setNotifDropdown(!notifDropdown);
  };

  const markAsRead = async (id) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  // Mark all as read
  const markAllAsRead = async () => {
    if (!user) return;
    const toastId = toast.loading("Marking all as read...");
    try {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
      toast.success("All notifications marked as read", { id: toastId });
    } catch (err) {
      console.error("Error marking all as read:", err);
      toast.error("Failed to mark all as read", { id: toastId });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("user");
    navigate("/login");
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchTerm)}`);
    }
  };

  return (
    <header className="app-header">
      {/* Logo / Brand */}
      <div className="logo" onClick={() => navigate("/")}>
        <span className="logo-text">Soham</span>
      </div>

      {/* Search */}
      <form className="header-search" onSubmit={handleSearch}>
        <input
          type="text"
          placeholder="Search products, users, leads..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <button type="submit" className="search-btn" aria-label="Search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
      </form>

      {/* Right Actions */}
      <div className="header-actions">
        {/* Notifications */}
        <div className="action-wrapper" ref={notifRef}>
          <button
            className="action-btn"
            onClick={handleNotifClick}
            aria-label="Notifications"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
          </button>

          {/* Notifications Dropdown */}
          {notifDropdown && (
            <div className="dropdown notif-dropdown">
              <div className="dropdown-header">
                <h4>Notifications</h4>
                <div className="dropdown-header-actions">
                  {unreadCount > 0 && (
                    <button className="mark-all-read" onClick={markAllAsRead}>
                      Mark all read
                    </button>
                  )}
                  <button
                    className="view-all"
                    onClick={() => {
                      setNotifDropdown(false);
                      navigate("/notifications");
                    }}
                  >
                    View all
                  </button>
                </div>
              </div>
              <div className="dropdown-body">
                {loadingNotifs ? (
                  <div className="loading-spinner" />
                ) : notifications.length === 0 ? (
                  <p className="empty">No new notifications</p>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`notif-item ${notif.is_read ? "read" : "unread"}`}
                      onClick={() => {
                        if (!notif.is_read) markAsRead(notif.id);
                        if (notif.link) navigate(notif.link);
                        setNotifDropdown(false);
                      }}
                    >
                      <div className="notif-content">
                        <p className="notif-message">{notif.message}</p>
                        <span className="notif-time">
                          {new Date(notif.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {!notif.is_read && <span className="unread-dot" />}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile */}
        <div className="action-wrapper" ref={profileRef}>
          <button
            className="action-btn"
            onClick={() => setProfileDropdown(!profileDropdown)}
            aria-label="Profile"
          >
            {avatarUrl ? (
              <img
                src={getImageUrl(avatarUrl)}
                alt="Avatar"
                className="profile-avatar"
              />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            )}
          </button>

          {profileDropdown && (
            <div className="dropdown profile-dropdown">
              <div className="profile-info">
                <strong>{user?.email}</strong>
                <span>{userRole || "User"}</span>
              </div>
              <div className="dropdown-divider" />
              <button onClick={() => navigate("/profile")}>Profile</button>
              <button onClick={() => navigate("/settings")}>Settings</button>
              <button onClick={handleLogout} className="logout">
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

      {/* STYLES */}
      <style>{`
        .app-header {
          position: sticky;
          top: 0;
          z-index: 1000;
          height: 70px;
          background: white;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 24px;
          border-bottom: 1px solid rgba(0,0,0,0.05);
          font-family: 'Nunito', sans-serif;
          box-shadow: 0 2px 10px rgba(0,0,0,0.02);
        }

        .logo {
          cursor: pointer;
          font-size: 1.5rem;
          font-weight: 700;
          color: #c89f72;
          letter-spacing: -0.5px;
        }

        .logo-text {
          background: linear-gradient(135deg, #c89f72, #b88a5a);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .header-search {
          display: flex;
          align-items: center;
          background: #f5f7fa;
          border-radius: 40px;
          padding: 4px 4px 4px 16px;
          width: 320px;
          transition: box-shadow 0.2s ease;
        }

        .header-search:focus-within {
          box-shadow: 0 0 0 3px rgba(200,159,114,0.2);
        }

        .search-input {
          border: none;
          background: transparent;
          flex: 1;
          outline: none;
          font-family: 'Nunito', sans-serif;
          font-size: 0.95rem;
          color: #333;
        }

        .search-input::placeholder {
          color: #aaa;
        }

        .search-btn {
          border: none;
          background: #c89f72;
          color: white;
          border-radius: 40px;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.2s ease;
        }

        .search-btn:hover {
          background: #b88a5a;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .action-wrapper {
          position: relative;
        }

        .action-btn {
          width: 44px;
          height: 44px;
          background: #f5f7fa;
          border: none;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #555;
          transition: all 0.2s ease;
          position: relative;
        }

        .action-btn:hover {
          background: #e9ecef;
          color: #c89f72;
        }

        .profile-avatar {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          object-fit: cover;
        }

        .badge {
          position: absolute;
          top: 2px;
          right: 2px;
          background: #c89f72;
          color: white;
          font-size: 10px;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 20px;
          min-width: 18px;
          text-align: center;
          border: 2px solid white;
        }

        .dropdown {
          position: absolute;
          right: 0;
          top: 54px;
          width: 300px;
          background: white;
          border-radius: 16px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.08);
          border: 1px solid rgba(0,0,0,0.04);
          overflow: hidden;
          z-index: 1001;
        }

        .notif-dropdown {
          width: 320px;
        }

        .dropdown-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          border-bottom: 1px solid #eee;
        }

        .dropdown-header h4 {
          margin: 0;
          font-weight: 600;
          color: #333;
        }

        .dropdown-header-actions {
          display: flex;
          gap: 12px;
        }

        .mark-all-read {
          background: none;
          border: none;
          color: #f39c12;
          font-weight: 600;
          font-size: 0.9rem;
          cursor: pointer;
        }

        .mark-all-read:hover {
          text-decoration: underline;
        }

        .view-all {
          background: none;
          border: none;
          color: #c89f72;
          font-weight: 600;
          font-size: 0.9rem;
          cursor: pointer;
        }

        .view-all:hover {
          text-decoration: underline;
        }

        .dropdown-body {
          max-height: 300px;
          overflow-y: auto;
        }

        .notif-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          cursor: pointer;
          transition: background 0.2s ease;
        }

        .notif-item:hover {
          background: #f9f9f9;
        }

        .notif-item.unread {
          background: #fff8f0;
        }

        .notif-content {
          flex: 1;
        }

        .notif-message {
          margin: 0 0 4px;
          font-size: 0.9rem;
          color: #333;
        }

        .notif-time {
          font-size: 0.75rem;
          color: #999;
        }

        .unread-dot {
          width: 8px;
          height: 8px;
          background: #c89f72;
          border-radius: 50%;
          margin-left: 8px;
        }

        .empty {
          text-align: center;
          color: #aaa;
          padding: 20px;
        }

        .loading-spinner {
          width: 30px;
          height: 30px;
          margin: 20px auto;
          border: 2px solid #f0f0f0;
          border-top-color: #c89f72;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .profile-dropdown {
          width: 220px;
          padding: 8px;
        }

        .profile-info {
          padding: 12px;
          display: flex;
          flex-direction: column;
        }

        .profile-info strong {
          color: #333;
          font-size: 0.95rem;
          word-break: break-all;
        }

        .profile-info span {
          color: #999;
          font-size: 0.8rem;
          margin-top: 2px;
        }

        .dropdown-divider {
          height: 1px;
          background: #eee;
          margin: 4px 0;
        }

        .profile-dropdown button {
          width: 100%;
          background: none;
          border: none;
          text-align: left;
          padding: 10px 12px;
          font-family: 'Nunito', sans-serif;
          font-size: 0.9rem;
          color: #333;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.2s ease;
        }

        .profile-dropdown button:hover {
          background: #f5f5f5;
        }

        .profile-dropdown .logout {
          color: #f44336;
        }

        .profile-dropdown .logout:hover {
          background: #fff0f0;
        }
      `}</style>
    </header>
  );
}