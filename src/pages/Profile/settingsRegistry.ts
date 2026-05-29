import type { AllSettingsResponseDTO, CalorieSettingDTO } from "../../api/settings";

export type SettingsScope = "all" | "calorie";
export type SettingGroupKey = keyof AllSettingsResponseDTO;

type SettingOption<TGroup extends SettingGroupKey> = {
  key: keyof AllSettingsResponseDTO[TGroup] & string;
  label: string;
  description: string;
};

export type AppSettingsGroup<TGroup extends SettingGroupKey = SettingGroupKey> = {
  appKey: SettingsScope;
  appRoute: string;
  appNameFallback: string;
  settingGroupKey: TGroup;
  settings: SettingOption<TGroup>[];
};

export const CALORIES_APP_ID = "972fe6d8-e15c-44b0-ade4-2ceafa16789d";

export const APP_SETTINGS_GROUPS: AppSettingsGroup[] = [
  {
    appKey: "calorie",
    appRoute: "/calories",
    appNameFallback: "Calories",
    settingGroupKey: "calorie_setting",
    settings: [
      {
        key: "add_day_notes" satisfies keyof CalorieSettingDTO,
        label: "Add day notes",
        description: "Show notes while creating a day from text or an image.",
      },
      {
        key: "ai_creates_products" satisfies keyof CalorieSettingDTO,
        label: "AI creates products",
        description: "Allow AI analysis to create missing products during intake review.",
      },
    ],
  },
];

export function getSettingsGroupsForScope(scope: SettingsScope) {
  if (scope === "all") return APP_SETTINGS_GROUPS;
  return APP_SETTINGS_GROUPS.filter((group) => group.appKey === scope);
}
