import { useEffect, useState, useCallback } from "react";
import { supabase } from "../api/supabaseClient";
import {
  FiEdit,
  FiPlus,
  FiDownload,
  FiUploadCloud,
  FiX,
  FiEye,
} from "react-icons/fi";
import Papa from "papaparse";
import { saveAs } from "file-saver";
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

// ==================== SECTION SCHEMAS ====================
// Define your page sections here. Each section has:
// - label: display name
// - fields: array of field definitions (name, label, type, etc.)
// - previewComponent: React component to render preview
const sectionSchemas = {
  home_hero: {
    label: "Homepage Hero",
    fields: [
      { name: "title", label: "Title", type: "text" },
      { name: "subtitle", label: "Subtitle", type: "textarea" },
      { name: "backgroundImage", label: "Background Image", type: "image" },
      { name: "buttonText", label: "Button Text", type: "text" },
      { name: "buttonLink", label: "Button Link", type: "text" },
    ],
    previewComponent: ({ data }) => (
      <div
        className="hero-preview"
        style={{
          backgroundImage: data.backgroundImage ? `url(${getImageUrl(data.backgroundImage)})` : "none",
          backgroundSize: "cover",
          padding: "40px",
          color: "#fff",
          textAlign: "center",
        }}
      >
        <h1>{data.title || "Hero Title"}</h1>
        <p>{data.subtitle || "Hero subtitle"}</p>
        {data.buttonText && (
          <a href={data.buttonLink || "#"} className="btn-primary">
            {data.buttonText}
          </a>
        )}
      </div>
    ),
  },
  home_features: {
    label: "Features Section",
    fields: [
      { name: "heading", label: "Heading", type: "text" },
      {
        name: "features",
        label: "Features",
        type: "repeater",
        fields: [
          { name: "icon", label: "Icon", type: "text" },
          { name: "title", label: "Title", type: "text" },
          { name: "description", label: "Description", type: "textarea" },
        ],
      },
    ],
    previewComponent: ({ data }) => (
      <div className="features-preview" style={{ padding: "20px" }}>
        <h2>{data.heading || "Features"}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "20px" }}>
          {data.features?.map((f, i) => (
            <div key={i} style={{ border: "1px solid #eee", padding: "10px" }}>
              <h3>{f.title}</h3>
              <p>{f.description}</p>
            </div>
          )) || <p>No features added.</p>}
        </div>
      </div>
    ),
  },
  // Add more sections as needed...
};

// ==================== SETTING TYPES ====================
const SETTING_TYPES = [
  { value: "text", label: "Text", input: "text" },
  { value: "number", label: "Number", input: "number" },
  { value: "boolean", label: "Boolean", input: "checkbox" },
  { value: "json", label: "JSON", input: "textarea" },
];

// ==================== MAIN SETTINGS COMPONENT ====================
export default function Settings() {
  const [settings, setSettings] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pagination & filters
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("setting_key");
  const [sortOrder, setSortOrder] = useState("asc");

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSetting, setEditingSetting] = useState(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch settings
  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from("settings")
        .select("*", { count: "exact" });

      if (debouncedSearch) {
        query = query.or(
          `setting_key.ilike.%${debouncedSearch}%,setting_value.ilike.%${debouncedSearch}%,description.ilike.%${debouncedSearch}%`
        );
      }
      if (typeFilter !== "all") {
        query = query.eq("setting_type", typeFilter);
      }
      query = query.order(sortBy, { ascending: sortOrder === "asc" });

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      setSettings(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error("Error fetching settings:", err);
      setError("Failed to load settings. Please try again.");
      toast.error("Failed to load settings.");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, typeFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Open modal for editing/adding
  const openEditModal = (setting = null) => {
    setEditingSetting(setting);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingSetting(null);
  };

  const handleSave = () => {
    fetchSettings();
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
    const toastId = toast.loading("Exporting settings...");
    try {
      const { data, error } = await supabase
        .from("settings")
        .select("*")
        .order("setting_key", { ascending: true });
      if (error) throw error;

      const csvData = data.map((s) => ({
        Key: s.setting_key,
        Value: s.setting_value,
        Type: s.setting_type,
        Description: s.description,
        "JSON Value": s.setting_json ? JSON.stringify(s.setting_json) : "",
        "Updated At": s.updated_at,
      }));

      const csv = Papa.unparse(csvData);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      saveAs(blob, `settings_export_${new Date().toISOString().slice(0, 10)}.csv`);
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

    const toastId = toast.loading("Importing settings...");

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const settingsToInsert = results.data.map((row) => ({
            setting_key: row.Key,
            setting_value: row.Value || null,
            setting_type: row.Type || "text",
            description: row.Description || null,
            setting_json: row["JSON Value"] ? JSON.parse(row["JSON Value"]) : null,
          }));

          const { error } = await supabase.from("settings").insert(settingsToInsert);
          if (error) throw error;

          const userId = await getCurrentUserId();
          if (userId) {
            await supabase.from("notifications").insert({
              user_id: userId,
              type: "settings_imported",
              title: "Settings Imported",
              message: `${settingsToInsert.length} settings were imported via CSV.`,
            });
          }

          toast.success(`Imported ${settingsToInsert.length} settings!`, { id: toastId });
          fetchSettings();
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
    <div className="settings" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <Toaster position="top-right" />
      {/* Header with actions */}
      <div className="settings-header">
        <h1 className="settings-title">Settings</h1>
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
            <FiPlus /> Add Setting
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <input
          type="text"
          placeholder="Search by key, value, or description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="filter-select"
        >
          <option value="all">All Types</option>
          {SETTING_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Settings Table */}
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
                  <th onClick={() => handleSort("setting_key")} className="sortable">
                    Key {sortBy === "setting_key" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th onClick={() => handleSort("setting_value")} className="sortable">
                    Value {sortBy === "setting_value" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th onClick={() => handleSort("setting_type")} className="sortable">
                    Type {sortBy === "setting_type" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th onClick={() => handleSort("description")} className="sortable">
                    Description {sortBy === "description" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th onClick={() => handleSort("updated_at")} className="sortable">
                    Updated {sortBy === "updated_at" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {settings.map((setting) => {
                  const displayValue = setting.setting_type === "json"
                    ? JSON.stringify(setting.setting_json)
                    : setting.setting_value;
                  return (
                    <tr key={setting.id}>
                      <td>{setting.setting_key}</td>
                      <td className="setting-value">{displayValue || "—"}</td>
                      <td>
                        <span className="type-badge">{setting.setting_type}</span>
                      </td>
                      <td>{setting.description || "—"}</td>
                      <td>{new Date(setting.updated_at || setting.created_at).toLocaleDateString()}</td>
                      <td>
                        <button
                          className="icon-btn edit"
                          onClick={() => openEditModal(setting)}
                          aria-label="Edit"
                        >
                          <FiEdit />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {settings.length === 0 && (
                  <tr>
                    <td colSpan="6" className="no-data">
                      No settings found.
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
        <SettingFormModal
          setting={editingSetting}
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

// ==================== SECTION FORM & PREVIEW ====================

/* Repeater field component */
function RepeaterField({ field, value = [], onChange }) {
  const addItem = () => {
    const newItem = {};
    field.fields.forEach((f) => (newItem[f.name] = ""));
    onChange([...value, newItem]);
  };

  const removeItem = (index) => {
    const newValue = value.filter((_, i) => i !== index);
    onChange(newValue);
  };

  const updateItem = (index, fieldName, fieldValue) => {
    const newValue = [...value];
    newValue[index] = { ...newValue[index], [fieldName]: fieldValue };
    onChange(newValue);
  };

  return (
    <div className="repeater-field">
      {value.map((item, idx) => (
        <div key={idx} className="repeater-item" style={{ border: "1px solid #eee", marginBottom: "10px", padding: "10px" }}>
          {field.fields.map((subField) => (
            <div key={subField.name} style={{ marginBottom: "8px" }}>
              <label>{subField.label}</label>
              {subField.type === "textarea" ? (
                <textarea
                  value={item[subField.name] || ""}
                  onChange={(e) => updateItem(idx, subField.name, e.target.value)}
                  rows="2"
                />
              ) : (
                <input
                  type={subField.type === "number" ? "number" : "text"}
                  value={item[subField.name] || ""}
                  onChange={(e) => updateItem(idx, subField.name, e.target.value)}
                />
              )}
            </div>
          ))}
          <button type="button" className="btn-outline small" onClick={() => removeItem(idx)}>
            Remove
          </button>
        </div>
      ))}
      <button type="button" className="btn-secondary small" onClick={addItem}>
        Add Item
      </button>
    </div>
  );
}

/* Section Form – renders custom inputs based on schema */
function SectionForm({ schema, data = {}, onChange }) {
  const handleFieldChange = (fieldName, value) => {
    onChange({ ...data, [fieldName]: value });
  };

  return (
    <div className="section-form">
      {schema.fields.map((field) => {
        if (field.type === "repeater") {
          return (
            <div key={field.name} className="form-group full-width">
              <label>{field.label}</label>
              <RepeaterField
                field={field}
                value={data[field.name] || []}
                onChange={(val) => handleFieldChange(field.name, val)}
              />
            </div>
          );
        }
        if (field.type === "image") {
          return (
            <div key={field.name} className="form-group">
              <label>{field.label}</label>
              <ImageUpload
                value={data[field.name]}
                onChange={(path) => handleFieldChange(field.name, path)}
              />
            </div>
          );
        }
        if (field.type === "textarea") {
          return (
            <div key={field.name} className="form-group full-width">
              <label>{field.label}</label>
              <textarea
                value={data[field.name] || ""}
                onChange={(e) => handleFieldChange(field.name, e.target.value)}
                rows="3"
              />
            </div>
          );
        }
        return (
          <div key={field.name} className="form-group">
            <label>{field.label}</label>
            <input
              type={field.type === "number" ? "number" : "text"}
              value={data[field.name] || ""}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
            />
          </div>
        );
      })}
    </div>
  );
}

/* Image upload component (reused from products/categories) */
function ImageUpload({ value, onChange }) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(value ? getImageUrl(value) : null);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be less than 2MB.");
      return;
    }

    setUploading(true);
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `sections/${fileName}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from("Soham")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      onChange(filePath);
      setPreview(getImageUrl(filePath));
      toast.success("Image uploaded");
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("Upload failed");
    } finally {
      setUploading(false);
      e.target.value = null;
    }
  };

  const handleRemove = async () => {
    if (value) {
      await supabase.storage.from("Soham").remove([value]);
    }
    onChange(null);
    setPreview(null);
  };

  return (
    <div className="image-upload-container">
      {preview ? (
        <div className="image-preview">
          <img src={preview} alt="Preview" className="preview-img" />
          <button type="button" className="remove-image" onClick={handleRemove} aria-label="Remove">
            <FiX />
          </button>
        </div>
      ) : (
        <label className="upload-placeholder">
          <FiUpload />
          <span>Upload Image</span>
          <input type="file" accept="image/*" onChange={handleFileChange} disabled={uploading} />
          {uploading && <div className="uploading-spinner" />}
        </label>
      )}
    </div>
  );
}

/* Preview Modal */
function PreviewModal({ children, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content preview-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Preview</h2>
          <button className="modal-close" onClick={onClose}>
            <FiX />
          </button>
        </div>
        <div className="preview-content">{children}</div>
      </div>
    </div>
  );
}

// ==================== SETTING FORM MODAL (ENHANCED) ====================
function SettingFormModal({ setting, onClose, onSave }) {
  const [formData, setFormData] = useState({
    setting_key: setting?.setting_key || "",
    setting_value: setting?.setting_value || "",
    setting_type: setting?.setting_type || "text",
    description: setting?.description || "",
    setting_json: setting?.setting_json ? JSON.stringify(setting.setting_json, null, 2) : "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // For section forms, we keep the parsed JSON data separately
  const [sectionData, setSectionData] = useState(() => {
    if (setting?.setting_type === "json" && setting?.setting_json) {
      return setting.setting_json;
    }
    return {};
  });

  // Determine if this key matches a section schema
  const isSection = !!sectionSchemas[formData.setting_key];

  const handleSectionDataChange = (newData) => {
    setSectionData(newData);
    setFormData((prev) => ({
      ...prev,
      setting_json: JSON.stringify(newData, null, 2),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    if (!formData.setting_key) {
      setError("Key is required.");
      setSaving(false);
      return;
    }

    const toastId = toast.loading(setting ? "Updating setting..." : "Creating setting...");

    try {
      const userId = await getCurrentUserId();

      // Prepare data
      const data = {
        setting_key: formData.setting_key,
        setting_type: formData.setting_type,
        description: formData.description || null,
        updated_by: userId,
      };

      // Handle value based on type
      if (isSection) {
        // Use the JSON from sectionData
        data.setting_json = sectionData;
        data.setting_value = null;
      } else if (formData.setting_type === "json") {
        try {
          data.setting_json = JSON.parse(formData.setting_json);
          data.setting_value = null;
        } catch (err) {
          throw new Error("Invalid JSON format");
        }
      } else if (formData.setting_type === "boolean") {
        data.setting_value = formData.setting_value ? "true" : "false";
        data.setting_json = null;
      } else {
        data.setting_value = formData.setting_value;
        data.setting_json = null;
      }

      let result;
      if (setting) {
        result = await supabase
          .from("settings")
          .update(data)
          .eq("id", setting.id)
          .select();
      } else {
        result = await supabase.from("settings").insert([data]).select();
      }
      if (result.error) throw result.error;

      const savedSetting = result.data[0];

      // Insert notification
      if (userId) {
        await supabase.from("notifications").insert({
          user_id: userId,
          type: setting ? "setting_updated" : "setting_created",
          title: setting ? "Setting Updated" : "Setting Created",
          message: setting
            ? `Setting "${savedSetting.setting_key}" was updated.`
            : `New setting "${savedSetting.setting_key}" was created.`,
          reference_id: savedSetting.id,
        });
      }

      toast.success(setting ? "Setting updated!" : "Setting created!", { id: toastId });
      onSave();
    } catch (err) {
      console.error("Save error:", err);
      toast.error(err.message || "Failed to save setting.", { id: toastId });
      setError(err.message || "Failed to save setting.");
    } finally {
      setSaving(false);
    }
  };

  // Render input based on selected type (or section)
  const renderValueInput = () => {
    if (isSection) {
      const schema = sectionSchemas[formData.setting_key];
      return (
        <SectionForm
          schema={schema}
          data={sectionData}
          onChange={handleSectionDataChange}
        />
      );
    }

    const type = formData.setting_type;
    if (type === "boolean") {
      return (
        <div className="checkbox-group">
          <label>
            <input
              type="checkbox"
              name="setting_value"
              checked={formData.setting_value === "true" || formData.setting_value === true}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, setting_value: e.target.checked ? "true" : "false" }))
              }
            />
            Enabled
          </label>
        </div>
      );
    } else if (type === "json") {
      return (
        <textarea
          name="setting_json"
          value={formData.setting_json}
          onChange={handleChange}
          rows="6"
          placeholder='{"key": "value"}'
          className="code-textarea"
        />
      );
    } else {
      return (
        <input
          type={type === "number" ? "number" : "text"}
          name="setting_value"
          value={formData.setting_value}
          onChange={handleChange}
          placeholder="Value"
        />
      );
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <img src={logo} alt="Soham Logo" className="modal-logo" />
          <h2>{setting ? "Edit Setting" : "Add Setting"}</h2>
          <button className="modal-close" onClick={onClose}>
            <FiX />
          </button>
        </div>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label>Key *</label>
              <input
                type="text"
                name="setting_key"
                value={formData.setting_key}
                onChange={handleChange}
                required
                disabled={!!setting} // key cannot be changed after creation
              />
            </div>
            <div className="form-group">
              <label>Type</label>
              <select
                name="setting_type"
                value={formData.setting_type}
                onChange={handleChange}
                disabled={!!setting} // type cannot be changed after creation
              >
                {SETTING_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group full-width">
              <label>Value</label>
              {renderValueInput()}
            </div>
            <div className="form-group full-width">
              <label>Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows="2"
                placeholder="Brief description of this setting"
              />
            </div>
          </div>

          <div className="modal-actions">
            {isSection && (
              <button
                type="button"
                className="btn-outline"
                onClick={() => setShowPreview(true)}
              >
                <FiEye /> Preview
              </button>
            )}
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Save Setting"}
            </button>
          </div>
        </form>

        {showPreview && isSection && (
          <PreviewModal onClose={() => setShowPreview(false)}>
            {React.createElement(sectionSchemas[formData.setting_key].previewComponent, {
              data: sectionData,
            })}
          </PreviewModal>
        )}
      </div>
    </div>
  );
}