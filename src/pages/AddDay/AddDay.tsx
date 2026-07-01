import { useState, useEffect, useRef } from "react";
import { getUsers, type UserInfo } from "../../api/auth";
import { ApiError } from "../../api/http";
import {
  createCalorieDay,
  deleteCalorieDay,
  deleteDayProduct,
  getCalorieDayDetails,
  getCalorieDayDetailsForAllUsers,
  getProducts,
  getWeightsByDate,
  ingestCalorieData,
  updateCalorieDayMeasurements,
  updateDayAdditionalCalories,
  updateDayProductWeight,
  type DayFullInfo,
  type Product,
} from "../../api/calories";
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
  persisted_product_id?: string;
  persisted_user_id?: string;
  persisted_day_id?: string;
  original_weight?: string;
}

import { Header } from "../../components/Header/Header";
import { useTheme } from "../../context/useTheme";
import React from "react";

const UserAvatar = React.memo(({ user, style }: { user: UserInfo | { username: string, avatar_url?: string | null }, style?: React.CSSProperties }) => {
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
});

export function AddDay({ user }: AddDayProps) {
  const { theme } = useTheme();
  const [currentStep, setCurrentStep] = useState(1);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingDay, setIsDeletingDay] = useState(false);
  const [isLoadingDay, setIsLoadingDay] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [deletedProducts, setDeletedProducts] = useState<{ day_id: string; product_id: string }[]>([]);
  const [availableUsers, setAvailableUsers] = useState<UserInfo[]>([]);
  const [existingDay, setExistingDay] = useState<DayFullInfo | null>(null);
  const [existingDays, setExistingDays] = useState<DayFullInfo[]>([]);

  const [date, setDate] = useState(new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString()
      .split("T")[0]);
  const [notes, setNotes] = useState("");
  const [userAdditionalCalories, setUserAdditionalCalories] = useState<Record<string, string>>({});
  const [userBodyWeight, setUserBodyWeight] = useState<Record<string, string>>({});
  const [initialBodyWeights, setInitialBodyWeights] = useState<Record<string, number | null>>({});
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imagePreviewMessage, setImagePreviewMessage] = useState<string | null>(null);
  const [visitedStep2, setVisitedStep2] = useState(false);
  const [lastSelectedUserId, setLastSelectedUserId] = useState<string | null>(user.id);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imagePreviewUrlRef = useRef<string | null>(null);

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

  const getErrorMessage = (err: unknown, fallback: string) => {
    if (err instanceof ApiError) return err.message;
    if (err instanceof Error) return err.message;
    return fallback;
  };

  const getDayUserId = (day: DayFullInfo) =>
    day.user_id ||
    (Array.isArray(day.products) ? day.products.find((p) => p.user_id)?.user_id : undefined) ||
    user.id;

  const getUserName = (userId: string) => {
    const itemUser = availableUsers.find((u) => u.id === userId);
    if (itemUser) return itemUser.username;
    return userId === user.id ? user.username : "Unknown user";
  };

  const mapExistingDayProducts = (days: DayFullInfo | DayFullInfo[]): ReviewItem[] =>
    (Array.isArray(days) ? days : [days]).flatMap((day) =>
      (Array.isArray(day.products) ? day.products : []).map((p) => {
        const userId = p.user_id || getDayUserId(day);
        const weight = String(Math.round(Number(p.weight) || 0));

        return {
          id: `existing-${day.id}-${p.id}`,
          user_id: userId,
          user: getUserName(userId),
          product_id: p.id,
          product_name: p.name,
          weight,
          persisted_product_id: p.id,
          persisted_user_id: userId,
          persisted_day_id: p.day_id || day.id,
          original_weight: weight,
        };
      }),
    );

  const mapIngestedProducts = (
    products: NonNullable<Awaited<ReturnType<typeof ingestCalorieData>>["data"]["products"]>,
  ): ReviewItem[] =>
    products.map((p, idx) => {
      const matchedUser = availableUsers.find(u => u.username.toLowerCase() === p.user.toLowerCase());
      return {
        id: `ingest-${idx}-${Date.now()}`,
        user_id: matchedUser?.id || "",
        user: p.user,
        product_id: p.product_id,
        product_name: p.name,
        weight: p.weight || "",
      };
    });

  const getCurrentUserDay = (days: DayFullInfo[]) =>
    days.find((day) => getDayUserId(day) === user.id) || days[0] || null;

  const mapExistingDayValues = (days: DayFullInfo[]) => {
    const additionalCalories: Record<string, string> = {};
    const bodyWeights: Record<string, string> = {};

    days.forEach((day) => {
      const userId = getDayUserId(day);
      additionalCalories[userId] = String(
        Math.round(Number(day.additional_calories) || 0),
      );
      if (day.body_weight != null) {
        bodyWeights[userId] = String(day.body_weight);
      }
    });

    return { additionalCalories, bodyWeights };
  };

  const loadExistingDaysForDate = async (): Promise<DayFullInfo[]> => {
    try {
      const res = await getCalorieDayDetailsForAllUsers(date);
      return Array.isArray(res.data) ? res.data : [];
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) {
        throw err;
      }
    }

    const res = await getCalorieDayDetails(date);
    return [res.data];
  };

  const clearImagePreview = () => {
    if (imagePreviewUrlRef.current) {
      URL.revokeObjectURL(imagePreviewUrlRef.current);
      imagePreviewUrlRef.current = null;
    }

    setImagePreview(null);
    setImagePreviewMessage(null);
  };

  const isHeicImage = (file: File) => {
    const fileName = file.name.toLowerCase();
    const fileType = file.type.toLowerCase();

    return (
      fileType === "image/heic" ||
      fileType === "image/heif" ||
      fileName.endsWith(".heic") ||
      fileName.endsWith(".heif")
    );
  };

  const populateExistingDays = (days: DayFullInfo[]) => {
    const currentUserDay = getCurrentUserDay(days);

    if (!currentUserDay) return;

    setExistingDay(currentUserDay);
    setExistingDays(days);
    setHasAnalyzed(false);
    setVisitedStep2(true);
    setCurrentStep(2);
    setNotes("");
    clearImagePreview();
    setDeletedProducts([]);
    setReviewItems(mapExistingDayProducts(days));
    const existingValues = mapExistingDayValues(days);
    setUserAdditionalCalories(existingValues.additionalCalories);
    setUserBodyWeight(existingValues.bodyWeights);
  };

  const resetSelectedDay = () => {
    setExistingDay(null);
    setExistingDays([]);
    setDeletedProducts([]);
    setReviewItems([]);
    setUserAdditionalCalories({});
    setVisitedStep2(false);
    setHasAnalyzed(false);
  };

  useEffect(() => {
    return () => {
      if (imagePreviewUrlRef.current) {
        URL.revokeObjectURL(imagePreviewUrlRef.current);
        imagePreviewUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    setUserBodyWeight({});
    setInitialBodyWeights({});

    getWeightsByDate(date)
        .then((res) => {
          const items = res.data;

          if (Array.isArray(items)) {
            const map: Record<string, number | null> = {};

            items.forEach((item) => {
              map[item.user_id] = item.body_weight;
            });

            setInitialBodyWeights(map);
          } else {
            setInitialBodyWeights({});
          }
        })
        .catch((err) => {
          console.error("Failed to fetch initial body weights", err);
          setInitialBodyWeights({});
        });
  }, [date]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    clearImagePreview();

    if (!file) {
      return;
    }

    if (isHeicImage(file)) {
      setImagePreviewMessage(`${file.name} selected. HEIC preview is not supported in this browser.`);
      return;
    }

    const url = URL.createObjectURL(file);
    imagePreviewUrlRef.current = url;
    setImagePreview(url);
  };

  const handleImagePreviewError = () => {
    clearImagePreview();
    setImagePreviewMessage("Image selected, but this browser cannot preview this format.");
  };

  const handleAnalyze = async () => {
    const file = fileInputRef.current?.files?.[0];
    const hasInputToAnalyze = Boolean(file || notes.trim());

    setError(null);

    if (!hasInputToAnalyze) {
      setIsLoadingDay(true);

      try {
        const existingDays = await loadExistingDaysForDate();
        if (existingDays.length > 0) {
          populateExistingDays(existingDays);
          return;
        }
      } catch (err) {
        if (!(err instanceof ApiError && err.status === 404)) {
          setError("Load failed: " + getErrorMessage(err, "Unknown error"));
          return;
        }

        setExistingDay(null);
        setExistingDays([]);
        setDeletedProducts([]);
      } finally {
        setIsLoadingDay(false);
      }

      setVisitedStep2(true);
      setCurrentStep(2);
      return;
    }

    setIsAnalyzing(true);
    setDeletedProducts([]);
    const formData = new FormData();
    if (file) formData.append("image", file);
    if (notes.trim()) formData.append("description", notes);

    try {
      let existingDaysForDate: DayFullInfo[] = [];
      try {
        existingDaysForDate = await loadExistingDaysForDate();
      } catch (err) {
        if (!(err instanceof ApiError && err.status === 404)) {
          throw err;
        }
      }

      const res = await ingestCalorieData(formData);
      setHasAnalyzed(true);
      setVisitedStep2(true);
      const currentUserDay = getCurrentUserDay(existingDaysForDate);
      setExistingDay(currentUserDay);
      setExistingDays(existingDaysForDate);
      const existingValues = mapExistingDayValues(existingDaysForDate);
      setUserAdditionalCalories(existingValues.additionalCalories);
      setUserBodyWeight(existingValues.bodyWeights);

      const existingItems = mapExistingDayProducts(existingDaysForDate);
      const ingestedItems = res.data?.products ? mapIngestedProducts(res.data.products) : [];
      setReviewItems([...existingItems, ...ingestedItems]);
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
      if (!isNaN(num)) formattedAdditionalCalories[userId] = num;
    });

    const formattedBodyWeights: Record<string, number> = {};
    Object.entries(userBodyWeight).forEach(([userId, val]) => {
      const num = parseFloat(val);
      if (!isNaN(num) && num > 0) {
        const initial = initialBodyWeights[userId];

        if (initial === null || num !== initial) {
          formattedBodyWeights[userId] = num;
        }
      }
    });

    try {
      const daysForSave = existingDays.length > 0 ? existingDays : existingDay ? [existingDay] : [];

      if (daysForSave.length > 0) {
        const dayByUserId = new Map(
          daysForSave.map((day) => [getDayUserId(day), day] as const),
        );

        for (const deletedProduct of deletedProducts) {
          await deleteDayProduct(deletedProduct.day_id, deletedProduct.product_id);
        }

        const productsToCreate = [];

        for (const item of reviewItems) {
          const weight = Number(item.weight);
          if (!Number.isInteger(weight) || weight <= 0) {
            setError("Product weights must be positive whole numbers.");
            return;
          }

          const persistedProductId = item.persisted_product_id;
          const persistedUserId = item.persisted_user_id ?? user.id;
          const persistedDayId =
            item.persisted_day_id ?? dayByUserId.get(persistedUserId)?.id ?? daysForSave[0].id;
          const changedExistingProduct =
            Boolean(persistedProductId) &&
            (item.product_id !== persistedProductId || item.user_id !== persistedUserId);

          if (changedExistingProduct && persistedProductId) {
            if (!deletedProducts.some((p) => p.day_id === persistedDayId && p.product_id === persistedProductId)) {
              await deleteDayProduct(persistedDayId, persistedProductId);
            }
            productsToCreate.push({
              user_id: item.user_id,
              product_id: item.product_id,
              weight: item.weight,
            });
            continue;
          }

          if (item.persisted_product_id) {
            if (String(weight) !== item.original_weight) {
              await updateDayProductWeight(persistedDayId, item.product_id, weight);
            }
            continue;
          }

          productsToCreate.push({
            user_id: item.user_id,
            product_id: item.product_id,
            weight: item.weight,
          });
        }

        for (const day of daysForSave) {
          const dayUserId = getDayUserId(day);
          const additionalCaloriesRaw = userAdditionalCalories[dayUserId];

          if (additionalCaloriesRaw !== undefined) {
            const additionalCaloriesValue =
              additionalCaloriesRaw === "" ? 0 : Number(additionalCaloriesRaw);
            if (!Number.isFinite(additionalCaloriesValue) || additionalCaloriesValue < 0) {
              setError("Additional calories must be zero or greater.");
              return;
            }

            if (additionalCaloriesValue !== Number(day.additional_calories)) {
              await updateDayAdditionalCalories(day.id, additionalCaloriesValue);
            }
          }

          const bodyWeightValue = userBodyWeight[dayUserId];
          if (bodyWeightValue !== undefined && bodyWeightValue !== "") {
            const nextBodyWeight = Number(bodyWeightValue);
            if (!Number.isFinite(nextBodyWeight) || nextBodyWeight <= 0) {
              setError("Body weight must be greater than zero.");
              return;
            }
            if (nextBodyWeight !== Number(day.body_weight)) {
              await updateCalorieDayMeasurements(day.id, {
                body_weight: nextBodyWeight,
              });
            }
          }
        }

        const additionalCaloriesToCreate = Object.fromEntries(
          Object.entries(formattedAdditionalCalories).filter(([userId]) => !dayByUserId.has(userId)),
        );
        const bodyWeightsToCreate = Object.fromEntries(
          Object.entries(formattedBodyWeights).filter(([userId]) => !dayByUserId.has(userId)),
        );

        if (
          productsToCreate.length > 0 ||
          Object.keys(additionalCaloriesToCreate).length > 0 ||
          Object.keys(bodyWeightsToCreate).length > 0
        ) {
          await createCalorieDay({
            date,
            user_additional_calories: additionalCaloriesToCreate,
            user_body_weight: bodyWeightsToCreate,
            products: productsToCreate,
          });
        }
      } else {
        await createCalorieDay({
          date,
          user_additional_calories: formattedAdditionalCalories,
          user_body_weight: formattedBodyWeights,
          all_body_weights: formattedBodyWeights,
          products: reviewItems.map(item => ({
            user_id: item.user_id,
            product_id: item.product_id,
            weight: item.weight
            }))
        });
      }

      window.location.href = "/calories-list";
      } catch (err) {
        console.error(err);
        setError("Save failed: " + getErrorMessage(err, "Unknown error"));
      } finally {
        setIsSaving(false);
      }
    };

  const handleDeleteDay = async () => {
    const daysToDelete = existingDays.length > 0 ? existingDays : existingDay ? [existingDay] : [];
    if (daysToDelete.length === 0) return;

    const confirmed = window.confirm(
      `Delete the day for ${date} for all users and all of its products?`,
    );
    if (!confirmed) return;

    setIsDeletingDay(true);
    setError(null);

    try {
      for (const dayId of [...new Set(daysToDelete.map((day) => day.id))]) {
        await deleteCalorieDay(dayId);
      }
      window.location.href = "/calories-list";
    } catch (err) {
      console.error(err);
      setError("Delete failed: " + getErrorMessage(err, "Unknown error"));
    } finally {
      setIsDeletingDay(false);
    }
  };

  const addItem = () => {
    const defaultUser =
        availableUsers.find(u => u.id === lastSelectedUserId) ||
        availableUsers.find(u => u.id === user.id) ||
        availableUsers[0];

    setReviewItems([
      ...reviewItems,
      {
        id: `manual-${Date.now()}`,
        user_id: defaultUser?.id || "",
        user: defaultUser?.username || "Select User",
        product_id: "",
        product_name: "",
        weight: "",
      },
    ]);
  };

  const deleteItem = (id: string) => {
    const item = reviewItems.find((reviewItem) => reviewItem.id === id);
    if (item?.persisted_product_id && item.persisted_day_id) {
      setDeletedProducts((prev) =>
        prev.some((p) => p.day_id === item.persisted_day_id && p.product_id === item.persisted_product_id)
          ? prev
          : [...prev, { day_id: item.persisted_day_id!, product_id: item.persisted_product_id! }],
      );
    }
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
  const usersForDayInputs = availableUsers;

  const hasAdditionalCalories = Object.values(userAdditionalCalories).some(val => {
    const num = parseFloat(val);
    return !isNaN(num) && num !== 0;
  });

  const hasBodyWeightChanged = Object.values(userBodyWeight).some(val => {
    const num = parseFloat(val);
    return !isNaN(num) && num !== 0;
  });

  const hasInvalidItems = reviewItems.some(item => {
    const weightNum = parseFloat(item.weight);

    return (
        !item.user_id ||
        !item.product_id ||
        !item.weight ||
        isNaN(weightNum) ||
        weightNum <= 0
    );
  });

  const isSaveDisabled =
      isSaving ||
      isLoadingDay ||
      hasInvalidItems ||
      (
          !existingDay &&
          existingDays.length === 0 &&
          reviewItems.length === 0 &&
          !hasAdditionalCalories &&
          !hasBodyWeightChanged
      );

  return (
    <div className={`add-day-page theme-${theme}`}>
      <Header user={user} profileUrl="/calories/profile" />

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
                        <input id="image" name="image" type="file" className="file-input" accept="image/*,.heic,.heif" ref={fileInputRef} disabled={hasAnalyzed} onChange={handleImageChange} />
                        <div className="file-visual">
                          {imagePreview ? (
                            <img src={imagePreview} alt="Preview" className="image-preview" onError={handleImagePreviewError} />
                          ) : imagePreviewMessage ? (
                            <>
                              <div className="file-icon">✓</div>
                              <div>
                                <div className="file-text-main">Image selected</div>
                                <div className="file-text-sub">{imagePreviewMessage}</div>
                              </div>
                            </>
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
                        onChange={(e) => {
                          setDate(e.target.value);
                          resetSelectedDay();
                        }}
                        disabled={hasAnalyzed && !existingDay}
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
                    {isLoadingDay && <div className="form-description">Loading selected day...</div>}
                    {error && <div className="error-message" style={{ color: "red", marginTop: "1rem" }}>{error}</div>}
                  </div>
                  <div className="form-actions">
                    <button type="button" className="btn-ghost" onClick={() => window.location.href = "/calories-list"}>Cancel</button>
                    <button 
                      type="button" 
                      className="btn-primary" 
                      id="primaryAction"
                      onClick={handleAnalyze}
                      disabled={isAnalyzing || isLoadingDay || hasAnalyzed}
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
                    {isLoadingDay && <div className="form-description">Loading selected day...</div>}
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
                                onFocus={(e) => { if (e.target.value === "0") updateItem(item.id, { weight: "" }); }}
                                onChange={(e) => updateItem(item.id, { weight: e.target.value })}
                                placeholder="0"
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

                    {usersForDayInputs.length > 0 && (
                      <div className="additional-calories-section" style={{ marginTop: "24px", borderTop: "1px solid var(--color-border-subtle)", paddingTop: "16px" }}>
                        <h3 className="step-section-title" style={{ fontSize: "16px" }}>Additional calories</h3>
                        <p className="form-description">Add extra calories per user (e.g. from snacks).</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "12px" }}>
                          {usersForDayInputs.map(u => {
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
                                  placeholder="0"
                                  value={userAdditionalCalories[userId] || ""}
                                  onFocus={(e) => { if (e.target.value === "0") setUserAdditionalCalories({ ...userAdditionalCalories, [userId]: "" }); }}
                                  onChange={(e) => setUserAdditionalCalories({ ...userAdditionalCalories, [userId]: e.target.value })}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {usersForDayInputs.length > 0 && (
                        <div className="body-weight-section" style={{ marginTop: "24px", borderTop: "1px solid var(--color-border-subtle)", paddingTop: "16px" }}>
                          <h3 className="step-section-title" style={{ fontSize: "16px" }}>Body Weight</h3>
                          <p className="form-description">Record or update body weights (kg) for this day.</p>
                          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "12px" }}>
                            {usersForDayInputs.map(u => {
                              const userId = u.id;
                              const initialWeight = initialBodyWeights[userId];

                              const displayValue = userBodyWeight[userId] !== undefined
                                  ? userBodyWeight[userId]
                                  : (initialWeight !== null && initialWeight !== undefined
                                      ? String(initialWeight)
                                      : "");

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
                                        step="0.1"
                                        placeholder={initialWeight ? String(initialWeight) : "-"}
                                        value={displayValue}
                                        onFocus={(e) => {
                                          if (e.target.value === "0" || e.target.value === String(initialWeight)) {
                                            setUserBodyWeight({ ...userBodyWeight, [userId]: "" });
                                          }
                                        }}
                                        onChange={(e) =>
                                            setUserBodyWeight({ ...userBodyWeight, [userId]: e.target.value })
                                        }
                                    />
                                  </div>
                              );
                            })}
                          </div>
                        </div>
                    )}
                  </div>
                  <div className="form-actions">
                    {(existingDay || existingDays.length > 0) && (
                        <button
                            type="button"
                            className="btn-danger"
                            onClick={handleDeleteDay}
                            disabled={isDeletingDay || isSaving}
                        >
                          {isDeletingDay ? "Deleting..." : "Delete day"}
                        </button>
                    )}
                    <button type="button" className="btn-ghost" id="backToStep1" onClick={() => setCurrentStep(1)}>Back</button>
                    <button 
                      type="button" 
                      className="btn-primary" 
                      id="saveButton"
                      onClick={handleSave}
                      disabled={isSaveDisabled || isDeletingDay}
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
                  if (activeRowId) {
                    updateItem(activeRowId, { user_id: u.id, user: u.username });
                    setLastSelectedUserId(u.id);
                  }
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
