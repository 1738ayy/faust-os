export type BusinessRole = "owner" | "admin" | "operations" | "finance" | "fulfillment" | "viewer";
export type BusinessAccess = { id: string; role: BusinessRole };
export type BusinessCapability = "membership" | "catalog" | "purchasing" | "receiving" | "listing" | "fulfillment" | "finance" | "automation" | "read";
const permissions: Record<BusinessCapability, BusinessRole[]> = {
  read: ["owner", "admin", "operations", "finance", "fulfillment", "viewer"], membership: ["owner"], catalog: ["owner", "admin", "operations"], purchasing: ["owner", "admin", "operations"], receiving: ["owner", "admin", "operations"], listing: ["owner", "admin", "operations"], fulfillment: ["owner", "admin", "fulfillment"], finance: ["owner", "admin", "finance"], automation: ["owner", "admin"],
};
export function chooseActiveBusiness(selectedId: string | undefined, businesses: BusinessAccess[]) { return businesses.find((business) => business.id === selectedId) ?? businesses[0]; }
export function canPerform(role: BusinessRole, capability: BusinessCapability) { return permissions[capability].includes(role); }
export function canMutateBusiness(role: BusinessRole) { return role !== "viewer"; }
