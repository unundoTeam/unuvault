import { isHighRiskAction } from "./risk-actions";

export function shouldRequirePrimaryPassword(action: string) {
  return isHighRiskAction(action);
}
