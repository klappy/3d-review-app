export interface TranslationAgreement {
  team_values: unknown[];
  church_values: unknown[];
  team_statuses?: unknown[];
  church_statuses?: unknown[];
  agree: boolean | null;
  [key: string]: unknown;
}
export function translationAgreementFor(payload: unknown, minimum?: number): TranslationAgreement | null;
export function discloseTranslationAgreement(payload: unknown, minimum?: number): unknown;
