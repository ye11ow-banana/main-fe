import { authHttp } from "./http";

type ResponseDTO<T> = {
  data: T;
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
