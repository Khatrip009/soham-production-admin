import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="admin-layout">
      {/* SIDEBAR */}
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />

      {/* MAIN AREA */}
      <div className="main-area">
        <Header />

        <main className="page-content">
          <div className="content-wrapper">
            <Outlet />
          </div>
        </main>
      </div>

      {/* STYLES */}
      <style>{`

/* =========================
   ADMIN LAYOUT (CORE)
========================= */

.admin-layout {
  display: flex;
  height: 100vh;
  background: var(--bg-main);
  overflow: hidden; /* Prevents any global scroll */
}

/* =========================
   MAIN AREA
========================= */

.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden; /* CRITICAL: Keeps everything inside */
  min-width: 0; /* 🔥 VERY IMPORTANT – allows shrinking */
  width: 100%; /* Ensures it takes remaining space */
}

/* =========================
   PAGE CONTENT
========================= */

.page-content {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
  min-width: 0; /* 🔥 CRITICAL */
  width: 100%;
}

/* =========================
   CONTENT WRAPPER (CARD)
========================= */

.content-wrapper {
  max-width: 1400px;
  margin: 0 auto;
  min-width: 0; /* 🔥 MOST IMPORTANT – prevents overflow */
  width: 100%;
  padding: 0; /* Ensures no extra spacing */
}

/* =========================
   RESPONSIVE
========================= */

@media (max-width: 768px) {
  .page-content {
    padding: 16px;
  }
}

@media (max-width: 480px) {
  .page-content {
    padding: 12px;
  }
}

      `}</style>
    </div>
  );
}