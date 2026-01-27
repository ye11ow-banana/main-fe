import { useState, useEffect, useRef } from "react";
import { getUsers, type UserInfo } from "../../api/auth";
import { ingestCalorieData, createCalorieDay, getProducts, type Product } from "../../api/calories";
import "./AddDay.css";

interface AddDayProps {
  user: UserInfo;
}

interface ReviewItem {
  id: string;
  user_id: string;
  user: string;
  product_id: string;
  product_name: string;
  weight: string;
}

import { Header } from "../../components/Header/Header";
import { useTheme } from "../../context/ThemeContext";

export function AddDay({ user }: AddDayProps) {
  const { theme } = useTheme();
  const [currentStep, setCurrentStep] = useState(1);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [availableUsers, setAvailableUsers] = useState<UserInfo[]>([]);
  
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [userAdditionalCalories, setUserAdditionalCalories] = useState<Record<string, string>>({});
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [visitedStep2, setVisitedStep2] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal states
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);

  useEffect(() => {
    getUsers().then((res) => {
      setAvailableUsers(res.data);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setImagePreview(url);
    }
  };

  const handleAnalyze = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file && !notes) {
      setVisitedStep2(true);
      setCurrentStep(2);
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    const formData = new FormData();
    if (file) formData.append("image", file);
    if (notes) formData.append("description", notes);

    try {
      const res = await ingestCalorieData(formData);
      setHasAnalyzed(true);
      setVisitedStep2(true);
      if (res.data && res.data.products) {
        const items: ReviewItem[] = res.data.products.map((p, idx) => {
          const matchedUser = availableUsers.find(u => u.username.toLowerCase() === p.user.toLowerCase());
          return {
            id: `ingest-${idx}-${Date.now()}`,
            user_id: matchedUser?.id || "",
            user: p.user,
            product_id: p.product_id,
            product_name: p.name,
            weight: p.weight || "0",
          };
        });
        setReviewItems(items);
      }
      setCurrentStep(2);
    } catch (err) {
      console.error(err);
      setError("Analysis failed: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    const formattedAdditionalCalories: Record<string, number> = {};
    Object.entries(userAdditionalCalories).forEach(([userId, val]) => {
      const num = parseFloat(val);
      if (!isNaN(num)) {
        formattedAdditionalCalories[userId] = num;
      }
    });

    try {
      await createCalorieDay({
        date,
        user_additional_calories: formattedAdditionalCalories,
        products: reviewItems.map(item => ({
          user_id: item.user_id,
          product_id: item.product_id,
          weight: item.weight
        }))
      });
      window.location.href = "/calories-list";
    } catch (err) {
      console.error(err);
      setError("Save failed: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setIsSaving(false);
    }
  };

  const addItem = () => {
    const defaultUser = availableUsers[0];
    setReviewItems([
      ...reviewItems,
      {
        id: `manual-${Date.now()}`,
        user_id: defaultUser?.id || "",
        user: defaultUser?.username || "Select User",
        product_id: "",
        product_name: "",
        weight: "0",
      },
    ]);
  };

  const deleteItem = (id: string) => {
    setReviewItems(reviewItems.filter((item) => item.id !== id));
  };

  const updateItem = (id: string, updates: Partial<ReviewItem>) => {
    setReviewItems(
      reviewItems.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const openUserPicker = (id: string) => {
    setActiveRowId(id);
    setUserModalOpen(true);
    setUserSearch("");
  };

  const openProductPicker = (id: string) => {
    setActiveRowId(id);
    setProductModalOpen(true);
    setProductSearch("");
    // We'll let the useEffect handle the initial fetch
  };

  const fetchProducts = async (q: string) => {
    try {
      const res = await getProducts(q);
      // getProducts returns PaginationDTO<Product> which has a 'data' array
      const productsList = res.data && Array.isArray(res.data.data) ? res.data.data : [];
      // Limit to 10 products as per requirement
      setProducts(productsList.slice(0, 10));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (productModalOpen) {
      const timer = setTimeout(() => {
        fetchProducts(productSearch);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [productSearch, productModalOpen]);


  const activeRow = reviewItems.find((item) => item.id === activeRowId);
  const filteredUsers = availableUsers.filter((u) =>
    u.username.toLowerCase().includes(userSearch.toLowerCase()) &&
    u.id !== activeRow?.user_id
  );


  const UserAvatar = ({ user, style }: { user: UserInfo | { username: string, avatar_url?: string | null }, style?: React.CSSProperties }) => {
    if (user.avatar_url) {
      return <img src={user.avatar_url} alt={user.username} className="review-avatar" style={{ objectFit: "cover", ...style }} />;
    }
    return (
      <div className="review-avatar" style={{ background: "var(--color-primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", ...style }}>
        <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: "60%", height: "60%" }}>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      </div>
    );
  };

  return (
    <div className={`add-day-page theme-${theme}`}>
      <Header user={user} />

      <main className="main">
        <div className="container">
          <section className="page-header">
            <h1 className="page-title">Add day</h1>
            <p className="page-subtitle">
              Attach an image, pick a date and add notes for this day. It will appear in your calories list.
            </p>
          </section>

          <section className="form-wrapper">
            <div className="progress">
              <button 
                className={`progress-step ${currentStep === 1 ? "progress-step--active" : ""} ${currentStep > 1 ? "progress-step--completed" : ""}`}
                type="button"
                onClick={() => setCurrentStep(1)}
              >
                <span className="progress-step-index">1</span>
                <span>
                  <span className="progress-step-label-main">Calories creation</span>
                  <span className="progress-step-label-sub">Upload data for this day</span>
                </span>
              </button>
              <div className="progress-line"></div>
              <button 
                className={`progress-step ${currentStep === 2 ? "progress-step--active" : ""}`}
                type="button"
                onClick={() => visitedStep2 && setCurrentStep(2)}
                disabled={!visitedStep2}
              >
                <span className="progress-step-index">2</span>
                <span>
                  <span className="progress-step-label-main">Result check</span>
                  <span className="progress-step-label-sub">Review items before saving</span>
                </span>
              </button>
            </div>

            <div className="form-card">
              {currentStep === 1 && (
                <div className="step">
                  <div>
                    <h2 className="step-section-title">New daily record</h2>
                    <p className="form-description">Fill in the details below to analyze this day.</p>
                  </div>
                  <div className="form-body">
                    <div className="field-group">
                      <label className="field-label" htmlFor="image">Image</label>
                      <span className="field-hint">Choose an image from your computer.</span>
                      <div className="file-input-wrapper">
                        <input id="image" name="image" type="file" className="file-input" accept="image/*" ref={fileInputRef} disabled={hasAnalyzed} onChange={handleImageChange} />
                        <div className="file-visual">
                          {imagePreview ? (
                            <img src={imagePreview} alt="Preview" className="image-preview" />
                          ) : (
                            <>
                              <div className="file-icon">📷</div>
                              <div>
                                <div className="file-text-main">{hasAnalyzed ? "Image uploaded" : "Click to choose image"}</div>
                                <div className="file-text-sub">JPG, PNG or WEBP, up to 5 MB</div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="field-group">
                      <label className="field-label" htmlFor="date">Day</label>
                      <input 
                        id="date" 
                        name="date"
                        type="date" 
                        className="field-input" 
                        placeholder="Select day"
                        value={date} 
                        onChange={(e) => setDate(e.target.value)} 
                        disabled={hasAnalyzed}
                      />
                    </div>
                    <div className="field-group">
                      <label className="field-label" htmlFor="notes">Notes</label>
                      <span className="field-hint">A: pizza 30 cm. M: Coca-Cola 1 liter</span>
                      <textarea
                        id="notes"
                        name="notes"
                        className="field-input"
                        placeholder="A: pizza 30 cm. M: Coca-Cola 1 liter"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        disabled={hasAnalyzed}
                      ></textarea>
                    </div>
                    {error && <div className="error-message" style={{ color: "red", marginTop: "1rem" }}>{error}</div>}
                  </div>
                  <div className="form-actions">
                    <button type="button" className="btn-ghost" onClick={() => window.location.href = "/calories-list"}>Cancel</button>
                    <button 
                      type="button" 
                      className="btn-primary" 
                      id="primaryAction"
                      onClick={handleAnalyze}
                      disabled={isAnalyzing || hasAnalyzed}
                    >
                      {isAnalyzing ? "Analyzing..." : hasAnalyzed ? "Analyzed" : "Analyze"}
                    </button>
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="step">
                  <div className="review-section">
                    <h2 className="step-section-title">Result check</h2>
                    <p className="form-description">Review detected items, adjust user, product names and grams if needed, then save the day.</p>
                    <div className="review-items">
                      <div className="review-header">
                        <span>User</span>
                        <span>Product name</span>
                        <span>Grams</span>
                        <span></span>
                      </div>
                      <div id="itemsContainer">
                        {reviewItems.map((item, index) => {
                          const itemUser = availableUsers.find(u => u.id === item.user_id);
                          return (
                            <div key={item.id} className="review-row">
                              <button 
                                type="button" 
                                className="review-user" 
                                data-user-name={item.user}
                                onClick={() => openUserPicker(item.id)}
                              >
                                <UserAvatar user={itemUser || { username: item.user }} />
                              </button>
                              <input
                                className="review-input"
                                type="text"
                                name={`items[${index + 4}][product]`}
                                value={item.product_name}
                                readOnly
                                placeholder="Select product"
                                onClick={() => openProductPicker(item.id)}
                              />
                              <input
                                className="review-input"
                                type="text"
                                name={`items[${index + 4}][grams]`}
                                value={item.weight}
                                onChange={(e) => updateItem(item.id, { weight: e.target.value })}
                                placeholder="Grams (e.g. 100+50)"
                              />
                              <button 
                                type="button" 
                                className="btn-delete-item" 
                                aria-label="Delete item"
                                onClick={() => deleteItem(item.id)}
                              >✕</button>
                              <input type="hidden" name={`items[${index + 4}][name]`} value={item.user} />
                            </div>
                          );
                        })}
                      </div>
                      {error && <div className="error-message" style={{ color: "red", marginTop: "1rem" }}>{error}</div>}
                    </div>
                    <button type="button" className="btn-add-item" onClick={addItem}>
                      + Add one more item
                    </button>

                    {availableUsers.length > 0 && (
                      <div className="additional-calories-section" style={{ marginTop: "24px", borderTop: "1px solid var(--color-border-subtle)", paddingTop: "16px" }}>
                        <h3 className="step-section-title" style={{ fontSize: "16px" }}>Additional calories</h3>
                        <p className="form-description">Add extra calories per user (e.g. from snacks).</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "12px" }}>
                          {availableUsers.map(u => {
                            const userId = u.id;
                            return (
                              <div key={userId} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: "1" }}>
                                  <UserAvatar user={u} style={{ width: "24px", height: "24px", fontSize: "10px" }} />
                                  <span style={{ fontSize: "14px" }}>{u.username}</span>
                                </div>
                                <input
                                  className="review-input"
                                  style={{ width: "120px" }}
                                  type="number"
                                  placeholder="e.g. 200"
                                  value={userAdditionalCalories[userId] || ""}
                                  onChange={(e) => setUserAdditionalCalories({ ...userAdditionalCalories, [userId]: e.target.value })}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="form-actions">
                    <button type="button" className="btn-ghost" id="backToStep1" onClick={() => setCurrentStep(1)}>Back</button>
                    <button 
                      type="button" 
                      className="btn-primary" 
                      id="saveButton"
                      onClick={handleSave}
                      disabled={isSaving}
                    >
                      {isSaving ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* USER PICKER MODAL */}
      <div className={`user-modal-backdrop ${userModalOpen ? "is-open" : ""}`} onClick={() => setUserModalOpen(false)}>
        <div className="user-modal" onClick={(e) => e.stopPropagation()}>
          <div className="user-modal-header">
            <h3 className="user-modal-title">Select User</h3>
            <button type="button" className="user-modal-close" onClick={() => setUserModalOpen(false)}>✕</button>
          </div>
          <div className="user-modal-search">
            <input
              type="text"
              className="user-modal-search-input"
              placeholder="Search user…"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
            />
          </div>
          <div className="user-modal-list">
            {filteredUsers.map((u) => (
              <button
                key={u.id}
                type="button"
                className="user-modal-item"
                onClick={() => {
                  if (activeRowId) updateItem(activeRowId, { user_id: u.id, user: u.username });
                  setUserModalOpen(false);
                }}
              >
                <UserAvatar user={u} style={{ width: "30px", height: "30px", fontSize: "13px", fontWeight: "600" }} />
                <span className="user-modal-item-name">{u.username}</span>
              </button>
            ))}
          </div>
          {filteredUsers.length === 0 && <div className="user-modal-empty">No users found.</div>}
        </div>
      </div>

      {/* PRODUCT PICKER MODAL */}
      <div className={`user-modal-backdrop ${productModalOpen ? "is-open" : ""}`} onClick={() => setProductModalOpen(false)}>
        <div className="user-modal" onClick={(e) => e.stopPropagation()}>
          <div className="user-modal-header">
            <h3 className="user-modal-title">Select product</h3>
            <button type="button" className="user-modal-close" onClick={() => setProductModalOpen(false)}>✕</button>
          </div>
          <div className="user-modal-search">
            <input
              type="text"
              className="user-modal-search-input"
              placeholder="Search product…"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
            />
          </div>
          <div className="user-modal-list">
            {products.map((p) => (
              <button
                key={p.id}
                type="button"
                className="user-modal-item"
                onClick={() => {
                  if (activeRowId) updateItem(activeRowId, { product_id: p.id, product_name: p.name });
                  setProductModalOpen(false);
                }}
              >
                <span className="user-modal-item-name">{p.name}</span>
              </button>
            ))}
          </div>
          {products.length === 0 && <div className="user-modal-empty">No products found.</div>}
        </div>
      </div>
    </div>
  );
}
