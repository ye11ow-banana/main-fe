import { useEffect, useState } from "react";
import type { UserInfo } from "../../api/auth";
import { ApiError } from "../../api/http";
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  type Product,
  type ProductInput,
} from "../../api/calories";
import { Header } from "../../components/Header/Header";
import { useTheme } from "../../context/ThemeContext";
import "./ProductsList.css";

function toNumber(value: string | number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}


export function ProductsList({ user }: { user: UserInfo }) {
  const { theme } = useTheme();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  
  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [formData, setFormData] = useState<ProductInput>({
    name: "",
    proteins: 0,
    fats: 0,
    carbs: 0,
    calories: 0,
  });

  const loadProducts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getProducts(search, page);
      setProducts(res.data.data);
      setPageCount(res.data.page_count || 1);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Unexpected error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      loadProducts();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    loadProducts();
  }, [page]);

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        proteins: toNumber(product.proteins),
        fats: toNumber(product.fats),
        carbs: toNumber(product.carbs),
        calories: toNumber(product.calories),
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: "",
        proteins: 0,
        fats: 0,
        carbs: 0,
        calories: 0,
      });
    }
    setFormError(null);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingProduct(null);
  };

  const handleSave = async () => {
    if (!formData.name) {
      setFormError("Name is required");
      return;
    }
    
    setIsSaving(true);
    setFormError(null);
    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, formData);
      } else {
        await createProduct(formData);
      }
      handleCloseModal();
      loadProducts();
    } catch (err) {
      if (err instanceof ApiError) setFormError(err.message);
      else setFormError("Failed to save product");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (product: Product) => {
    setProductToDelete(product);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!productToDelete) return;

    setIsDeleting(true);
    try {
      await deleteProduct(productToDelete.id);
      setDeleteModalOpen(false);
      setProductToDelete(null);
      loadProducts();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to delete product");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className={`products-page theme-${theme}`}>
      <Header user={user} />

      <main className="main">
        <div className="container">
          <section className="page-header">
            <button 
              className="btn-back" 
              onClick={() => (window.location.href = "/calories-list")}
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                fontSize: 13,
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                marginBottom: 12,
                display: 'block'
              }}
            >
              ← Back to Calories
            </button>
            <div className="page-header-top">
              <div>
                <h1 className="page-title">Products</h1>
                <p className="page-subtitle">Manage your product database</p>
              </div>
            </div>
            
            <div className="filters">
              <div className="search-bar">
                <input
                  type="text"
                  placeholder="Search products..."
                  className="filter-input"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button className="btn-primary btn-sm" onClick={() => handleOpenModal()}>
                + Add product
              </button>
            </div>
          </section>

          <section className="product-section">
            <div className="product-list">
              {isLoading && <div className="loading">Loading products...</div>}
              {!isLoading && error && <div className="error">{error}</div>}
              {!isLoading && !error && products.length === 0 && (
                <div className="empty">No products found.</div>
              )}
              
              {!isLoading && !error && products.map((product) => {
                const createdAt = new Date(product.created_at);
                const today = new Date();
                const isToday = 
                  createdAt.getDate() === today.getDate() &&
                  createdAt.getMonth() === today.getMonth() &&
                  createdAt.getFullYear() === today.getFullYear();

                return (
                  <div key={product.id} className={`product-card ${isToday ? 'product-card--today' : ''}`}>
                    <div className="product-info">
                      <div className="product-name">{product.name}</div>
                      <div className="product-stats">
                        <span className="stat">P: {Math.round(toNumber(product.proteins))}g</span>
                        <span className="stat">F: {Math.round(toNumber(product.fats))}g</span>
                        <span className="stat">C: {Math.round(toNumber(product.carbs))}g</span>
                        <span className="stat-kcal">{Math.round(toNumber(product.calories))} kcal</span>
                        <span className="per-100">per 100g</span>
                      </div>
                    </div>
                    <div className="product-actions">
                      <button className="btn-icon" onClick={() => handleOpenModal(product)} title="Edit">
                        ✎
                      </button>
                      <button className="btn-icon btn-icon--delete" onClick={() => handleDelete(product)} title="Delete">
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {pageCount > 1 && (
              <nav className="pagination">
                <button
                  disabled={page === 1}
                  className="page-btn"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  Prev
                </button>
                <span className="page-info">Page {page} of {pageCount}</span>
                <button
                  disabled={page === pageCount}
                  className="page-btn"
                  onClick={() => setPage(p => Math.min(pageCount, p + 1))}
                >
                  Next
                </button>
              </nav>
            )}
          </section>
        </div>
      </main>

      {/* Modal */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingProduct ? "Edit Product" : "Add Product"}</h3>
              <button className="btn-close" onClick={handleCloseModal}>✕</button>
            </div>
            <div className="modal-body">
              <div className="field-group">
                <label>Name</label>
                <input
                  type="text"
                  className="field-input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="grid-2">
                <div className="field-group">
                  <label>Proteins (g)</label>
                  <input
                    type="number"
                    className="field-input"
                    value={formData.proteins}
                    onChange={(e) => setFormData({ ...formData, proteins: toNumber(e.target.value) })}
                  />
                </div>
                <div className="field-group">
                  <label>Fats (g)</label>
                  <input
                    type="number"
                    className="field-input"
                    value={formData.fats}
                    onChange={(e) => setFormData({ ...formData, fats: toNumber(e.target.value) })}
                  />
                </div>
                <div className="field-group">
                  <label>Carbs (g)</label>
                  <input
                    type="number"
                    className="field-input"
                    value={formData.carbs}
                    onChange={(e) => setFormData({ ...formData, carbs: toNumber(e.target.value) })}
                  />
                </div>
                <div className="field-group">
                  <label>Calories (kcal)</label>
                  <input
                    type="number"
                    className="field-input"
                    value={formData.calories}
                    onChange={(e) => setFormData({ ...formData, calories: toNumber(e.target.value) })}
                  />
                </div>
              </div>
              {formError && <div className="error-message">{formError}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={handleCloseModal}>Cancel</button>
              <button className="btn-primary" onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="modal-backdrop" onClick={() => setDeleteModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete Product</h3>
              <button className="btn-close" onClick={() => setDeleteModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete <strong>{productToDelete?.name}</strong>?</p>
              <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginTop: '8px' }}>
                This action cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setDeleteModalOpen(false)}>Cancel</button>
              <button 
                className="btn-primary" 
                onClick={confirmDelete} 
                disabled={isDeleting}
                style={{ background: '#DC2626', boxShadow: '0 10px 20px rgba(220, 38, 38, 0.2)' }}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
