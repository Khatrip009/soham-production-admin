import { useEffect, useState, useCallback } from "react";
import { supabase } from "../api/supabaseClient";
import {
  FiEdit,
  FiTrash2,
  FiDownload,
  FiToggleLeft,
  FiToggleRight,
} from "react-icons/fi";
import Papa from "papaparse";
import { saveAs } from "file-saver";
import toast, { Toaster } from "react-hot-toast";
import logo from "../assets/sohom_logo.png";
import "./Products.css"; // reuse styling

// Helper to get current user ID
const getCurrentUserId = async () => {
  const { data } = await supabase.auth.getUser();
  return data.user?.id;
};

export default function Users() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pagination & filters
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch roles for filter and dropdown (using correct column name: role_name)
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const { data, error } = await supabase
          .from("roles")
          .select("id, role_name")
          .order("role_name", { ascending: true });
        if (error) throw error;
        setRoles(data || []);
      } catch (err) {
        console.error("Error fetching roles:", err);
        // If roles table doesn't exist or has no data, set empty array
        setRoles([]);
      }
    };
    fetchRoles();
  }, []);

  // Fetch users with role info using explicit foreign key join
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from("users")
        .select(
          `
          *,
          role:roles!users_role_id_fkey ( role_name )
        `,
          { count: "exact" }
        );

      if (debouncedSearch) {
        query = query.or(
          `email.ilike.%${debouncedSearch}%,full_name.ilike.%${debouncedSearch}%,phone.ilike.%${debouncedSearch}%`
        );
      }
      if (roleFilter !== "all") {
        query = query.eq("role_id", roleFilter);
      }
      if (statusFilter !== "all") {
        query = query.eq("is_active", statusFilter === "active");
      }
      query = query.order(sortBy, { ascending: sortOrder === "asc" });

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      setUsers(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error("Error fetching users:", err);
      setError("Failed to load users. Please try again.");
      toast.error("Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, roleFilter, statusFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Toggle user active status
  const handleToggleActive = async (user) => {
    const newStatus = !user.is_active;
    const toastId = toast.loading(`Updating status...`);
    try {
      const userId = await getCurrentUserId();

      const { error } = await supabase
        .from("users")
        .update({ is_active: newStatus })
        .eq("id", user.id);
      if (error) throw error;

      if (userId) {
        await supabase.from("notifications").insert({
          user_id: userId,
          type: "user_status_updated",
          title: "User Status Updated",
          message: `User ${user.email} is now ${newStatus ? "active" : "inactive"}.`,
          reference_id: user.id,
        });
      }

      toast.success(`User ${newStatus ? "activated" : "deactivated"}!`, { id: toastId });
      fetchUsers();
    } catch (err) {
      console.error("Toggle error:", err);
      toast.error("Failed to update status.", { id: toastId });
    }
  };

  // Delete user (hard delete from public.users; may cascade to auth)
  const handleDelete = async (id, email) => {
    if (!window.confirm(`Are you sure you want to delete user ${email}? This will also remove their auth account.`)) return;

    const toastId = toast.loading("Deleting user...");
    try {
      const userId = await getCurrentUserId();

      const { error } = await supabase.from("users").delete().eq("id", id);
      if (error) throw error;

      if (userId) {
        await supabase.from("notifications").insert({
          user_id: userId,
          type: "user_deleted",
          title: "User Deleted",
          message: `User ${email} was deleted.`,
          reference_id: id,
        });
      }

      toast.success("User deleted!", { id: toastId });
      fetchUsers();
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Failed to delete user.", { id: toastId });
    }
  };

  // Open modal for editing
  const openEditModal = (user) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
  };

  const handleSave = () => {
    fetchUsers();
    closeModal();
  };

  // Sorting handler
  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  // Export to CSV
  const exportToCSV = async () => {
    const toastId = toast.loading("Exporting users...");
    try {
      const { data, error } = await supabase
        .from("users")
        .select(`
          *,
          role:roles!users_role_id_fkey ( role_name )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const csvData = data.map((u) => ({
        ID: u.id,
        Email: u.email,
        "Full Name": u.full_name,
        Phone: u.phone,
        Role: u.role?.role_name,
        Active: u.is_active ? "Yes" : "No",
        "Created At": u.created_at,
      }));

      const csv = Papa.unparse(csvData);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      saveAs(blob, `users_export_${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success("Export successful!", { id: toastId });
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Export failed.", { id: toastId });
    }
  };

  return (
    <div className="users" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <Toaster position="top-right" />
      {/* Header with actions */}
      <div className="users-header">
        <h1 className="users-title">User Management</h1>
        <div className="header-actions">
          <button className="btn-secondary" onClick={exportToCSV}>
            <FiDownload /> Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <input
          type="text"
          placeholder="Search by email, name, or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="filter-select"
        >
          <option value="all">All Roles</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.role_name}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="filter-select"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="premium-card table-container">
        {loading ? (
          <TableSkeleton />
        ) : error ? (
          <div className="error-message">{error}</div>
        ) : (
          <>
            <table className="products-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort("email")} className="sortable">
                    Email {sortBy === "email" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th onClick={() => handleSort("full_name")} className="sortable">
                    Full Name {sortBy === "full_name" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th onClick={() => handleSort("phone")} className="sortable">
                    Phone {sortBy === "phone" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th onClick={() => handleSort("role_id")} className="sortable">
                    Role {sortBy === "role_id" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th onClick={() => handleSort("is_active")} className="sortable">
                    Status {sortBy === "is_active" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th onClick={() => handleSort("created_at")} className="sortable">
                    Created At {sortBy === "created_at" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.email}</td>
                    <td>{user.full_name || "—"}</td>
                    <td>{user.phone || "—"}</td>
                    <td>
                      <span className="role-badge">
                        {user.role?.role_name || "—"}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${user.is_active ? "active" : "inactive"}`}>
                        {user.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>{new Date(user.created_at).toLocaleDateString()}</td>
                    <td>
                      <button
                        className="icon-btn edit"
                        onClick={() => openEditModal(user)}
                        aria-label="Edit user"
                      >
                        <FiEdit />
                      </button>
                      <button
                        className="icon-btn toggle"
                        onClick={() => handleToggleActive(user)}
                        aria-label="Toggle active status"
                      >
                        {user.is_active ? <FiToggleRight /> : <FiToggleLeft />}
                      </button>
                      <button
                        className="icon-btn delete"
                        onClick={() => handleDelete(user.id, user.email)}
                        aria-label="Delete user"
                      >
                        <FiTrash2 />
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan="7" className="no-data">
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </button>
                <span>
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Edit User Modal */}
      {isModalOpen && (
        <UserFormModal
          user={editingUser}
          roles={roles}
          onClose={closeModal}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

/* Table Skeleton */
function TableSkeleton() {
  return (
    <div className="skeleton-table">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="skeleton-row" />
      ))}
    </div>
  );
}

/* User Form Modal (for editing) */
function UserFormModal({ user, roles, onClose, onSave }) {
  const [formData, setFormData] = useState({
    full_name: user?.full_name || "",
    phone: user?.phone || "",
    role_id: user?.role_id || "",
    is_active: user?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    const toastId = toast.loading("Updating user...");
    try {
      const userId = await getCurrentUserId();

      const { error } = await supabase
        .from("users")
        .update({
          full_name: formData.full_name || null,
          phone: formData.phone || null,
          role_id: formData.role_id || null,
          is_active: formData.is_active,
        })
        .eq("id", user.id);
      if (error) throw error;

      if (userId) {
        await supabase.from("notifications").insert({
          user_id: userId,
          type: "user_updated",
          title: "User Updated",
          message: `User ${user.email} was updated.`,
          reference_id: user.id,
        });
      }

      toast.success("User updated!", { id: toastId });
      onSave();
    } catch (err) {
      console.error("Update error:", err);
      toast.error("Failed to update user.", { id: toastId });
      setError(err.message || "Failed to update user.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <img src={logo} alt="Soham Logo" className="modal-logo" />
          <h2>Edit User: {user.email}</h2>
        </div>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>Role</label>
              <select
                name="role_id"
                value={formData.role_id}
                onChange={handleChange}
              >
                <option value="">— Select Role —</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.role_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group checkbox">
              <label>
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleChange}
                />
                Active
              </label>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}