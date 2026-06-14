// Jake Components - Conversational Fitment Assistant
export { JakeChat, default as JakeChatDefault } from "./JakeChat";
export { JakeAvatar } from "./JakeAvatar";
export { JakeProductCard, JakePackageCard, JakeWheelCard, JakeTireGrid } from "./JakeProductCards";
export { 
  JakeHomepageSection, 
  JakeCompactBanner, 
  JakeFloatingButton,
  JakeHeaderLink 
} from "./JakeHomepageSection";
export { JakeComparePanel, CompareButton, CompareFloatingBar } from "./JakeComparePanel";
export { 
  trackJakeEvent, 
  useJakeAnalytics, 
  trackJakePackageView,
  trackJakePackageClick,
  trackJakePackageAddToCart,
  type JakeEventType 
} from "./JakeAnalytics";
export type { MerchandisingBadge, ParsedProduct } from "./JakeProductCards";
export { ProductRail, ProductCarousel, type RailProduct } from "./ProductRail";
export { VehicleChip, VehicleChipCompact } from "./VehicleChip";
export { JakeMockupCard } from "./JakeMockupCard";
