import { useEffect, useState, useCallback } from "react";
import { supabase } from "../api/supabaseClient";
import {
  FiEdit,
  FiTrash2,
  FiPlus,
  FiSave,
  FiX,
  FiCheck,
} from "react-icons/fi";
import toast, { Toaster } from "react-hot-toast";
import logo from "../assets/sohom_logo.png";
import "./Products.css"; // reuse styling

// Helper to get current user ID
const getCurrentUserId = async () => {
  const { data } = await supabase.auth.getUser();
  return data.user?.id;
};

export default function Roles() {
  const [activeTab, setActiveTab] = useState("roles"); // "roles" or "permissions"

  // Roles state
  const [roles, setRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [rolesError, setRolesError] = useState(null);

  // Permissions state
  const [permissions, setPermissions] = useState([]);
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const [permissionsError, setPermissionsError] = useState(null);

  // Role-Permissions mapping
  const [rolePermissions, setRolePermissions] = useState({}); // { roleId: [permId1, permId2] }

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null); // for role edit/create
  const [editingPermission, setEditingPermission] = useState(null); // for permission edit/create

  // Fetch all data
  const loadData = useCallback(async () => {
    try {
      setRolesLoading(true);
      setPermissionsLoading(true);

      // Fetch roles
      const { data: rolesData, error: rolesError } = await supabase
        .from("roles")
        .select("*")
        .order("role_name");
      if (rolesError) throw rolesError;
      setRoles(rolesData || []);

      // Fetch permissions
      const { data: permsData, error: permsError } = await supabase
        .from("permissions")
        .select("*")
        .order("permission_key");
      if (permsError) throw permsError;
      setPermissions(permsData || []);

      // Fetch role_permissions
      const { data: rpData, error: rpError } = await supabase
        .from("role_permissions")
        .select("*");
      if (rpError) throw rpError;

      // Build mapping
      const mapping = {};
      rpData.forEach((rp) => {
        if (!mapping[rp.role_id]) mapping[rp.role_id] = [];
        mapping[rp.role_id].push(rp.permission_id);
      });
      setRolePermissions(mapping);
    } catch (err) {
      console.error("Error loading data:", err);
      toast.error("Failed to load data.");
      setRolesError(err.message);
      setPermissionsError(err.message);
    } finally {
      setRolesLoading(false);
      setPermissionsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ---------- ROLE CRUD ----------
  const handleRoleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this role?")) return;
    const toastId = toast.loading("Deleting role...");
    try {
      const userId = await getCurrentUserId();
      const { error } = await supabase.from("roles").delete().eq("id", id);
      if (error) throw error;
      if (userId) {
        await supabase.from("notifications").insert({
          user_id: userId,
          type: "role_deleted",
          title: "Role Deleted",
          message: `Role ID ${id} was deleted.`,
          reference_id: id,
        });
      }
      toast.success("Role deleted", { id: toastId });
      loadData();
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Failed to delete role.", { id: toastId });
    }
  };

  const openRoleModal = (role = null) => {
    setEditingRole(role);
    setIsModalOpen(true);
  };

  // ---------- PERMISSION CRUD ----------
  const handlePermissionDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this permission?")) return;
    const toastId = toast.loading("Deleting permission...");
    try {
      const userId = await getCurrentUserId();
      const { error } = await supabase.from("permissions").delete().eq("id", id);
      if (error) throw error;
      if (userId) {
        await supabase.from("notifications").insert({
          user_id: userId,
          type: "permission_deleted",
          title: "Permission Deleted",
          message: `Permission ID ${id} was deleted.`,
          reference_id: id,
        });
      }
      toast.success("Permission deleted", { id: toastId });
      loadData();
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Failed to delete permission.", { id: toastId });
    }
  };

  const openPermissionModal = (permission = null) => {
    setEditingPermission(permission);
    setIsModalOpen(true);
  };

  // ---------- RENDER ----------
  return (
    <div className="roles" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <Toaster position="top-right" />
      <div className="roles-header">
        <h1 className="roles-title">Roles & Permissions</h1>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === "roles" ? "active" : ""}`}
          onClick={() => setActiveTab("roles")}
        >
          Roles
        </button>
        <button
          className={`tab ${activeTab === "permissions" ? "active" : ""}`}
          onClick={() => setActiveTab("permissions")}
        >
          Permissions
        </button>
      </div>

      {/* Roles Tab */}
      {activeTab === "roles" && (
        <div className="tab-content">
          <div className="section-header">
            <h2>Manage Roles</h2>
            <button className="btn-primary" onClick={() => openRoleModal()}>
              <FiPlus /> Add Role
            </button>
          </div>
          {rolesLoading ? (
            <TableSkeleton />
          ) : rolesError ? (
            <div className="error-message">{rolesError}</div>
          ) : (
            <div className="premium-card table-container">
              <table className="products-table">
                <thead>
                  <tr>
                    <th>Role Name</th>
                    <th>Description</th>
                    <th>Permissions</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((role) => (
                    <tr key={role.id}>
                      <td>{role.role_name}</td>
                      <td>{role.description || "—"}</td>
                      <td>
                        <span className="permission-count">
                          {rolePermissions[role.id]?.length || 0} assigned
                        </span>
                      </td>
                      <td>
                        <button
                          className="icon-btn edit"
                          onClick={() => openRoleModal(role)}
                          aria-label="Edit"
                        >
                          <FiEdit />
                        </button>
                        <button
                          className="icon-btn delete"
                          onClick={() => handleRoleDelete(role.id)}
                          aria-label="Delete"
                        >
                          <FiTrash2 />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {roles.length === 0 && (
                    <tr>
                      <td colSpan="4" className="no-data">
                        No roles found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Permissions Tab */}
      {activeTab === "permissions" && (
        <div className="tab-content">
          <div className="section-header">
            <h2>Manage Permissions</h2>
            <button className="btn-primary" onClick={() => openPermissionModal()}>
              <FiPlus /> Add Permission
            </button>
          </div>
          {permissionsLoading ? (
            <TableSkeleton />
          ) : permissionsError ? (
            <div className="error-message">{permissionsError}</div>
          ) : (
            <div className="premium-card table-container">
              <table className="products-table">
                <thead>
                  <tr>
                    <th>Permission Key</th>
                    <th>Description</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {permissions.map((perm) => (
                    <tr key={perm.id}>
                      <td>{perm.permission_key}</td>
                      <td>{perm.description || "—"}</td>
                      <td>
                        <button
                          className="icon-btn edit"
                          onClick={() => openPermissionModal(perm)}
                          aria-label="Edit"
                        >
                          <FiEdit />
                        </button>
                        <button
                          className="icon-btn delete"
                          onClick={() => handlePermissionDelete(perm.id)}
                          aria-label="Delete"
                        >
                          <FiTrash2 />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {permissions.length === 0 && (
                    <tr>
                      <td colSpan="3" className="no-data">
                        No permissions found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal for Role/ Permission Edit/Create */}
      {isModalOpen && (
        <RolePermissionModal
          type={editingRole ? "role" : editingPermission ? "permission" : "role"} // default to role if none
          role={editingRole}
          permission={editingPermission}
          permissions={permissions}
          rolePermissions={rolePermissions}
          onClose={() => {
            setIsModalOpen(false);
            setEditingRole(null);
            setEditingPermission(null);
          }}
          onSave={loadData}
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

/* Modal for creating/editing role (with permission assignment) or permission */
function RolePermissionModal({
  type,
  role,
  permission,
  permissions,
  rolePermissions,
  onClose,
  onSave,
}) {
  const isRole = type === "role" || !!role; // if editing role, it's role
  const [formData, setFormData] = useState({
    name: role?.role_name || permission?.permission_key || "",
    description: role?.description || permission?.description || "",
  });
  const [selectedPerms, setSelectedPerms] = useState(
    role ? rolePermissions[role.id] || [] : []
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePermissionToggle = (permId) => {
    setSelectedPerms((prev) =>
      prev.includes(permId)
        ? prev.filter((id) => id !== permId)
        : [...prev, permId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    if (!formData.name) {
      setError("Name is required.");
      setSaving(false);
      return;
    }

    const toastId = toast.loading(isRole ? "Saving role..." : "Saving permission...");
    const userId = await getCurrentUserId();

    try {
      if (isRole) {
        // Save role
        let roleResult;
        if (role) {
          // Update
          roleResult = await supabase
            .from("roles")
            .update({
              role_name: formData.name,
              description: formData.description || null,
            })
            .eq("id", role.id)
            .select();
        } else {
          // Insert
          roleResult = await supabase
            .from("roles")
            .insert([{ role_name: formData.name, description: formData.description || null }])
            .select();
        }
        if (roleResult.error) throw roleResult.error;
        const savedRole = roleResult.data[0];

        // Update role_permissions
        // First delete all existing for this role
        const { error: deleteError } = await supabase
          .from("role_permissions")
          .delete()
          .eq("role_id", savedRole.id);
        if (deleteError) throw deleteError;

        // Insert new selected permissions
        if (selectedPerms.length > 0) {
          const inserts = selectedPerms.map((permId) => ({
            role_id: savedRole.id,
            permission_id: permId,
          }));
          const { error: insertError } = await supabase
            .from("role_permissions")
            .insert(inserts);
          if (insertError) throw insertError;
        }

        // Notification
        if (userId) {
          await supabase.from("notifications").insert({
            user_id: userId,
            type: role ? "role_updated" : "role_created",
            title: role ? "Role Updated" : "Role Created",
            message: role
              ? `Role "${savedRole.role_name}" was updated.`
              : `New role "${savedRole.role_name}" was created.`,
            reference_id: savedRole.id,
          });
        }
        toast.success(role ? "Role updated!" : "Role created!", { id: toastId });
      } else {
        // Save permission
        let permResult;
        if (permission) {
          permResult = await supabase
            .from("permissions")
            .update({
              permission_key: formData.name,
              description: formData.description || null,
            })
            .eq("id", permission.id)
            .select();
        } else {
          permResult = await supabase
            .from("permissions")
            .insert([{ permission_key: formData.name, description: formData.description || null }])
            .select();
        }
        if (permResult.error) throw permResult.error;
        const savedPerm = permResult.data[0];

        if (userId) {
          await supabase.from("notifications").insert({
            user_id: userId,
            type: permission ? "permission_updated" : "permission_created",
            title: permission ? "Permission Updated" : "Permission Created",
            message: permission
              ? `Permission "${savedPerm.permission_key}" was updated.`
              : `New permission "${savedPerm.permission_key}" was created.`,
            reference_id: savedPerm.id,
          });
        }
        toast.success(permission ? "Permission updated!" : "Permission created!", { id: toastId });
      }
      onSave();
      onClose();
    } catch (err) {
      console.error("Save error:", err);
      toast.error(err.message || "Failed to save.", { id: toastId });
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <img src={logo} alt="Soham Logo" className="modal-logo" />
          <h2>
            {isRole
              ? role
                ? "Edit Role"
                : "Create Role"
              : permission
              ? "Edit Permission"
              : "Create Permission"}
          </h2>
          <button className="modal-close" onClick={onClose}>
            <FiX />
          </button>
        </div>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label>{isRole ? "Role Name *" : "Permission Key *"}</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group full-width">
              <label>Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows="2"
              />
            </div>
          </div>

          {/* Permission assignment (only for roles) */}
          {isRole && (
            <div className="form-section">
              <h3>Assign Permissions</h3>
              <div className="permissions-grid">
                {permissions.map((perm) => (
                  <label key={perm.id} className="permission-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedPerms.includes(perm.id)}
                      onChange={() => handlePermissionToggle(perm.id)}
                    />
                    <span>
                      <strong>{perm.permission_key}</strong>
                      {perm.description && <small> – {perm.description}</small>}
                    </span>
                  </label>
                ))}
                {permissions.length === 0 && (
                  <p className="no-data">No permissions available. Create some first.</p>
                )}
              </div>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}