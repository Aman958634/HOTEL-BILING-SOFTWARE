import { cloneElement, isValidElement } from "react";
import { getModuleIconTone, moduleIconConfig } from "./moduleIconConfig";

// Semantic icon colors stay central so modules do not each invent a visual system.
const MODULE_ICON_TONES = {
  dashboard: "module-icon--emerald",
  orders: "module-icon--amber",
  tables: "module-icon--sky",
  kitchen: "module-icon--rose",
  menu: "module-icon--teal",
  inventory: "module-icon--violet",
  staff: "module-icon--sky",
  customers: "module-icon--pink",
  reports: "module-icon--indigo",
  payments: "module-icon--emerald",
  procurement: "module-icon--amber",
  settings: "module-icon--slate",
  notifications: "module-icon--rose",
  emerald: "module-icon--emerald",
  amber: "module-icon--amber",
  sky: "module-icon--sky",
  rose: "module-icon--rose",
  violet: "module-icon--violet",
  indigo: "module-icon--indigo",
  slate: "module-icon--slate",
  default: "module-icon--slate",
};

const ModuleIcon = ({ icon, module, tone, variant = "card", className = "" }) => {
  const resolvedTone = tone ? (moduleIconConfig[tone] ? getModuleIconTone(tone) : tone) : getModuleIconTone(module);
  const glyph = isValidElement(icon)
    ? cloneElement(icon, {
      "aria-hidden": true,
      className: `module-icon__glyph ${icon.props.className || ""}`.trim(),
    })
    : icon;

  return <span className={`module-icon module-icon--${variant} ${MODULE_ICON_TONES[resolvedTone] || MODULE_ICON_TONES.default} ${className}`.trim()} aria-hidden="true">{glyph}</span>;
};

export default ModuleIcon;
