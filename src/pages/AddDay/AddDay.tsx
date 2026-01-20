import { useState, useEffect, useRef } from "react";
import type { UserInfo } from "../../api/auth";
import { getApps, type AppDTO } from "../../api/apps";
import { ingestCalorieData, createCalorieDay, getProducts, type DayProduct } from "../../api/calories";
import "./AddDay.css";

interface AddDayProps {
  user: UserInfo;
}

interface ReviewItem {
  id: string;
  user: string;
  product_id: string;
  product_name: string;
  weight: number;
}

export function AddDay({ user }: AddDayProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [apps, setApps] = useState<AppDTO[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal states
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [products, setProducts] = useState<DayProduct[]>([]);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);

  useEffect(() => {
    getApps().then((res) => {
      const list = Array.isArray(res.data) ? res.data : [res.data];
      setApps(list);
    });
  }, []);

  const handleAnalyze = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file && !notes) {
      setCurrentStep(2);
      return;
    }

    setIsAnalyzing(true);
    const formData = new FormData();
    if (file) formData.append("image", file);
    if (notes) formData.append("description", notes);

    try {
      const res = await ingestCalorieData(formData);
      setHasAnalyzed(true);
      if (res.data && res.data.products) {
        const items: ReviewItem[] = res.data.products.map((p, idx) => ({
          id: `ingest-${idx}-${Date.now()}`,
          user: p.user,
          product_id: p.product_id,
          product_name: p.name,
          weight: parseInt(p.weight) || 0,
        }));
        setReviewItems(items);
      }
      setCurrentStep(2);
    } catch (err) {
      console.error(err);
      alert("Analysis failed: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await createCalorieDay({
        date,
        notes,
        products: reviewItems.map(item => ({
          product_id: item.product_id,
          weight: item.weight
        }))
      });
      alert("Day record saved successfully!");
      window.location.href = "/calories";
    } catch (err) {
      console.error(err);
      alert("Save failed: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setIsSaving(false);
    }
  };

  const addItem = () => {
    const defaultUser = apps[0]?.name || "Breakfast";
    setReviewItems([
      ...reviewItems,
      {
        id: `manual-${Date.now()}`,
        user: defaultUser,
        product_id: "",
        product_name: "",
        weight: 0,
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
    fetchProducts("");
  };

  const fetchProducts = async (q: string) => {
    try {
      const res = await getProducts(q);
      setProducts(res.data.data);
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

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  const filteredUsers = apps.filter((u) =>
    u.name.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="add-day-page theme-light">
      <header className="header">
        <div className="container header-inner">
          <div className="header-left">
            <div className="logo-icon"></div>
            <div className="logo-text">ServiceHub</div>
          </div>
          <div className="header-center">
            <div className="search">
              <div className="search-icon"></div>
              <input className="search-input" type="text" placeholder="Search services…" />
            </div>
          </div>
          <div className="header-right">
            <button className="icon-button icon-button--search" aria-label="Search">🔍</button>
            <button className="icon-button icon-button--bell" aria-label="Notifications">
              <span className="icon-bell" aria-hidden="true"></span>
            </button>
            <div className="avatar-block">
              <img className="avatar-image" src="/profile.webp" alt={`${user.username} profile`} loading="lazy" />
              <div className="avatar-name">{user.username}</div>
            </div>
          </div>
        </div>
      </header>

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
                onClick={() => hasAnalyzed && setCurrentStep(2)}
                disabled={!hasAnalyzed}
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
                      <span className="field-hint">Optional. Choose an image from your computer.</span>
                      <div className="file-input-wrapper">
                        <input id="image" name="image" type="file" className="file-input" accept="image/*" ref={fileInputRef} disabled={hasAnalyzed} />
                        <div className="file-visual">
                          <div className="file-icon">📷</div>
                          <div>
                            <div className="file-text-main">{hasAnalyzed ? "Image uploaded" : "Click to choose image"}</div>
                            <div className="file-text-sub">JPG, PNG or WEBP, up to 5 MB</div>
                          </div>
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
                      <span className="field-hint">Short description, meals, comments or anything you want to remember.</span>
                      <textarea
                        id="notes"
                        name="notes"
                        className="field-input"
                        placeholder="For example: gym day, higher protein, dinner out with friends…"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        disabled={hasAnalyzed}
                      ></textarea>
                    </div>
                  </div>
                  <div className="form-actions">
                    <button type="button" className="btn-ghost" onClick={() => window.location.href = "/calories"}>Cancel</button>
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
                        {reviewItems.length === 0 && (
                          <>
                            <div className="review-row">
                              <button 
                                type="button" 
                                className="review-user" 
                                data-user-name="Breakfast"
                                onClick={() => alert("Please use 'Add one more item' or 'Analyze' to add items")}
                              >
                                <span className="review-avatar">B</span>
                              </button>
                              <input
                                className="review-input"
                                type="text"
                                name="items[1][product]"
                                value="Oatmeal with berries"
                                readOnly
                              />
                              <input
                                className="review-input"
                                type="number"
                                name="items[1][grams]"
                                value="320"
                                readOnly
                              />
                              <button type="button" className="btn-delete-item" aria-label="Delete item">✕</button>
                              <input type="hidden" name="items[1][name]" value="Breakfast" />
                            </div>
                            <div className="review-row">
                              <button type="button" className="review-user" data-user-name="Lunch">
                                <span className="review-avatar">L</span>
                              </button>
                              <input
                                className="review-input"
                                type="text"
                                name="items[2][product]"
                                value="Chicken breast & rice"
                                readOnly
                              />
                              <input
                                className="review-input"
                                type="number"
                                name="items[2][grams]"
                                value="280"
                                readOnly
                              />
                              <button type="button" className="btn-delete-item" aria-label="Delete item">✕</button>
                              <input type="hidden" name="items[2][name]" value="Lunch" />
                            </div>
                            <div className="review-row">
                              <button type="button" className="review-user" data-user-name="Dinner">
                                <span className="review-avatar">D</span>
                              </button>
                              <input
                                className="review-input"
                                type="text"
                                name="items[3][product]"
                                value="Salad & yogurt"
                                readOnly
                              />
                              <input
                                className="review-input"
                                type="number"
                                name="items[3][grams]"
                                value="250"
                                readOnly
                              />
                              <button type="button" className="btn-delete-item" aria-label="Delete item">✕</button>
                              <input type="hidden" name="items[3][name]" value="Dinner" />
                            </div>
                          </>
                        )}
                        {reviewItems.map((item, index) => (
                          <div key={item.id} className="review-row">
                            <button 
                              type="button" 
                              className="review-user" 
                              data-user-name={item.user}
                              onClick={() => openUserPicker(item.id)}
                            >
                              <span className="review-avatar">{getInitials(item.user)}</span>
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
                              type="number"
                              name={`items[${index + 4}][grams]`}
                              value={item.weight}
                              onChange={(e) => updateItem(item.id, { weight: parseInt(e.target.value) || 0 })}
                              min="0"
                            />
                            <button 
                              type="button" 
                              className="btn-delete-item" 
                              aria-label="Delete item"
                              onClick={() => deleteItem(item.id)}
                            >✕</button>
                            <input type="hidden" name={`items[${index + 4}][name]`} value={item.user} />
                          </div>
                        ))}
                      </div>
                    </div>
                    <button type="button" className="btn-add-item" onClick={addItem}>
                      + Add one more item
                    </button>
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
            <h3 className="user-modal-title">Select category</h3>
            <button type="button" className="user-modal-close" onClick={() => setUserModalOpen(false)}>✕</button>
          </div>
          <div className="user-modal-search">
            <input
              type="text"
              className="user-modal-search-input"
              placeholder="Search category…"
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
                  if (activeRowId) updateItem(activeRowId, { user: u.name });
                  setUserModalOpen(false);
                }}
              >
                <span className="user-modal-item-avatar">{getInitials(u.name)}</span>
                <span className="user-modal-item-name">{u.name}</span>
              </button>
            ))}
          </div>
          {filteredUsers.length === 0 && <div className="user-modal-empty">No categories found.</div>}
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
