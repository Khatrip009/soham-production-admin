import { useEffect, useState, useCallback } from "react";
import { supabase } from "../api/supabaseClient";
import {
  FiEdit,
  FiTrash2,
  FiPlus,
  FiDownload,
  FiUploadCloud,
  FiUpload,
  FiX,
} from "react-icons/fi";
import Papa from "papaparse";
import { saveAs } from "file-saver";
import toast, { Toaster } from "react-hot-toast";
import logo from "../assets/sohom_logo.png";
import "./Products.css"; // Reuse the same styles as Products

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

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pagination & filters
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch categories with parent relation
  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from("categories")
        .select(
          `
          *,
          parent:parent_id ( id, name )
        `,
          { count: "exact" }
        );

      if (debouncedSearch) {
        query = query.or(`name.ilike.%${debouncedSearch}%,description.ilike.%${debouncedSearch}%`);
      }
      query = query.order(sortBy, { ascending: sortOrder === "asc" });

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      setCategories(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error("Error fetching categories:", err);
      setError("Failed to load categories. Please try again.");
      toast.error("Failed to load categories.");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, sortBy, sortOrder]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Delete category
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this category?")) return;

    const toastId = toast.loading("Deleting category...");
    try {
      const userId = await getCurrentUserId();

      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;

      if (userId) {
        await supabase.from("notifications").insert({
          user_id: userId,
          type: "category_deleted",
          title: "Category Deleted",
          message: `Category with ID ${id} was deleted.`,
          reference_id: id,
        });
      }

      toast.success("Category deleted successfully!", { id: toastId });
      fetchCategories();
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Failed to delete category.", { id: toastId });
    }
  };

  // Open modal
  const openModal = (category = null) => {
    setEditingCategory(category);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCategory(null);
  };

  const handleSave = () => {
    fetchCategories();
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
    const toastId = toast.loading("Exporting categories...");
    try {
      const { data, error } = await supabase
        .from("categories")
        .select(`
          *,
          parent:parent_id ( name )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const csvData = data.map((c) => ({
        ID: c.id,
        Name: c.name,
        Slug: c.slug,
        Description: c.description,
        "Parent Category": c.parent?.name || "",
        "Created At": c.created_at,
      }));

      const csv = Papa.unparse(csvData);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      saveAs(blob, `categories_export_${new Date().toISOString().slice(0, 10)}.csv`);
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

    const toastId = toast.loading("Importing categories...");

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          // First, fetch existing categories to map parent names to IDs
          const { data: existingCats } = await supabase
            .from("categories")
            .select("id, name");
          const nameToId = Object.fromEntries(
            existingCats.map((c) => [c.name.toLowerCase(), c.id])
          );

          const categoriesToInsert = results.data.map((row) => ({
            name: row.Name,
            slug: row.Slug || row.Name.toLowerCase().replace(/\s+/g, "-"),
            description: row.Description,
            parent_id: row["Parent Category"]
              ? nameToId[row["Parent Category"].toLowerCase()] || null
              : null,
          }));

          const { error } = await supabase.from("categories").insert(categoriesToInsert);
          if (error) throw error;

          const userId = await getCurrentUserId();
          if (userId) {
            await supabase.from("notifications").insert({
              user_id: userId,
              type: "categories_imported",
              title: "Categories Imported",
              message: `${categoriesToInsert.length} categories were imported via CSV.`,
            });
          }

          toast.success(`Imported ${categoriesToInsert.length} categories!`, { id: toastId });
          fetchCategories();
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
    <div
      className="categories"
      style={{ fontFamily: "'Nunito', sans-serif" }}
    >
      <Toaster position="top-right" />
      {/* Header with actions */}
      <div className="categories-header">
        <h1 className="categories-title">Categories</h1>
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
            <FiPlus /> Add Category
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <input
          type="text"
          placeholder="Search categories..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
      </div>

      {/* Categories Table */}
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
                  <th>Image</th>
                  <th onClick={() => handleSort("name")} className="sortable">
                    Name {sortBy === "name" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th onClick={() => handleSort("slug")} className="sortable">
                    Slug {sortBy === "slug" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th onClick={() => handleSort("parent_id")} className="sortable">
                    Parent Category {sortBy === "parent_id" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th onClick={() => handleSort("created_at")} className="sortable">
                    Created At {sortBy === "created_at" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category.id}>
                    <td>
                      {category.image_url ? (
                        <img
                          src={getImageUrl(category.image_url)}
                          alt={category.name}
                          className="product-thumb"
                          onError={(e) => {
                            console.error("Category image failed to load:", category.image_url);
                            e.target.style.display = "none";
                          }}
                        />
                      ) : (
                        <span className="no-image">—</span>
                      )}
                    </td>
                    <td>{category.name}</td>
                    <td>{category.slug}</td>
                    <td>{category.parent?.name || "—"}</td>
                    <td>{new Date(category.created_at).toLocaleDateString()}</td>
                    <td>
                      <button
                        className="icon-btn edit"
                        onClick={() => openModal(category)}
                        aria-label="Edit"
                      >
                        <FiEdit />
                      </button>
                      <button
                        className="icon-btn delete"
                        onClick={() => handleDelete(category.id)}
                        aria-label="Delete"
                      >
                        <FiTrash2 />
                      </button>
                    </td>
                  </tr>
                ))}
                {categories.length === 0 && (
                  <tr>
                    <td colSpan="6" className="no-data">
                      No categories found.
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
        <CategoryFormModal
          category={editingCategory}
          categories={categories}
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

/* Category Form Modal with Image Upload */
function CategoryFormModal({ category, categories, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: category?.name || "",
    slug: category?.slug || "",
    description: category?.description || "",
    parent_id: category?.parent_id || "",
  });
  const [imageFile, setImageFile] = useState(null); // for new upload
  const [imagePath, setImagePath] = useState(category?.image_url || ""); // existing or new path
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Auto‑generate slug from name
  useEffect(() => {
    if (!formData.slug && formData.name) {
      setFormData((prev) => ({
        ...prev,
        slug: formData.name
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, ""),
      }));
    }
  }, [formData.name]);

  // Handle image selection
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type and size
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Image must be less than 2MB.");
      return;
    }

    setImageFile(file);
    // Create a preview
    const reader = new FileReader();
    reader.onload = () => {
      setImagePath(reader.result); // temporary preview
    };
    reader.readAsDataURL(file);
  };

  // Delete existing image (remove from storage if needed)
  const handleRemoveImage = async () => {
    if (imagePath && imagePath.startsWith("http")) {
      // It's an existing image from storage – we need to delete it from storage
      if (window.confirm("Remove this image?")) {
        try {
          await supabase.storage.from("Soham").remove([imagePath]);
        } catch (err) {
          console.error("Storage delete error:", err);
        }
      } else {
        return;
      }
    }
    setImageFile(null);
    setImagePath("");
    // Also clear the file input
    const fileInput = document.getElementById("category-image-input");
    if (fileInput) fileInput.value = "";
  };

  // Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    if (!formData.name) {
      setError("Category name is required.");
      setSaving(false);
      return;
    }

    const toastId = toast.loading(category ? "Updating category..." : "Creating category...");

    try {
      let finalImagePath = category?.image_url || "";

      // Upload new image if selected
      if (imageFile) {
        const fileExt = imageFile.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `categories/${fileName}`; // store in categories folder

        const { error: uploadError } = await supabase.storage
          .from("Soham")
          .upload(filePath, imageFile, { upsert: true });
        if (uploadError) throw uploadError;

        finalImagePath = filePath;
      }

      // If editing and image was removed (and no new upload), finalImagePath will be empty

      const data = {
        name: formData.name,
        slug: formData.slug || formData.name.toLowerCase().replace(/\s+/g, "-"),
        description: formData.description || null,
        parent_id: formData.parent_id || null,
        image_url: finalImagePath || null,
      };

      let result;
      if (category) {
        result = await supabase
          .from("categories")
          .update(data)
          .eq("id", category.id)
          .select();
      } else {
        result = await supabase.from("categories").insert([data]).select();
      }
      if (result.error) throw result.error;

      const savedCategory = result.data[0];
      const userId = await getCurrentUserId();

      if (userId) {
        await supabase.from("notifications").insert({
          user_id: userId,
          type: category ? "category_updated" : "category_created",
          title: category ? "Category Updated" : "Category Created",
          message: category
            ? `Category "${savedCategory.name}" was updated.`
            : `New category "${savedCategory.name}" was created.`,
          reference_id: savedCategory.id,
        });
      }

      toast.success(category ? "Category updated!" : "Category created!", { id: toastId });
      onSave();
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Failed to save category.", { id: toastId });
      setError(err.message || "Failed to save category.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <img src={logo} alt="Soham Logo" className="modal-logo" />
          <h2>{category ? "Edit Category" : "Add Category"}</h2>
        </div>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label>Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
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
              <label>Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows="3"
              />
            </div>
            <div className="form-group">
              <label>Parent Category</label>
              <select
                name="parent_id"
                value={formData.parent_id}
                onChange={handleChange}
              >
                <option value="">— None —</option>
                {categories
                  .filter((c) => c.id !== category?.id)
                  .map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Image Upload Section */}
          <div className="form-section">
            <h3>Category Image</h3>
            <div className="image-upload-container">
              {imagePath ? (
                <div className="image-preview">
                  <img
                    src={imagePath.startsWith("http") ? imagePath : getImageUrl(imagePath)}
                    alt="Category preview"
                    className="preview-img"
                  />
                  <button
                    type="button"
                    className="remove-image"
                    onClick={handleRemoveImage}
                    aria-label="Remove image"
                  >
                    <FiX />
                  </button>
                </div>
              ) : (
                <label className="upload-placeholder">
                  <FiUpload />
                  <span>Upload Image</span>
                  <input
                    id="category-image-input"
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    disabled={uploading || saving}
                  />
                  {uploading && <div className="uploading-spinner" />}
                </label>
              )}
            </div>
            <p className="image-hint">Max 2MB. Recommended size: 500x500px.</p>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={saving || uploading}
            >
              {saving ? "Saving..." : "Save Category"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}