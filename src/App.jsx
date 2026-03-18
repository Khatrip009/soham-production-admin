import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "./api/supabaseClient";

// Layout
import AdminLayout from "./layouts/AdminLayout";

// Pages
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Categories from "./pages/Categories";
import Users from "./pages/Users";
import Leads from "./pages/Leads";
import Login from "./pages/Login";
import Media from "./pages/Media";
import Inventory from "./pages/Inventory";
import Pages from "./pages/Pages";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import Roles from "./pages/Roles";
import NotFound from "./pages/NotFound";

// Protected Route component
function ProtectedRoute({ children }) {
  const [authenticated, setAuthenticated] = useState(null); // null = loading

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setAuthenticated(!!session);
    };
    checkAuth();

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setAuthenticated(!!session);
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  if (authenticated === null) {
    // Optional: show a loading spinner while checking auth
    return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>Loading...</div>;
  }

  return authenticated ? children : <Navigate to="/login" replace />;
}

function App() {
  return (
    <HashRouter>
      <Routes>
        {/* Public Login Route */}
        <Route path="/login" element={<Login />} />

        {/* Protected Admin Routes (wrapped in AdminLayout) */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          {/* Dashboard */}
          <Route path="dashboard" element={<Dashboard />} />

          {/* Products */}
          <Route path="products" element={<Products />} />

          {/* Categories */}
          <Route path="categories" element={<Categories />} />

          {/* Users */}
          <Route path="users" element={<Users />} />

          {/* Roles */}
          <Route path="roles" element={<Roles />} />

          {/* Leads */}
          <Route path="leads" element={<Leads />} />

          {/* Media */}
          <Route path="media" element={<Media />} />

          {/* Inventory */}
          <Route path="inventory" element={<Inventory />} />

          {/* Pages */}
          <Route path="pages" element={<Pages />} />

          {/* Settings */}
          <Route path="settings" element={<Settings />} />

          {/* Profile */}
          <Route path="profile" element={<Profile />} />

          {/* Default redirect inside admin area */}
          <Route index element={<Navigate to="dashboard" replace />} />
        </Route>

        {/* Catch-all: redirect to login (or dashboard if authenticated?) - we'll redirect to login for simplicity */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </HashRouter>
  );
}

export default App;