import { authHttp } from "./http";

type ResponseDTO<T> = {
  data: T;
};

export type CalorieSettingDTO = {
  add_day_notes: boolean;
  ai_creates_products: boolean;
};

export type AllSettingsResponseDTO = {
  calorie_setting: CalorieSettingDTO;
};

export type UpdateCalorieSettingDTO = Partial<CalorieSettingDTO>;

export type UpdateSettingsRequestDTO = {
  calorie_setting?: UpdateCalorieSettingDTO;
};

export type SuccessDTO = {
  success: boolean;
};

export function getAllSettings(): Promise<ResponseDTO<AllSettingsResponseDTO>> {
  return authHttp<ResponseDTO<AllSettingsResponseDTO>>("/settings", {
    method: "GET",
  });
}

export function updateSettings(
  body: UpdateSettingsRequestDTO,
): Promise<ResponseDTO<SuccessDTO>> {
  return authHttp<ResponseDTO<SuccessDTO>>("/settings", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
