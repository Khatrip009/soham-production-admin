import { memo } from "react";
import PropTypes from "prop-types";
import { supabase } from "../api/supabaseClient";
import "./ProductCard.css"; // import component styles

// Helper to get public URL from storage (adjust bucket name as needed)
const getImageUrl = (path) => {
  if (!path) return "";
  const { data } = supabase.storage.from("Soham").getPublicUrl(path);
  return data.publicUrl;
};

/**
 * ProductCard – Displays a single product with image, name, category, price, and stock.
 * @param {Object} product - Product object from view_product_complete
 * @param {Function} onClick - Optional click handler (e.g., for navigation)
 */
const ProductCard = ({ product, onClick }) => {
  const {
    name,
    price,
    stock,
    category_name,
    images,
    status,
    moq,
    unit,
  } = product;

  // Use first image as thumbnail
  const thumbnail = images?.[0]?.file_path
    ? getImageUrl(images[0].file_path)
    : null;

  const isOutOfStock = stock === 0;
  const isInactive = status !== "active";

  return (
    <div
      className={`product-card ${isInactive ? "inactive" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {/* Image section */}
      <div className="card-image">
        {thumbnail ? (
          <img src={thumbnail} alt={name} loading="lazy" />
        ) : (
          <div className="no-image-placeholder">
            <span>No image</span>
          </div>
        )}
        {isOutOfStock && <span className="stock-badge out">Out of stock</span>}
        {isInactive && <span className="status-badge inactive">Inactive</span>}
      </div>

      {/* Content section */}
      <div className="card-content">
        <h3 className="product-name" title={name}>
          {name}
        </h3>
        <p className="product-category">{category_name || "Uncategorized"}</p>

        <div className="product-details">
          <span className="product-price">
            ${price?.toFixed(2) ?? "0.00"}
          </span>
          <span className="product-stock">
            {stock > 0 ? `${stock} in stock` : "Out of stock"}
          </span>
        </div>

        {moq > 1 && (
          <p className="product-moq">
            MOQ: {moq} {unit}
          </p>
        )}
      </div>
    </div>
  );
};

ProductCard.propTypes = {
  product: PropTypes.shape({
    name: PropTypes.string.isRequired,
    price: PropTypes.number,
    stock: PropTypes.number,
    category_name: PropTypes.string,
    images: PropTypes.arrayOf(
      PropTypes.shape({
        file_path: PropTypes.string,
      })
    ),
    status: PropTypes.string,
    moq: PropTypes.number,
    unit: PropTypes.string,
  }).isRequired,
  onClick: PropTypes.func,
};

export default memo(ProductCard);