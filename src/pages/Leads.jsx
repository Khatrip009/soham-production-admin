import { useEffect, useState, useCallback } from "react";
import { supabase } from "../api/supabaseClient";
import {
  FiEdit,
  FiTrash2,
  FiPlus,
  FiDownload,
  FiUploadCloud,
  FiCheck,
  FiX,
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

// Status options with colors (for badge)
const STATUS_OPTIONS = [
  { value: "new", label: "New", color: "#3498db" },
  { value: "contacted", label: "Contacted", color: "#f39c12" },
  { value: "qualified", label: "Qualified", color: "#2ecc71" },
  { value: "negotiation", label: "Negotiation", color: "#9b59b6" },
  { value: "won", label: "Won", color: "#27ae60" },
  { value: "lost", label: "Lost", color: "#e74c3c" },
];

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [users, setUsers] = useState([]); // for assigned_to dropdown
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pagination & filters
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState(null);

  // For inline status update
  const [updatingStatusId, setUpdatingStatusId] = useState(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch users for assignment dropdown
  useEffect(() => {
    const fetchUsers = async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, email")
        .order("email");
      if (!error) setUsers(data || []);
    };
    fetchUsers();
  }, []);

  // Fetch leads
  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from("leads")
        .select(
          `
          *,
          assigned:assigned_to ( email )
        `,
          { count: "exact" }
        );

      if (debouncedSearch) {
        query = query.or(
          `name.ilike.%${debouncedSearch}%,email.ilike.%${debouncedSearch}%,phone.ilike.%${debouncedSearch}%,message.ilike.%${debouncedSearch}%`
        );
      }
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      if (sourceFilter !== "all") {
        query = query.eq("source", sourceFilter);
      }
      query = query.order(sortBy, { ascending: sortOrder === "asc" });

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      setLeads(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error("Error fetching leads:", err);
      setError("Failed to load leads. Please try again.");
      toast.error("Failed to load leads.");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, statusFilter, sourceFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Update lead status inline
  const handleStatusChange = async (leadId, newStatus) => {
    setUpdatingStatusId(leadId);
    const toastId = toast.loading("Updating status...");
    try {
      const userId = await getCurrentUserId();

      const { error } = await supabase
        .from("leads")
        .update({ status: newStatus })
        .eq("id", leadId);
      if (error) throw error;

      // Insert notification
      if (userId) {
        await supabase.from("notifications").insert({
          user_id: userId,
          type: "lead_status_updated",
          title: "Lead Status Updated",
          message: `Lead ID ${leadId} status changed to ${newStatus}.`,
          reference_id: leadId,
        });
      }

      toast.success("Status updated!", { id: toastId });
      fetchLeads(); // refresh
    } catch (err) {
      console.error("Status update error:", err);
      toast.error("Failed to update status.", { id: toastId });
    } finally {
      setUpdatingStatusId(null);
    }
  };

  // Delete lead
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this lead?")) return;

    const toastId = toast.loading("Deleting lead...");
    try {
      const userId = await getCurrentUserId();

      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) throw error;

      if (userId) {
        await supabase.from("notifications").insert({
          user_id: userId,
          type: "lead_deleted",
          title: "Lead Deleted",
          message: `Lead with ID ${id} was deleted.`,
          reference_id: id,
        });
      }

      toast.success("Lead deleted successfully!", { id: toastId });
      fetchLeads();
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Failed to delete lead.", { id: toastId });
    }
  };

  // Open modal
  const openModal = (lead = null) => {
    setEditingLead(lead);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingLead(null);
  };

  const handleSave = () => {
    fetchLeads();
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
    const toastId = toast.loading("Exporting leads...");
    try {
      const { data, error } = await supabase
        .from("leads")
        .select(`
          *,
          assigned:assigned_to ( email )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const csvData = data.map((l) => ({
        ID: l.id,
        Name: l.name,
        Email: l.email,
        Phone: l.phone,
        Message: l.message,
        Source: l.source,
        Status: l.status,
        Assigned: l.assigned?.email || "",
        "Created At": l.created_at,
      }));

      const csv = Papa.unparse(csvData);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      saveAs(blob, `leads_export_${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success("Export successful!", { id: toastId });
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Export failed.", { id: toastId });
    }
  };

  // Import from CSV
  const importFromCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const toastId = toast.loading("Importing leads...");

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const leadsToInsert = results.data.map((row) => ({
            name: row.Name,
            email: row.Email,
            phone: row.Phone,
            message: row.Message,
            source: row.Source,
            status: row.Status || "new",
            assigned_to: null, // can't map by email easily; leave unassigned
          }));

          const { error } = await supabase.from("leads").insert(leadsToInsert);
          if (error) throw error;

          const userId = await getCurrentUserId();
          if (userId) {
            await supabase.from("notifications").insert({
              user_id: userId,
              type: "leads_imported",
              title: "Leads Imported",
              message: `${leadsToInsert.length} leads were imported via CSV.`,
            });
          }

          toast.success(`Imported ${leadsToInsert.length} leads!`, { id: toastId });
          fetchLeads();
        } catch (err) {
          console.error("Import error:", err);
          toast.error("Import failed. Check console.", { id: toastId });
        }
      },
      error: (err) => {
        console.error("CSV parsing error:", err);
        toast.error("CSV parsing failed.", { id: toastId });
      },
    });
    e.target.value = null;
  };

  // Get unique sources for filter
  const uniqueSources = [...new Set(leads.map((l) => l.source).filter(Boolean))];

  return (
    <div className="leads" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <Toaster position="top-right" />
      {/* Header with actions */}
      <div className="leads-header">
        <h1 className="leads-title">Leads</h1>
        <div className="header-actions">
          <button className="btn-secondary" onClick={exportToCSV}>
            <FiDownload /> Export CSV
          </button>
          <label className="btn-secondary">
            <FiUploadCloud /> Import CSV
            <input
              type="file"
              accept=".csv"
              style={{ display: "none" }}
              onChange={importFromCSV}
            />
          </label>
          <button className="btn-primary" onClick={() => openModal()}>
            <FiPlus /> Add Lead
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <input
          type="text"
          placeholder="Search leads..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="filter-select"
        >
          <option value="all">All Status</option>
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="filter-select"
        >
          <option value="all">All Sources</option>
          {uniqueSources.map((src) => (
            <option key={src} value={src}>
              {src}
            </option>
          ))}
        </select>
      </div>

      {/* Leads Table */}
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
                  <th onClick={() => handleSort("name")} className="sortable">
                    Name {sortBy === "name" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th onClick={() => handleSort("email")} className="sortable">
                    Email {sortBy === "email" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th onClick={() => handleSort("phone")} className="sortable">
                    Phone {sortBy === "phone" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th onClick={() => handleSort("source")} className="sortable">
                    Source {sortBy === "source" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th onClick={() => handleSort("status")} className="sortable">
                    Status {sortBy === "status" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th onClick={() => handleSort("assigned_to")} className="sortable">
                    Assigned To {sortBy === "assigned_to" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th onClick={() => handleSort("created_at")} className="sortable">
                    Created At {sortBy === "created_at" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => {
                  const statusOption = STATUS_OPTIONS.find((opt) => opt.value === lead.status) || STATUS_OPTIONS[0];
                  return (
                    <tr key={lead.id}>
                      <td>{lead.name}</td>
                      <td>{lead.email}</td>
                      <td>{lead.phone}</td>
                      <td>{lead.source || "—"}</td>
                      <td>
                        {updatingStatusId === lead.id ? (
                          <span className="status-updating">Updating...</span>
                        ) : (
                          <select
                            value={lead.status}
                            onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                            className="status-select"
                            style={{
                              backgroundColor: statusOption.color,
                              color: "#fff",
                              border: "none",
                              borderRadius: "20px",
                              padding: "4px 10px",
                              fontSize: "0.85rem",
                              fontWeight: 600,
                            }}
                          >
                            {STATUS_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td>{lead.assigned?.email || "—"}</td>
                      <td>{new Date(lead.created_at).toLocaleDateString()}</td>
                      <td>
                        <button
                          className="icon-btn edit"
                          onClick={() => openModal(lead)}
                          aria-label="Edit"
                        >
                          <FiEdit />
                        </button>
                        <button
                          className="icon-btn delete"
                          onClick={() => handleDelete(lead.id)}
                          aria-label="Delete"
                        >
                          <FiTrash2 />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {leads.length === 0 && (
                  <tr>
                    <td colSpan="8" className="no-data">
                      No leads found.
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

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <LeadFormModal
          lead={editingLead}
          users={users}
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

/* Lead Form Modal */
function LeadFormModal({ lead, users, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: lead?.name || "",
    email: lead?.email || "",
    phone: lead?.phone || "",
    message: lead?.message || "",
    source: lead?.source || "",
    status: lead?.status || "new",
    assigned_to: lead?.assigned_to || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    const toastId = toast.loading(lead ? "Updating lead..." : "Creating lead...");

    try {
      const data = {
        ...formData,
        assigned_to: formData.assigned_to || null,
      };

      let result;
      if (lead) {
        result = await supabase
          .from("leads")
          .update(data)
          .eq("id", lead.id)
          .select();
      } else {
        result = await supabase.from("leads").insert([data]).select();
      }
      if (result.error) throw result.error;

      const savedLead = result.data[0];
      const userId = await getCurrentUserId();

      if (userId) {
        await supabase.from("notifications").insert({
          user_id: userId,
          type: lead ? "lead_updated" : "lead_created",
          title: lead ? "Lead Updated" : "Lead Created",
          message: lead
            ? `Lead "${savedLead.name}" was updated.`
            : `New lead "${savedLead.name}" was created.`,
          reference_id: savedLead.id,
        });
      }

      toast.success(lead ? "Lead updated!" : "Lead created!", { id: toastId });
      onSave();
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Failed to save lead.", { id: toastId });
      setError(err.message || "Failed to save lead.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <img src={logo} alt="Soham Logo" className="modal-logo" />
          <h2>{lead ? "Edit Lead" : "Add Lead"}</h2>
        </div>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
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
              <label>Source</label>
              <input
                type="text"
                name="source"
                value={formData.source}
                onChange={handleChange}
                placeholder="e.g., Website, Referral"
              />
            </div>
            <div className="form-group full-width">
              <label>Message</label>
              <textarea
                name="message"
                value={formData.message}
                onChange={handleChange}
                rows="3"
              />
            </div>
            <div className="form-group">
              <label>Status</label>
              <select name="status" value={formData.status} onChange={handleChange}>
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Assign To</label>
              <select name="assigned_to" value={formData.assigned_to} onChange={handleChange}>
                <option value="">— Unassigned —</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.email}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Save Lead"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}