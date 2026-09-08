// One semantic map for all navigation, KPI, header, and empty-state icons.
// CSS owns the visual tokens; modules only declare their business meaning.
export const moduleIconConfig = {
  dashboard: { tone: "emerald" },
  serviceCockpit: { tone: "indigo" },
  tables: { tone: "sky" },
  orders: { tone: "amber" },
  onlineOrders: { tone: "pink" },
  kitchen: { tone: "rose" },
  menu: { tone: "teal" },
  categories: { tone: "amber" },
  customers: { tone: "pink" },
  loyalty: { tone: "violet" },
  staff: { tone: "sky" },
  inventory: { tone: "violet" },
  procurement: { tone: "teal" },
  billing: { tone: "emerald" },
  payments: { tone: "emerald" },
  reports: { tone: "indigo" },
  notifications: { tone: "rose" },
  settings: { tone: "slate" },
  logout: { tone: "rose" },
  default: { tone: "slate" },
};

export const getModuleIconTone = (moduleName) => moduleIconConfig[moduleName]?.tone || moduleIconConfig.default.tone;
