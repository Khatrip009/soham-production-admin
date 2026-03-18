import { useEffect, useState, useCallback } from "react";
import { supabase } from "../api/supabaseClient";
import {
  FiEdit,
  FiTrash2,
  FiPlus,
  FiEye,
  FiDownload,
  FiUploadCloud,
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

// Status options
const STATUS_OPTIONS = [
  { value: "draft", label: "Draft", color: "#f39c12" },
  { value: "published", label: "Published", color: "#2ecc71" },
  { value: "archived", label: "Archived", color: "#95a5a6" },
];

export default function Pages() {
  const [pages, setPages] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pagination & filters
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPage, setEditingPage] = useState(null);
  const [previewPage, setPreviewPage] = useState(null); // for preview modal

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch pages
  const fetchPages = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from("pages")
        .select("*", { count: "exact" });

      if (debouncedSearch) {
        query = query.or(
          `title.ilike.%${debouncedSearch}%,content.ilike.%${debouncedSearch}%,seo_title.ilike.%${debouncedSearch}%`
        );
      }
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      query = query.order(sortBy, { ascending: sortOrder === "asc" });

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      setPages(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error("Error fetching pages:", err);
      setError("Failed to load pages. Please try again.");
      toast.error("Failed to load pages.");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, statusFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  // Delete page
  const handleDelete = async (id, title) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) return;

    const toastId = toast.loading("Deleting page...");
    try {
      const userId = await getCurrentUserId();

      const { error } = await supabase.from("pages").delete().eq("id", id);
      if (error) throw error;

      if (userId) {
        await supabase.from("notifications").insert({
          user_id: userId,
          type: "page_deleted",
          title: "Page Deleted",
          message: `Page "${title}" was deleted.`,
          reference_id: id,
        });
      }

      toast.success("Page deleted!", { id: toastId });
      fetchPages();
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Failed to delete page.", { id: toastId });
    }
  };

  // Open modal for editing
  const openEditModal = (page = null) => {
    setEditingPage(page);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingPage(null);
  };

  // Preview modal
  const openPreview = (page) => {
    setPreviewPage(page);
  };

  const closePreview = () => {
    setPreviewPage(null);
  };

  const handleSave = () => {
    fetchPages();
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
    const toastId = toast.loading("Exporting pages...");
    try {
      const { data, error } = await supabase
        .from("pages")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const csvData = data.map((p) => ({
        ID: p.id,
        Title: p.title,
        Slug: p.slug,
        Content: p.content,
        "SEO Title": p.seo_title,
        "SEO Description": p.seo_description,
        Status: p.status,
        "Created At": p.created_at,
        "Updated At": p.updated_at,
      }));

      const csv = Papa.unparse(csvData);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      saveAs(blob, `pages_export_${new Date().toISOString().slice(0, 10)}.csv`);
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

    const toastId = toast.loading("Importing pages...");

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const pagesToInsert = results.data.map((row) => ({
            title: row.Title,
            slug: row.Slug || row.Title.toLowerCase().replace(/\s+/g, "-"),
            content: row.Content,
            seo_title: row["SEO Title"],
            seo_description: row["SEO Description"],
            status: row.Status || "draft",
          }));

          const { error } = await supabase.from("pages").insert(pagesToInsert);
          if (error) throw error;

          const userId = await getCurrentUserId();
          if (userId) {
            await supabase.from("notifications").insert({
              user_id: userId,
              type: "pages_imported",
              title: "Pages Imported",
              message: `${pagesToInsert.length} pages were imported via CSV.`,
            });
          }

          toast.success(`Imported ${pagesToInsert.length} pages!`, { id: toastId });
          fetchPages();
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

  return (
    <div className="pages" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <Toaster position="top-right" />
      {/* Header with actions */}
      <div className="pages-header">
        <h1 className="pages-title">Pages</h1>
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
          <button className="btn-primary" onClick={() => openEditModal()}>
            <FiPlus /> Add Page
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <input
          type="text"
          placeholder="Search by title, content, or SEO title..."
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
      </div>

      {/* Pages Table */}
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
                  <th onClick={() => handleSort("title")} className="sortable">
                    Title {sortBy === "title" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th onClick={() => handleSort("slug")} className="sortable">
                    Slug {sortBy === "slug" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th onClick={() => handleSort("status")} className="sortable">
                    Status {sortBy === "status" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th onClick={() => handleSort("updated_at")} className="sortable">
                    Updated {sortBy === "updated_at" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pages.map((page) => {
                  const status = STATUS_OPTIONS.find((s) => s.value === page.status) || STATUS_OPTIONS[0];
                  return (
                    <tr key={page.id}>
                      <td>{page.title}</td>
                      <td>{page.slug}</td>
                      <td>
                        <span
                          className="status-badge"
                          style={{ backgroundColor: status.color + "20", color: status.color }}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td>{new Date(page.updated_at || page.created_at).toLocaleDateString()}</td>
                      <td>
                        <button
                          className="icon-btn view"
                          onClick={() => openPreview(page)}
                          aria-label="Preview"
                        >
                          <FiEye />
                        </button>
                        <button
                          className="icon-btn edit"
                          onClick={() => openEditModal(page)}
                          aria-label="Edit"
                        >
                          <FiEdit />
                        </button>
                        <button
                          className="icon-btn delete"
                          onClick={() => handleDelete(page.id, page.title)}
                          aria-label="Delete"
                        >
                          <FiTrash2 />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {pages.length === 0 && (
                  <tr>
                    <td colSpan="5" className="no-data">
                      No pages found.
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
        <PageFormModal
          page={editingPage}
          onClose={closeModal}
          onSave={handleSave}
        />
      )}

      {/* Preview Modal */}
      {previewPage && (
        <PreviewModal page={previewPage} onClose={closePreview} />
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

/* Page Form Modal */
function PageFormModal({ page, onClose, onSave }) {
  const [formData, setFormData] = useState({
    title: page?.title || "",
    slug: page?.slug || "",
    content: page?.content || "",
    seo_title: page?.seo_title || "",
    seo_description: page?.seo_description || "",
    status: page?.status || "draft",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Auto‑generate slug from title
  useEffect(() => {
    if (!formData.slug && formData.title) {
      setFormData((prev) => ({
        ...prev,
        slug: formData.title
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, ""),
      }));
    }
  }, [formData.title]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    if (!formData.title) {
      setError("Title is required.");
      setSaving(false);
      return;
    }

    const toastId = toast.loading(page ? "Updating page..." : "Creating page...");

    try {
      const data = {
        title: formData.title,
        slug: formData.slug || formData.title.toLowerCase().replace(/\s+/g, "-"),
        content: formData.content || null,
        seo_title: formData.seo_title || null,
        seo_description: formData.seo_description || null,
        status: formData.status,
      };

      let result;
      if (page) {
        result = await supabase
          .from("pages")
          .update(data)
          .eq("id", page.id)
          .select();
      } else {
        result = await supabase.from("pages").insert([data]).select();
      }
      if (result.error) throw result.error;

      const savedPage = result.data[0];
      const userId = await getCurrentUserId();

      if (userId) {
        await supabase.from("notifications").insert({
          user_id: userId,
          type: page ? "page_updated" : "page_created",
          title: page ? "Page Updated" : "Page Created",
          message: page
            ? `Page "${savedPage.title}" was updated.`
            : `New page "${savedPage.title}" was created.`,
          reference_id: savedPage.id,
        });
      }

      toast.success(page ? "Page updated!" : "Page created!", { id: toastId });
      onSave();
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Failed to save page.", { id: toastId });
      setError(err.message || "Failed to save page.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <img src={logo} alt="Soham Logo" className="modal-logo" />
          <h2>{page ? "Edit Page" : "Create New Page"}</h2>
          <button className="modal-close" onClick={onClose}>
            <FiX />
          </button>
        </div>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label>Title *</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Slug</label>
              <input
                type="text"
                name="slug"
                value={formData.slug}
                onChange={handleChange}
              />
            </div>
            <div className="form-group full-width">
              <label>Content</label>
              <textarea
                name="content"
                value={formData.content}
                onChange={handleChange}
                rows="6"
                placeholder="Page content (HTML or plain text)"
              />
            </div>
            <div className="form-group">
              <label>SEO Title</label>
              <input
                type="text"
                name="seo_title"
                value={formData.seo_title}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>SEO Description</label>
              <input
                type="text"
                name="seo_description"
                value={formData.seo_description}
                onChange={handleChange}
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
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Save Page"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* Preview Modal */
function PreviewModal({ page, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content preview-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <img src={logo} alt="Soham Logo" className="modal-logo" />
          <h2>Preview: {page.title}</h2>
          <button className="modal-close" onClick={onClose}>
            <FiX />
          </button>
        </div>
        <div className="preview-content">
          <h1>{page.title}</h1>
          <div className="preview-meta">
            <span>Slug: {page.slug}</span>
            <span>Status: {page.status}</span>
          </div>
          <hr />
          <div className="preview-body">
            {page.content ? (
              <div dangerouslySetInnerHTML={{ __html: page.content.replace(/\n/g, "<br>") }} />
            ) : (
              <p className="no-content">No content.</p>
            )}
          </div>
          <hr />
          <div className="preview-seo">
            <h3>SEO</h3>
            <p><strong>Title:</strong> {page.seo_title || "—"}</p>
            <p><strong>Description:</strong> {page.seo_description || "—"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}