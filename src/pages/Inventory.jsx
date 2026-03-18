import { useEffect, useState, useCallback } from "react";
import { supabase } from "../api/supabaseClient";
import {
  FiPlus,
  FiDownload,
  FiEdit,
  FiTrash2,
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

// Movement types
const MOVEMENT_TYPES = [
  { value: "purchase", label: "Purchase" },
  { value: "sale", label: "Sale" },
  { value: "return", label: "Return" },
  { value: "adjustment", label: "Adjustment" },
  { value: "transfer", label: "Transfer" },
];

export default function Inventory() {
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [variants, setVariants] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pagination & filters
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [productFilter, setProductFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMovement, setEditingMovement] = useState(null); // for edit (if needed) – but we might not allow edit

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch products for filter dropdown
  useEffect(() => {
    const fetchProducts = async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name")
        .order("name");
      if (!error) setProducts(data || []);
    };
    fetchProducts();
  }, []);

  // Fetch variants for modal (when needed)
  const fetchVariantsForProduct = async (productId) => {
    if (!productId) return [];
    const { data, error } = await supabase
      .from("product_variants")
      .select("id, size, color, sku")
      .eq("product_id", productId);
    if (error) {
      console.error("Error fetching variants:", error);
      return [];
    }
    return data || [];
  };

  // Fetch movements
  const fetchMovements = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from("inventory_movements")
        .select(
          `
          *,
          product:product_id ( id, name ),
          variant:variant_id ( id, size, color, sku ),
          user:created_by ( email )
        `,
          { count: "exact" }
        );

      if (debouncedSearch) {
        // search by product name or reference
        query = query.or(
          `product.name.ilike.%${debouncedSearch}%,reference.ilike.%${debouncedSearch}%`
        );
      }
      if (productFilter !== "all") {
        query = query.eq("product_id", productFilter);
      }
      if (typeFilter !== "all") {
        query = query.eq("movement_type", typeFilter);
      }
      query = query.order(sortBy, { ascending: sortOrder === "asc" });

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      setMovements(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error("Error fetching movements:", err);
      setError("Failed to load inventory movements. Please try again.");
      toast.error("Failed to load movements.");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, productFilter, typeFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchMovements();
  }, [fetchMovements]);

  // Delete movement (if allowed – maybe not, but we'll include for completeness)
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this movement? This may affect stock accuracy.")) return;

    const toastId = toast.loading("Deleting movement...");
    try {
      const userId = await getCurrentUserId();

      // First, get the movement to know product and quantity
      const { data: movement, error: fetchError } = await supabase
        .from("inventory_movements")
        .select("*")
        .eq("id", id)
        .single();
      if (fetchError) throw fetchError;

      // Reverse the stock change (optional – we can either just delete movement and leave stock, or adjust stock back)
      // For simplicity, we'll just delete the movement and not revert stock. In real world, you might want to revert.
      // We'll notify that stock may be off.

      const { error } = await supabase
        .from("inventory_movements")
        .delete()
        .eq("id", id);
      if (error) throw error;

      if (userId) {
        await supabase.from("notifications").insert({
          user_id: userId,
          type: "inventory_deleted",
          title: "Movement Deleted",
          message: `Inventory movement for product ${movement.product_id} was deleted.`,
          reference_id: id,
        });
      }

      toast.success("Movement deleted!", { id: toastId });
      fetchMovements();
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Failed to delete movement.", { id: toastId });
    }
  };

  // Open modal for new movement
  const openAddModal = () => {
    setEditingMovement(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleSave = () => {
    fetchMovements();
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
    const toastId = toast.loading("Exporting movements...");
    try {
      const { data, error } = await supabase
        .from("inventory_movements")
        .select(`
          *,
          product:product_id ( name ),
          variant:variant_id ( size, color, sku ),
          user:created_by ( email )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const csvData = data.map((m) => ({
        ID: m.id,
        Product: m.product?.name,
        Variant: m.variant ? `${m.variant.size || ""} ${m.variant.color || ""} ${m.variant.sku || ""}`.trim() : "",
        Type: m.movement_type,
        Quantity: m.quantity,
        "Previous Stock": m.previous_stock,
        "New Stock": m.new_stock,
        Reference: m.reference,
        "Created By": m.user?.email,
        "Created At": m.created_at,
      }));

      const csv = Papa.unparse(csvData);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      saveAs(blob, `inventory_export_${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success("Export successful!", { id: toastId });
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Export failed.", { id: toastId });
    }
  };

  return (
    <div className="inventory" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <Toaster position="top-right" />
      {/* Header with actions */}
      <div className="inventory-header">
        <h1 className="inventory-title">Inventory Movements</h1>
        <div className="header-actions">
          <button className="btn-secondary" onClick={exportToCSV}>
            <FiDownload /> Export CSV
          </button>
          <button className="btn-primary" onClick={openAddModal}>
            <FiPlus /> Add Movement
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <input
          type="text"
          placeholder="Search by product or reference..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
        <select
          value={productFilter}
          onChange={(e) => setProductFilter(e.target.value)}
          className="filter-select"
        >
          <option value="all">All Products</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="filter-select"
        >
          <option value="all">All Types</option>
          {MOVEMENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Movements Table */}
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
                  <th onClick={() => handleSort("product_id")} className="sortable">
                    Product {sortBy === "product_id" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th>Variant</th>
                  <th onClick={() => handleSort("movement_type")} className="sortable">
                    Type {sortBy === "movement_type" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th onClick={() => handleSort("quantity")} className="sortable">
                    Quantity {sortBy === "quantity" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th onClick={() => handleSort("previous_stock")} className="sortable">
                    Previous Stock {sortBy === "previous_stock" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th onClick={() => handleSort("new_stock")} className="sortable">
                    New Stock {sortBy === "new_stock" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th>Reference</th>
                  <th onClick={() => handleSort("created_by")} className="sortable">
                    Created By {sortBy === "created_by" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th onClick={() => handleSort("created_at")} className="sortable">
                    Date {sortBy === "created_at" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((mov) => (
                  <tr key={mov.id}>
                    <td>{mov.product?.name}</td>
                    <td>
                      {mov.variant
                        ? `${mov.variant.size || ""} ${mov.variant.color || ""} ${mov.variant.sku || ""}`.trim() || "—"
                        : "—"}
                    </td>
                    <td>
                      <span className={`movement-badge ${mov.movement_type}`}>
                        {MOVEMENT_TYPES.find(t => t.value === mov.movement_type)?.label || mov.movement_type}
                      </span>
                    </td>
                    <td className={mov.quantity > 0 ? "positive" : "negative"}>
                      {mov.quantity > 0 ? `+${mov.quantity}` : mov.quantity}
                    </td>
                    <td>{mov.previous_stock}</td>
                    <td>{mov.new_stock}</td>
                    <td>{mov.reference || "—"}</td>
                    <td>{mov.user?.email || "—"}</td>
                    <td>{new Date(mov.created_at).toLocaleString()}</td>
                    <td>
                      <button
                        className="icon-btn delete"
                        onClick={() => handleDelete(mov.id)}
                        aria-label="Delete"
                      >
                        <FiTrash2 />
                      </button>
                    </td>
                  </tr>
                ))}
                {movements.length === 0 && (
                  <tr>
                    <td colSpan="10" className="no-data">
                      No movements found.
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

      {/* Add Movement Modal */}
      {isModalOpen && (
        <MovementFormModal
          products={products}
          onClose={closeModal}
          onSave={handleSave}
          fetchVariantsForProduct={fetchVariantsForProduct}
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

/* Movement Form Modal */
function MovementFormModal({ products, onClose, onSave, fetchVariantsForProduct }) {
  const [formData, setFormData] = useState({
    product_id: "",
    variant_id: "",
    movement_type: "adjustment",
    quantity: "",
    reference: "",
  });
  const [variants, setVariants] = useState([]);
  const [currentStock, setCurrentStock] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // When product changes, fetch variants and current stock
  useEffect(() => {
    const loadProductData = async () => {
      if (!formData.product_id) {
        setVariants([]);
        setCurrentStock(null);
        return;
      }
      setLoading(true);
      try {
        const [variantsData, productData] = await Promise.all([
          fetchVariantsForProduct(formData.product_id),
          supabase.from("products").select("stock").eq("id", formData.product_id).single(),
        ]);
        setVariants(variantsData);
        setCurrentStock(productData.data?.stock || 0);
      } catch (err) {
        console.error("Error loading product data:", err);
      } finally {
        setLoading(false);
      }
    };
    loadProductData();
  }, [formData.product_id, fetchVariantsForProduct]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validate
    if (!formData.product_id) {
      setError("Please select a product.");
      return;
    }
    const quantity = parseInt(formData.quantity, 10);
    if (isNaN(quantity) || quantity === 0) {
      setError("Quantity must be a non-zero integer.");
      return;
    }

    const toastId = toast.loading("Recording movement...");
    try {
      const userId = await getCurrentUserId();
      const previousStock = currentStock;
      const newStock = previousStock + quantity;

      // Insert movement
      const { data: movement, error: movError } = await supabase
        .from("inventory_movements")
        .insert({
          product_id: formData.product_id,
          variant_id: formData.variant_id || null,
          movement_type: formData.movement_type,
          quantity: quantity,
          previous_stock: previousStock,
          new_stock: newStock,
          reference: formData.reference || null,
          created_by: userId,
        })
        .select()
        .single();
      if (movError) throw movError;

      // Update product stock
      const { error: updateError } = await supabase
        .from("products")
        .update({ stock: newStock })
        .eq("id", formData.product_id);
      if (updateError) throw updateError;

      // Notification
      if (userId) {
        await supabase.from("notifications").insert({
          user_id: userId,
          type: "inventory_added",
          title: "Inventory Movement",
          message: `Added ${quantity} units to ${products.find(p => p.id === formData.product_id)?.name}.`,
          reference_id: movement.id,
        });
      }

      toast.success("Movement recorded!", { id: toastId });
      onSave();
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Failed to record movement.", { id: toastId });
      setError(err.message || "Failed to save movement.");
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <img src={logo} alt="Soham Logo" className="modal-logo" />
          <h2>Add Inventory Movement</h2>
        </div>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label>Product *</label>
              <select
                name="product_id"
                value={formData.product_id}
                onChange={handleChange}
                required
              >
                <option value="">— Select Product —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Variant (optional)</label>
              <select
                name="variant_id"
                value={formData.variant_id}
                onChange={handleChange}
                disabled={!formData.product_id || loading}
              >
                <option value="">— None —</option>
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.size || ""} {v.color || ""} {v.sku || ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Movement Type *</label>
              <select
                name="movement_type"
                value={formData.movement_type}
                onChange={handleChange}
                required
              >
                {MOVEMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Quantity *</label>
              <input
                type="number"
                name="quantity"
                value={formData.quantity}
                onChange={handleChange}
                required
                placeholder="e.g., 10 or -5"
              />
              <small>Use positive for addition, negative for reduction.</small>
            </div>
            <div className="form-group full-width">
              <label>Reference (optional)</label>
              <input
                type="text"
                name="reference"
                value={formData.reference}
                onChange={handleChange}
                placeholder="e.g., PO-123, Adjustment"
              />
            </div>
            {currentStock !== null && (
              <div className="form-group full-width stock-info">
                <p>Current Stock: <strong>{currentStock}</strong></p>
                {formData.quantity && (
                  <p>New Stock will be: <strong>{currentStock + parseInt(formData.quantity || 0)}</strong></p>
                )}
              </div>
            )}
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Loading..." : "Record Movement"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}