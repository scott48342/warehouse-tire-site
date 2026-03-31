/**
 * Classic Mode UI Components
 * 
 * Components for displaying classic vehicle fitment information.
 * 
 * TRIGGER RULE:
 * These components should ONLY be rendered when the vehicle
 * resolves through the classic_fitments table with isClassicVehicle = true.
 * 
 * Modern vehicles should NEVER see these components.
 */

export { ClassicModeBanner, type ClassicModeBannerProps } from "./ClassicModeBanner";
export {
  ClassicConfidenceBadge,
  type ClassicConfidenceLevel,
  type ClassicConfidenceBadgeProps,
} from "./ClassicConfidenceBadge";
export {
  ClassicFitmentCard,
  type ClassicFitmentData,
  type ClassicFitmentCardProps,
} from "./ClassicFitmentCard";
export {
  ClassicModificationWarning,
  type ModificationRisk,
  type ClassicModificationWarningProps,
} from "./ClassicModificationWarning";
export {
  ClassicVerificationCheckbox,
  useClassicVerification,
  type ClassicVerificationCheckboxProps,
} from "./ClassicVerificationCheckbox";
export { ClassicModeSection, type ClassicModeSectionProps } from "./ClassicModeSection";
export {
  ClassicTireRecommendations,
  type TireSizeRecommendation,
  type ClassicTireRecommendationsProps,
} from "./ClassicTireRecommendations";
