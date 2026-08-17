/** Operator-tunable platform gating configuration — the admin "CRM of settings". */
export interface PlatformSettingsView {
  /** Extra (non-profile-pic) photos a restricted viewer may see of a premium+vetted member. */
  freeViewMaxExtraPhotos: number;
  /** Max premium+vetted connections a free+vetted member may hold. */
  freePremiumConnectionLimit: number;
  /** Profile fields withheld from restricted (free+vetted) viewers. */
  restrictedHiddenFields: string[];
}

export interface UpdateSettingsInput {
  freeViewMaxExtraPhotos?: number;
  freePremiumConnectionLimit?: number;
  restrictedHiddenFields?: string[];
}

/** The only fields that may be placed in `restrictedHiddenFields`. */
export const GATED_FIELDS = ['nationality', 'profession', 'educationLevel', 'dateOfBirth'] as const;
export type GatedField = (typeof GATED_FIELDS)[number];
