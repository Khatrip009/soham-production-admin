import { useEffect, useState, useCallback } from "react";
import { supabase } from "../api/supabaseClient";
import {
  FiTrash2,
  FiUpload,
  FiEdit,
  FiDownload,
  FiX,
} from "react-icons/fi";
import toast, { Toaster } from "react-hot-toast";
import logo from "../assets/sohom_logo.png";
import "./Products.css"; // reuse styling

// Helper to get public URL for an image stored in the "Soham" bucket
const getImageUrl = (path) => {
  if (!path) return "";
  const { data } = supabase.storage.from("Soham").getPublicUrl(path);
  return data.publicUrl;
};

// Helper to get current user ID
const getCurrentUserId = async () => {
  const { data } = await supabase.auth.getUser();
  return data.user?.id;
};

// Entity types (can be extended)
const ENTITY_TYPES = [
  { value: "product", label: "Product" },
  { value: "category", label: "Category" },
  { value: "global", label: "Global" },
];

export default function Media() {
  const [media, setMedia] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pagination & filters
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMedia, setEditingMedia] = useState(null); // for editing alt text

  // For uploading
  const [uploading, setUploading] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch media assets
  const fetchMedia = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from("media_assets")
        .select("*", { count: "exact" });

      if (debouncedSearch) {
        query = query.or(`file_name.ilike.%${debouncedSearch}%,alt_text.ilike.%${debouncedSearch}%`);
      }
      if (entityFilter !== "all") {
        query = query.eq("entity_type", entityFilter);
      }
      query = query.order(sortBy, { ascending: sortOrder === "asc" });

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      setMedia(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error("Error fetching media:", err);
      setError("Failed to load media. Please try again.");
      toast.error("Failed to load media.");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, entityFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  // Delete media
  const handleDelete = async (item) => {
    if (!window.confirm("Are you sure you want to delete this media?")) return;

    const toastId = toast.loading("Deleting media...");
    try {
      const userId = await getCurrentUserId();

      // Delete from storage first
      const { error: storageError } = await supabase.storage
        .from("Soham")
        .remove([item.file_path]);
      if (storageError) throw storageError;

      // Delete from database
      const { error } = await supabase
        .from("media_assets")
        .delete()
        .eq("id", item.id);
      if (error) throw error;

      if (userId) {
        await supabase.from("notifications").insert({
          user_id: userId,
          type: "media_deleted",
          title: "Media Deleted",
          message: `Media "${item.file_name || item.id}" was deleted.`,
          reference_id: item.id,
        });
      }

      toast.success("Media deleted successfully!", { id: toastId });
      fetchMedia();
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Failed to delete media.", { id: toastId });
    }
  };

  // Open edit modal (for alt text)
  const openEditModal = (item) => {
    setEditingMedia(item);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingMedia(null);
  };

  const handleSave = () => {
    fetchMedia();
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

  // Handle file upload
  const handleUpload = async (file, entityType, entityId, altText, sortOrder) => {
    setUploading(true);
    const toastId = toast.loading("Uploading...");
    try {
      const userId = await getCurrentUserId();

      // Generate unique file path
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `media/${entityType}/${entityId}/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("Soham")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      // Insert into media_assets
      const { error: dbError } = await supabase.from("media_assets").insert({
        file_name: file.name,
        file_path: filePath,
        file_type: file.type,
        mime_type: file.type,
        file_size: file.size,
        entity_type: entityType,
        entity_id: entityId,
        alt_text: altText,
        sort_order: sortOrder || 1,
        uploaded_by: userId,
        media_type: file.type.startsWith("image/") ? "image" : "document",
      });
      if (dbError) throw dbError;

      if (userId) {
        await supabase.from("notifications").insert({
          user_id: userId,
          type: "media_uploaded",
          title: "Media Uploaded",
          message: `File "${file.name}" was uploaded.`,
        });
      }

      toast.success("Upload successful!", { id: toastId });
      fetchMedia();
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("Upload failed.", { id: toastId });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="media" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <Toaster position="top-right" />
      {/* Header with actions */}
      <div className="media-header">
        <h1 className="media-title">Media Library</h1>
        <div className="header-actions">
          <button className="btn-primary" onClick={() => openEditModal(null)}>
            <FiUpload /> Upload Media
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <input
          type="text"
          placeholder="Search by file name or alt text..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="filter-select"
        >
          <option value="all">All Entity Types</option>
          {ENTITY_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      {/* Media Table */}
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
                  <th>Preview</th>
                  <th onClick={() => handleSort("file_name")} className="sortable">
                    File Name {sortBy === "file_name" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th onClick={() => handleSort("entity_type")} className="sortable">
                    Entity Type {sortBy === "entity_type" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th onClick={() => handleSort("entity_id")} className="sortable">
                    Entity ID {sortBy === "entity_id" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th onClick={() => handleSort("alt_text")} className="sortable">
                    Alt Text {sortBy === "alt_text" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th onClick={() => handleSort("file_size")} className="sortable">
                    Size {sortBy === "file_size" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th onClick={() => handleSort("created_at")} className="sortable">
                    Uploaded {sortBy === "created_at" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {media.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.media_type === "image" ? (
                        <img
                          src={getImageUrl(item.file_path)}
                          alt={item.alt_text || item.file_name}
                          className="media-thumb"
                          onError={(e) => {
                            e.target.style.display = "none";
                          }}
                        />
                      ) : (
                        <span className="file-icon">📄</span>
                      )}
                    </td>
                    <td>{item.file_name}</td>
                    <td>{item.entity_type}</td>
                    <td className="entity-id">{item.entity_id.substring(0, 8)}…</td>
                    <td>{item.alt_text || "—"}</td>
                    <td>{item.file_size ? (item.file_size / 1024).toFixed(1) + " KB" : "—"}</td>
                    <td>{new Date(item.created_at).toLocaleDateString()}</td>
                    <td>
                      <button
                        className="icon-btn edit"
                        onClick={() => openEditModal(item)}
                        aria-label="Edit alt text"
                      >
                        <FiEdit />
                      </button>
                      <button
                        className="icon-btn delete"
                        onClick={() => handleDelete(item)}
                        aria-label="Delete"
                      >
                        <FiTrash2 />
                      </button>
                    </td>
                  </tr>
                ))}
                {media.length === 0 && (
                  <tr>
                    <td colSpan="8" className="no-data">
                      No media found.
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

      {/* Upload/Edit Modal */}
      {isModalOpen && (
        <MediaFormModal
          media={editingMedia}
          onClose={closeModal}
          onSave={handleSave}
          onUpload={handleUpload}
          uploading={uploading}
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

/* Media Form Modal (for upload and alt text edit) */
function MediaFormModal({ media, onClose, onSave, onUpload, uploading }) {
  const [formData, setFormData] = useState({
    file: null,
    entity_type: media?.entity_type || "product",
    entity_id: media?.entity_id || "",
    alt_text: media?.alt_text || "",
    sort_order: media?.sort_order || 1,
  });
  const [entities, setEntities] = useState([]); // for dropdown based on entity_type
  const [loadingEntities, setLoadingEntities] = useState(false);
  const [error, setError] = useState("");

  // Fetch entities when entity_type changes (for dropdown)
  useEffect(() => {
    const fetchEntities = async () => {
      if (!formData.entity_type || formData.entity_type === "global") {
        setEntities([]);
        return;
      }
      setLoadingEntities(true);
      let table = formData.entity_type === "product" ? "products" : "categories";
      const { data, error } = await supabase
        .from(table)
        .select("id, name")
        .order("name");
      if (!error) setEntities(data || []);
      else console.error("Error fetching entities:", error);
      setLoadingEntities(false);
    };
    fetchEntities();
  }, [formData.entity_type]);

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "file") {
      setFormData((prev) => ({ ...prev, file: files[0] }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (media) {
      // Editing alt text only
      const toastId = toast.loading("Updating alt text...");
      try {
        const { error } = await supabase
          .from("media_assets")
          .update({ alt_text: formData.alt_text })
          .eq("id", media.id);
        if (error) throw error;
        toast.success("Alt text updated!", { id: toastId });
        onSave();
      } catch (err) {
        console.error("Update error:", err);
        toast.error("Update failed.", { id: toastId });
        setError(err.message);
      }
    } else {
      // Upload new file
      if (!formData.file) {
        setError("Please select a file.");
        return;
      }
      if (!formData.entity_id && formData.entity_type !== "global") {
        setError("Please select an entity.");
        return;
      }
      const entityId = formData.entity_type === "global" ? "00000000-0000-0000-0000-000000000000" : formData.entity_id;
      await onUpload(
        formData.file,
        formData.entity_type,
        entityId,
        formData.alt_text,
        formData.sort_order
      );
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <img src={logo} alt="Soham Logo" className="modal-logo" />
          <h2>{media ? "Edit Alt Text" : "Upload Media"}</h2>
          <button className="modal-close" onClick={onClose}>
            <FiX />
          </button>
        </div>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          {!media && (
            <>
              <div className="form-group">
                <label>File *</label>
                <input
                  type="file"
                  name="file"
                  onChange={handleChange}
                  required
                  accept="image/*,video/*,application/pdf"
                />
              </div>
              <div className="form-group">
                <label>Entity Type</label>
                <select
                  name="entity_type"
                  value={formData.entity_type}
                  onChange={handleChange}
                  required
                >
                  {ENTITY_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              {formData.entity_type !== "global" && (
                <div className="form-group">
                  <label>{formData.entity_type === "product" ? "Product" : "Category"}</label>
                  {loadingEntities ? (
                    <div>Loading...</div>
                  ) : (
                    <select
                      name="entity_id"
                      value={formData.entity_id}
                      onChange={handleChange}
                      required
                    >
                      <option value="">— Select —</option>
                      {entities.map((ent) => (
                        <option key={ent.id} value={ent.id}>
                          {ent.name} ({ent.id.substring(0, 8)})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
              <div className="form-group">
                <label>Sort Order</label>
                <input
                  type="number"
                  name="sort_order"
                  value={formData.sort_order}
                  onChange={handleChange}
                  min="1"
                />
              </div>
            </>
          )}
          <div className="form-group full-width">
            <label>Alt Text</label>
            <textarea
              name="alt_text"
              value={formData.alt_text}
              onChange={handleChange}
              rows="2"
              placeholder="Description for accessibility"
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={uploading || loadingEntities}
            >
              {uploading ? "Uploading..." : media ? "Save" : "Upload"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}