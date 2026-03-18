import { useEffect, useState, useCallback } from "react";
import { supabase } from "../api/supabaseClient";
import {
  FiEdit,
  FiTrash2,
  FiPlus,
  FiUpload,
  FiX,
  FiDownload,
  FiUploadCloud,
} from "react-icons/fi";
import Papa from "papaparse";
import { saveAs } from "file-saver";
import toast, { Toaster } from "react-hot-toast";
import ProductCard from "../components/ProductCard";
import logo from "../assets/sohom_logo.png";
import "./Products.css";

    // Helper to get public URL for an image stored in the "Soham" bucket
    const getImageUrl = (path) => {
    if (!path) return "";
    const { data } = supabase.storage.from("Soham").getPublicUrl(path);
    // Log for debugging – remove after fixing
    console.log("Generated URL:", data.publicUrl);
    return data.publicUrl;
    };

// Helper to get current user ID
const getCurrentUserId = async () => {
  const { data } = await supabase.auth.getUser();
  return data.user?.id;
};

export default function Products() {
  const [products, setProducts] = useState([]);
  const [galleryProducts, setGalleryProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pagination & filters for table
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch categories for filter dropdown
  useEffect(() => {
    const loadCategories = async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name")
        .order("name");
      if (!error) setCategories(data || []);
    };
    loadCategories();
  }, []);

  // Fetch products with images from product_images
   // Inside fetchProductsWithImages, add a console log:
  const fetchProductsWithImages = useCallback(
    async (queryBuilder) => {
      const { data, error, count } = await queryBuilder;
      if (error) throw error;

      if (!data || data.length === 0) return { data: [], count: 0 };

      const productIds = data.map((p) => p.id);
      const { data: images, error: imgError } = await supabase
        .from("product_images")
        .select("product_id, image_url, sort_order")
        .in("product_id", productIds)
        .order("sort_order");

      if (imgError) throw imgError;

      // Log images for debugging
      console.log("Fetched images:", images);

      // Attach images to each product
      const productsWithImages = data.map((product) => ({
        ...product,
        images: images
          .filter((img) => img.product_id === product.id)
          .map((img) => ({
            file_path: img.image_url,
          })),
      }));

      return { data: productsWithImages, count };
    },
    []
  );

  // Fetch products for table (with filters)
  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from("view_product_complete")
        .select("*", { count: "exact" });

      if (debouncedSearch) {
        query = query.or(
          `name.ilike.%${debouncedSearch}%,description.ilike.%${debouncedSearch}%`
        );
      }
      if (categoryFilter !== "all") {
        query = query.eq("category_id", categoryFilter);
      }
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      query = query.order(sortBy, { ascending: sortOrder === "asc" });

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, count } = await fetchProductsWithImages(query);
      setProducts(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error("Error fetching products:", err);
      setError("Failed to load products. Please try again.");
      toast.error("Failed to load products.");
    } finally {
      setLoading(false);
    }
  }, [
    page,
    pageSize,
    debouncedSearch,
    categoryFilter,
    statusFilter,
    sortBy,
    sortOrder,
    fetchProductsWithImages,
  ]);

  // Fetch products for gallery (latest 10)
  const fetchGalleryProducts = useCallback(async () => {
    try {
      const query = supabase
        .from("view_product_complete")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      const { data } = await fetchProductsWithImages(query);
      setGalleryProducts(data || []);
    } catch (err) {
      console.error("Error fetching gallery products:", err);
    }
  }, [fetchProductsWithImages]);

  // Initial load
  useEffect(() => {
    fetchProducts();
    fetchGalleryProducts();
  }, [fetchProducts, fetchGalleryProducts]);

  // Delete product
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this product?")) return;

    const toastId = toast.loading("Deleting product...");
    try {
      // Get current user for notification
      const userId = await getCurrentUserId();

      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;

      // Insert notification
      if (userId) {
        await supabase.from("notifications").insert({
          user_id: userId,
          type: "product_deleted",
          title: "Product Deleted",
          message: `Product with ID ${id} was deleted.`,
          reference_id: id,
        });
      }

      toast.success("Product deleted successfully!", { id: toastId });
      await Promise.all([fetchProducts(), fetchGalleryProducts()]);
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Failed to delete product.", { id: toastId });
    }
  };

  // Open modal
  const openModal = (product = null) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
  };

  const handleSave = async () => {
    await Promise.all([fetchProducts(), fetchGalleryProducts()]);
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
    const toastId = toast.loading("Exporting products...");
    try {
      const { data, error } = await supabase
        .from("view_product_complete")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const csvData = data.map((p) => ({
        ID: p.id,
        Name: p.name,
        Slug: p.slug,
        Description: p.description,
        Category: p.category_name,
        Price: p.price,
        Stock: p.stock,
        SKU: p.sku,
        Status: p.status,
        MOQ: p.moq,
        Unit: p.unit,
        "Created At": p.created_at,
      }));

      const csv = Papa.unparse(csvData);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      saveAs(blob, `products_export_${new Date().toISOString().slice(0, 10)}.csv`);
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

    const toastId = toast.loading("Importing products...");

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          // Create case‑insensitive category mapping
          const categoryMap = Object.fromEntries(
            categories.map((c) => [c.name.toLowerCase(), c.id])
          );

          const productsToInsert = results.data.map((row) => ({
            name: row.Name,
            slug: row.Slug,
            description: row.Description,
            category_id: categoryMap[row.Category?.toLowerCase()] || null,
            price: parseFloat(row.Price) || null,
            stock: parseInt(row.Stock) || 0,
            sku: row.SKU,
            status: row.Status === "active" ? "active" : "inactive",
            moq: parseInt(row.MOQ) || 1,
            unit: row.Unit || "pcs",
          }));

          const { error } = await supabase.from("products").insert(productsToInsert);
          if (error) throw error;

          // Insert notification (optional – could be bulk)
          const userId = await getCurrentUserId();
          if (userId) {
            await supabase.from("notifications").insert({
              user_id: userId,
              type: "products_imported",
              title: "Products Imported",
              message: `${productsToInsert.length} products were imported via CSV.`,
            });
          }

          toast.success(`Imported ${productsToInsert.length} products!`, { id: toastId });
          await Promise.all([fetchProducts(), fetchGalleryProducts()]);
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
    e.target.value = null; // reset input
  };
function ProductImage({ filePath, alt }) {
  const [src, setSrc] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!filePath) return;
    const url = getImageUrl(filePath);
    setSrc(url);
    setError(false);
  }, [filePath]);

  if (error || !src) return <span className="no-image">—</span>;

  return (
   <img
  src={src}
  alt={alt}
  className="product-thumb"
  style={{ border: '2px solid black' }}
  onError={() => setError(true)}
/>
  );
}
  return (
    <div className="products">
      <Toaster position="top-right" />
      {/* Header with actions */}
      <div className="products-header">
        <h1 className="products-title">Products</h1>
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
            <FiPlus /> Add Product
          </button>
        </div>
      </div>

      {/* Product Gallery (Horizontal Scroll) */}
      <div className="gallery-section">
        <h2 className="section-title">Latest Products</h2>
        <div className="product-gallery">
          {galleryProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onClick={() => openModal(product)}
            />
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <input
          type="text"
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="filter-select"
        >
          <option value="all">All Categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
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

      {/* Products Table */}
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
                  <th onClick={() => handleSort("category_name")} className="sortable">
                    Category {sortBy === "category_name" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th onClick={() => handleSort("price")} className="sortable">
                    Price {sortBy === "price" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th onClick={() => handleSort("stock")} className="sortable">
                    Stock {sortBy === "stock" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  // Debug log – remove in production
                  // console.log("Product images:", product.images);
                  return (
                    <tr key={product.id}>
                      <td>
  <ProductImage filePath={product.images?.[0]?.file_path} alt={product.name} />
</td>
                      <td>{product.name}</td>
                      <td>{product.category_name || "—"}</td>
                      <td>{product.price ? `$${product.price.toFixed(2)}` : "—"}</td>
                      <td>{product.stock}</td>
                      <td>
                        <span className={`status-badge ${product.status}`}>
                          {product.status}
                        </span>
                      </td>
                      <td>
                        <button
                          className="icon-btn edit"
                          onClick={() => openModal(product)}
                          aria-label="Edit"
                        >
                          <FiEdit />
                        </button>
                        <button
                          className="icon-btn delete"
                          onClick={() => handleDelete(product.id)}
                          aria-label="Delete"
                        >
                          <FiTrash2 />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {products.length === 0 && (
                  <tr>
                    <td colSpan="7" className="no-data">
                      No products found.
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
        <ProductFormModal
          product={editingProduct}
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

/* Product Form Modal with Image Upload to product_images */
function ProductFormModal({ product, categories, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: product?.name || "",
    slug: product?.slug || "",
    description: product?.description || "",
    category_id: product?.category_id || "",
    price: product?.price || "",
    stock: product?.stock || 0,
    sku: product?.sku || "",
    status: product?.status || "active",
    moq: product?.moq || 1,
    unit: product?.unit || "pcs",
  });
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Fetch existing images if editing
  useEffect(() => {
    if (product?.id) {
      const fetchImages = async () => {
        const { data, error } = await supabase
          .from("product_images")
          .select("id, image_url, sort_order")
          .eq("product_id", product.id)
          .order("sort_order");
        if (!error)
          setImages(
            data.map((img) => ({
              id: img.id,
              file_path: img.image_url,
              sort_order: img.sort_order,
            }))
          );
        else console.error("Error fetching images:", error);
      };
      fetchImages();
    }
  }, [product]);

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

  // Handle multiple image uploads
  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    if (images.length + files.length > 5) {
      setError("Maximum 5 images allowed");
      return;
    }

    setUploading(true);
    setError("");

    try {
      for (const file of files) {
        if (!file.type.startsWith("image/")) {
          setError("Please upload only image files.");
          continue;
        }
        if (file.size > 2 * 1024 * 1024) {
          setError("Each image must be less than 2MB.");
          continue;
        }

        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random()
          .toString(36)
          .substring(2)}.${fileExt}`;
        const folder = product?.id || "temp";
        const filePath = `products/${folder}/${fileName}`;

        console.log("Uploading to:", filePath);
        const { error: uploadError } = await supabase.storage
          .from("Soham")
          .upload(filePath, file, { upsert: true });
        if (uploadError) {
          console.error("Upload error details:", uploadError);
          throw uploadError;
        }

        if (product?.id) {
          // Associate with existing product
          const nextSortOrder = images.length + 1; // approximate, but fine
          const { error: dbError } = await supabase
            .from("product_images")
            .insert({
              product_id: product.id,
              image_url: filePath,
              sort_order: nextSortOrder,
            });
          if (dbError) {
            console.error("DB insert error:", dbError);
            throw dbError;
          }
        } else {
          // New product – store temporarily
          setImages((prev) => [
            ...prev,
            {
              file_path: filePath,
              sort_order: prev.length + 1,
              temp: true,
            },
          ]);
        }
      }

      // If editing, refresh the images list
      if (product?.id) {
        const { data: newImages } = await supabase
          .from("product_images")
          .select("id, image_url, sort_order")
          .eq("product_id", product.id)
          .order("sort_order");
        setImages(
          newImages.map((img) => ({
            id: img.id,
            file_path: img.image_url,
            sort_order: img.sort_order,
          })) || []
        );
      }
    } catch (err) {
      console.error("Upload error:", err);
      setError("Failed to upload image. See console for details.");
    } finally {
      setUploading(false);
      e.target.value = null;
    }
  };

  // Delete image
  const handleDeleteImage = async (image) => {
    if (image.id) {
      if (!window.confirm("Delete this image?")) return;
      try {
        console.log("Deleting from storage:", image.file_path);
        const { error: storageError } = await supabase.storage
          .from("Soham")
          .remove([image.file_path]);
        if (storageError) throw storageError;

        const { error: dbError } = await supabase
          .from("product_images")
          .delete()
          .eq("id", image.id);
        if (dbError) throw dbError;

        setImages((prev) => prev.filter((img) => img.id !== image.id));
      } catch (err) {
        console.error("Delete error:", err);
        setError("Failed to delete image.");
      }
    } else {
      // Temporary image – just remove from state
      setImages((prev) => prev.filter((img) => img.file_path !== image.file_path));
    }
  };

  // Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    if (!formData.name) {
      setError("Product name is required.");
      setSaving(false);
      return;
    }

    const toastId = toast.loading(product ? "Updating product..." : "Creating product...");

    try {
      const data = {
        ...formData,
        price: formData.price ? parseFloat(formData.price) : null,
        stock: parseInt(formData.stock, 10) || 0,
        moq: parseInt(formData.moq, 10) || 1,
      };

      let result;
      if (product) {
        result = await supabase
          .from("products")
          .update(data)
          .eq("id", product.id)
          .select();
      } else {
        result = await supabase.from("products").insert([data]).select();
      }
      if (result.error) throw result.error;

      const savedProduct = result.data[0];
      const userId = await getCurrentUserId();

      // Insert notification
      if (userId) {
        await supabase.from("notifications").insert({
          user_id: userId,
          type: product ? "product_updated" : "product_created",
          title: product ? "Product Updated" : "Product Created",
          message: product
            ? `Product "${savedProduct.name}" was updated.`
            : `New product "${savedProduct.name}" was created.`,
          reference_id: savedProduct.id,
        });
      }

      // Associate temporary images with the new product
      if (!product && images.length > 0) {
        const imageInserts = images.map((img, idx) => ({
          product_id: savedProduct.id,
          image_url: img.file_path,
          sort_order: idx + 1,
        }));
        const { error: imgError } = await supabase
          .from("product_images")
          .insert(imageInserts);
        if (imgError) throw imgError;
      }

      toast.success(product ? "Product updated!" : "Product created!", { id: toastId });
      onSave();
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Failed to save product.", { id: toastId });
      setError(err.message || "Failed to save product.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <img src={logo} alt="Soham Logo" className="modal-logo" />
          <h2>{product ? "Edit Product" : "Add Product"}</h2>
        </div>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          {/* Basic Info Section */}
          <div className="form-section">
            <h3>Basic Information</h3>
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
                <label>Category</label>
                <select
                  name="category_id"
                  value={formData.category_id}
                  onChange={handleChange}
                >
                  <option value="">— Select Category —</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Pricing & Inventory Section */}
          <div className="form-section">
            <h3>Pricing & Inventory</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  name="price"
                  value={formData.price}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label>Stock</label>
                <input
                  type="number"
                  name="stock"
                  value={formData.stock}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label>SKU</label>
                <input
                  type="text"
                  name="sku"
                  value={formData.sku}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label>MOQ</label>
                <input
                  type="number"
                  name="moq"
                  value={formData.moq}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label>Unit</label>
                <input
                  type="text"
                  name="unit"
                  value={formData.unit}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label>Status</label>
                <select name="status" value={formData.status} onChange={handleChange}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
          </div>

          {/* Images Section */}
          <div className="form-section">
            <h3>Product Images (max 5)</h3>
            <div className="image-grid">
              {images.map((img, idx) => (
                <div key={idx} className="image-item">
                  <img
  key={getImageUrl(img.file_path)} // 👈 Add this key
  src={getImageUrl(img.file_path)}
  alt={`Product ${idx + 1}`}
  onError={(e) => {
    console.error("Modal image failed to load:", img.file_path);
    e.target.style.display = "none";
  }}
/>
                  <button
                    type="button"
                    className="remove-image"
                    onClick={() => handleDeleteImage(img)}
                    aria-label="Remove image"
                  >
                    <FiX />
                  </button>
                </div>
              ))}
              {images.length < 5 && (
                <label className="upload-placeholder">
                  <FiUpload />
                  <span>Upload Image</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploading || saving}
                    multiple
                  />
                  {uploading && <div className="uploading-spinner" />}
                </label>
              )}
            </div>
            <p className="image-hint">
              Max 2MB per image. First image will be the thumbnail.
            </p>
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
              {saving ? "Saving..." : "Save Product"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}