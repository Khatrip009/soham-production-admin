import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  Boxes,
  Users,
  ClipboardList,
  Image,
  FileText,
  Settings,
  Warehouse,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import clsx from "clsx";
import { useState, useEffect } from "react";
import { supabase } from "../api/supabaseClient";
import logo from "../assets/sohom_logo.png";

/* ---------------- NAV CONFIG ---------------- */
const navItems = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "view_dashboard" },
  { path: "/products", label: "Products", icon: Package, permission: "manage_products" },
  { path: "/categories", label: "Categories", icon: Boxes, permission: "manage_categories" },
  { path: "/inventory", label: "Inventory", icon: Warehouse, permission: "manage_inventory" },
  { path: "/media", label: "Media", icon: Image, permission: "manage_media" },
  { path: "/pages", label: "Pages", icon: FileText, permission: "manage_pages" },
  { path: "/users", label: "Users", icon: Users, permission: "manage_users" },
  { path: "/roles", label: "Roles", icon: ShieldCheck, permission: "manage_roles" },
  { path: "/leads", label: "Leads", icon: ClipboardList, permission: "manage_leads" },
  { path: "/settings", label: "Settings", icon: Settings, permission: "manage_settings" },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [permissions, setPermissions] = useState([]);
  const [role, setRole] = useState("");
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadUserAndPermissions();
  }, []);

  async function loadUserAndPermissions() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setUser(user);

    const { data: profile } = await supabase
      .from("users")
      .select("role_id, roles!users_role_id_fkey(role_name)")
      .eq("id", user.id)
      .maybeSingle();

    if (profile) {
      setRole(profile.roles?.role_name || "User");

      if (profile.role_id) {
        const { data: perms } = await supabase
          .from("role_permissions")
          .select("permissions!role_permissions_permission_fk(permission_key)")
          .eq("role_id", profile.role_id);

        const list = perms?.map(p => p.permissions?.permission_key).filter(Boolean) || [];
        setPermissions(list);
      }
    }
  }

  const visibleItems = navItems.filter(item =>
    permissions.includes(item.permission)
  );

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <aside className={clsx("sidebar", collapsed && "collapsed")}>
      {/* HEADER with glass effect */}
      <div className="header">
        <div className="logo-box">
          <img src={logo} alt="Soham Logo" className="logo" />
        </div>

        {!collapsed && (
          <div className="brand-name">
            <span>Soham</span> Productions
          </div>
        )}

        {!collapsed && user && (
          <div className="user-info">
            <div className="avatar">
              {user.email?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="user-details">
              <p className="user-name">{user.email?.split('@')[0] || "User"}</p>
              <p className="user-role">{role}</p>
              <p className="login-time">
                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* NAV with scrollable area and animated items */}
      <nav className="nav-scrollable">
        {visibleItems.map(item => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                clsx("nav-item", isActive && "active")
              }
            >
              <Icon size={20} className="nav-icon" />
              {!collapsed && <span className="nav-label">{item.label}</span>}
              {!collapsed && <span className="nav-glow" />}
            </NavLink>
          );
        })}
      </nav>

      {/* FOOTER with glass effect */}
      <div className="footer">
        <button onClick={logout} className="logout">
          <LogOut size={18} className="logout-icon" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>

      {/* COLLAPSE BUTTON (floating) */}
      <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)}>
        {collapsed ? "›" : "‹"}
      </button>

      {/* STYLES – glass‑morphic with animations */}
      <style>{`
.sidebar {
  width: 280px;
  height: 100vh;
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-right: 1px solid rgba(200, 160, 120, 0.2);
  display: flex;
  flex-direction: column;
  font-family: "Nunito", sans-serif;
  transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease;
  overflow: hidden;
  box-shadow: 0 0 40px rgba(0, 0, 0, 0.03);
  position: relative;
}

.sidebar::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(145deg, rgba(255, 245, 235, 0.3), rgba(255, 255, 255, 0.6));
  pointer-events: none;
  z-index: -1;
}

.sidebar:hover {
  box-shadow: 4px 0 40px rgba(200, 160, 120, 0.15);
}

.sidebar.collapsed {
  width: 90px;
}

/* HEADER */
.header {
  padding: 24px 16px 16px;
  border-bottom: 1px solid rgba(200, 160, 120, 0.15);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.logo-box {
  width: 100%;
  display: flex;
  justify-content: center;
  transition: transform 0.3s ease;
}

.logo {
  width: 100%;
  max-width: 130px;
  height: auto;
  object-fit: contain;
  transition: transform 0.4s ease;
  filter: drop-shadow(0 4px 8px rgba(200, 160, 120, 0.2));
}

.logo:hover {
  transform: scale(1.05) rotate(1deg);
}

.brand-name {
  text-align: center;
  font-size: 16px;
  font-weight: 600;
  color: #5a4a3a;
  letter-spacing: 0.5px;
  animation: fadeIn 0.3s ease;
}

.brand-name span {
  color: #c89f72;
  font-weight: 700;
}

/* USER INFO – enhanced */
.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(10px);
  padding: 10px 12px;
  border-radius: 20px;
  border: 1px solid rgba(200, 160, 120, 0.2);
  animation: slideDown 0.3s ease;
  transition: background 0.3s;
}

.user-info:hover {
  background: rgba(255, 255, 255, 0.7);
}

.avatar {
  width: 42px;
  height: 42px;
  background: linear-gradient(135deg, #c89f72, #e6b87e);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 700;
  font-size: 1.2rem;
  box-shadow: 0 4px 10px rgba(200, 159, 114, 0.4);
}

.user-details {
  flex: 1;
}

.user-name {
  font-size: 14px;
  font-weight: 700;
  color: #3a2e24;
  line-height: 1.3;
}

.user-role {
  font-size: 11px;
  color: #7a6a5a;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  font-weight: 600;
}

.login-time {
  font-size: 10px;
  color: #a58e7a;
}

/* COLLAPSE BUTTON – floating */
.collapse-btn {
  position: absolute;
  top: 50%;
  right: -12px;
  transform: translateY(-50%);
  width: 28px;
  height: 28px;
  background: white;
  border: 1px solid rgba(200, 160, 120, 0.3);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 18px;
  color: #c89f72;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease;
  z-index: 10;
}

.collapse-btn:hover {
  background: #c89f72;
  color: white;
  transform: translateY(-50%) scale(1.1);
  box-shadow: 0 6px 16px rgba(200, 159, 114, 0.3);
}

/* NAV SCROLLABLE */
.nav-scrollable {
  flex: 1;
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
}

/* Custom scrollbar */
.nav-scrollable::-webkit-scrollbar {
  width: 4px;
}
.nav-scrollable::-webkit-scrollbar-thumb {
  background: rgba(200, 160, 120, 0.3);
  border-radius: 10px;
  transition: background 0.2s;
}
.nav-scrollable::-webkit-scrollbar-thumb:hover {
  background: rgba(200, 160, 120, 0.5);
}
.nav-scrollable::-webkit-scrollbar-track {
  background: transparent;
}

/* NAV ITEM – with glow and animation */
.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
  border-radius: 16px;
  text-decoration: none;
  color: #4a3f36;
  transition: all 0.3s cubic-bezier(0.2, 0, 0, 1);
  font-weight: 500;
  overflow: hidden;
  backdrop-filter: blur(5px);
}

.nav-item::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(90deg, rgba(200, 160, 120, 0.1), transparent);
  opacity: 0;
  transition: opacity 0.3s;
  pointer-events: none;
  border-radius: inherit;
}

.nav-item:hover::before {
  opacity: 1;
}

.nav-item:hover {
  background: rgba(200, 160, 120, 0.08);
  transform: translateX(6px);
}

.nav-icon {
  transition: transform 0.2s ease, color 0.2s, filter 0.2s;
  z-index: 1;
  color: #6b5a4a;
}

.nav-item:hover .nav-icon {
  transform: scale(1.15);
  color: #c89f72;
  filter: drop-shadow(0 0 6px rgba(200, 159, 114, 0.5));
}

.nav-label {
  transition: opacity 0.2s ease, transform 0.2s ease;
  z-index: 1;
}

.nav-glow {
  position: absolute;
  right: 0;
  width: 6px;
  height: 70%;
  background: linear-gradient(180deg, transparent, #c89f72, transparent);
  border-radius: 3px;
  opacity: 0;
  transition: opacity 0.3s;
}

.nav-item:hover .nav-glow {
  opacity: 0.3;
}

.sidebar.collapsed .nav-label,
.sidebar.collapsed .nav-glow {
  opacity: 0;
  transform: translateX(-10px);
  pointer-events: none;
}

/* ACTIVE STATE – glowing pill */
.nav-item.active {
  background: rgba(200, 160, 120, 0.2);
  color: #c89f72;
  font-weight: 600;
  box-shadow: inset 0 2px 4px rgba(255, 255, 255, 0.8), 0 4px 12px rgba(200, 159, 114, 0.2);
}

.nav-item.active .nav-icon {
  color: #c89f72;
  filter: drop-shadow(0 0 6px currentColor);
}

.nav-item.active .nav-glow {
  opacity: 0.8;
  width: 8px;
  background: linear-gradient(180deg, #ffd7a5, #c89f72, #ffd7a5);
  animation: glowPulse 2s infinite;
}

@keyframes glowPulse {
  0%, 100% { opacity: 0.8; }
  50% { opacity: 1; }
}

/* Center icons when collapsed */
.sidebar.collapsed .nav-item {
  justify-content: center;
  padding: 12px 0;
}

/* FOOTER */
.footer {
  padding: 16px;
  border-top: 1px solid rgba(200, 160, 120, 0.15);
  backdrop-filter: blur(10px);
}

.logout {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 16px;
  border: none;
  background: rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(10px);
  cursor: pointer;
  border-radius: 16px;
  font-family: "Nunito", sans-serif;
  color: #4a3f36;
  font-weight: 500;
  transition: all 0.3s ease;
  border: 1px solid rgba(200, 160, 120, 0.1);
}

.logout:hover {
  background: rgba(255, 255, 255, 0.6);
  transform: scale(1.02);
  color: #c89f72;
  border-color: rgba(200, 160, 120, 0.3);
  box-shadow: 0 4px 12px rgba(200, 159, 114, 0.2);
}

.logout:hover .logout-icon {
  animation: slideRight 0.3s ease;
}

/* ANIMATIONS */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-5px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slideRight {
  0% { transform: translateX(0); }
  50% { transform: translateX(4px); }
  100% { transform: translateX(0); }
}
      `}</style>
    </aside>
  );
}