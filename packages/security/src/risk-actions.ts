export const highRiskActions = [
  "vault_export",
  "revoke_device",
  "change_primary_password",
] as const;

export type RiskAction = (typeof highRiskActions)[number];

export function isHighRiskAction(action: string) {
  return highRiskActions.includes(action as RiskAction);
}
