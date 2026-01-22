import { authHttp } from "./http";

type ResponseDTO<T> = {
  data: T;
};

type PaginationDTO<T> = {
  page_count: number;
  total_count: number;
  data: T[];
};

export type TrendType = "weight" | "calorie";

export type TrendItem = {
  date: string; // YYYY-MM-DD
  value: string | number;
};

export type TrendItemsParams = {
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  type: TrendType;
};

export type CalorieDateRangeFilters = {
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
};

export type NameCode = {
  name: string;
  code: string;
};

export type DaysSortBy = "most_recent" | "oldest" | "most_calories" | "lowest_weight";

export type DayProduct = {
  id: string;
  name: string;
  weight: string | number;
  proteins: string | number;
  fats: string | number;
  carbs: string | number;
  calories: string | number;
};

export type DayFullInfo = {
  id: string;
  body_weight: string | number | null;
  body_fat: string | number | null;
  trend: string | number | null;
  created_at: string; // ISO datetime
  total_proteins: string | number;
  total_fats: string | number;
  total_carbs: string | number;
  total_calories: string | number;
  products: DayProduct[];
};

export type CalorieDaysParams = {
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  sort_by: DaysSortBy;
  page?: number;
};

// GET /calorie/sort_bys — returns available sorting options for /calorie/days
export function getCalorieSortBys() {
  return authHttp<ResponseDTO<NameCode[]>>("/calorie/sort_bys", {
    method: "GET",
  });
}

// Backend: ../main-be FastAPI
// GET /calorie/trend/items — endpoint used for the calories/weight graph.
export function getCalorieTrendItems(params: TrendItemsParams) {
  const query = new URLSearchParams({
    start_date: params.start_date,
    end_date: params.end_date,
    type: params.type,
  });

  return authHttp<ResponseDTO<TrendItem[]>>(`/calorie/trend/items?${query.toString()}`,
  {
    method: "GET",
  });
}

// GET /calorie/filters/date-range — returns available start/end dates for filters.
export function getCalorieDateRangeFilters() {
  return authHttp<ResponseDTO<CalorieDateRangeFilters>>("/calorie/filters/date-range", {
    method: "GET",
  });
}

// GET /calorie/days — paginated daily overview incl. product list per day.
export function getCalorieDays(params: CalorieDaysParams) {
  const query = new URLSearchParams({
    start_date: params.start_date,
    end_date: params.end_date,
    sort_by: params.sort_by,
    page: String(params.page ?? 1),
  });

  return authHttp<ResponseDTO<PaginationDTO<DayFullInfo>>>(`/calorie/days?${query.toString()}`,
  {
    method: "GET",
  });
}

export type IngestProductMatch = {
  user: string;
  product_id: string;
  name: string;
  weight: string;
  matched_score: number;
};

export type IngestResponse = {
  products: IngestProductMatch[];
  warnings: string[];
  unparsed: string[];
};

export function ingestCalorieData(formData: FormData) {
  return authHttp<ResponseDTO<IngestResponse>>("/calorie/ingest", {
    method: "POST",
    body: formData,
    // Note: authHttp in http.ts sets Content-Type: application/json by default.
    // We need to ensure it doesn't do that for FormData.
  });
}

export type DayProductInput = {
  user_id: string;
  product_id: string;
  weight: string;
};

export type CreateDayRequest = {
  date: string; // YYYY-MM-DD
  notes?: string;
  body_weight?: number;
  body_fat?: number;
  products: DayProductInput[];
};

export function createCalorieDay(body: CreateDayRequest) {
  return authHttp<ResponseDTO<{ id: string }>>("/calorie/add_day", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getProducts(q: string = "", page: number = 1) {
  const query = new URLSearchParams({
    q,
    page: String(page),
  });
  return authHttp<ResponseDTO<PaginationDTO<DayProduct>>>(`/calorie/products?${query.toString()}`, {
    method: "GET",
  });
}
