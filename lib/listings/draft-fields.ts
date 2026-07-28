import type { ChannelListingDraft, MarketplaceListingDraftField, OperatingData } from "../../domain/business";
import type { GeneratedMarketplaceField, MarketplaceDraftInspector } from "../marketplace-intelligence/types";

export type ListingDraftEditableValue = MarketplaceListingDraftField["currentValue"];

const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();

export function ensureDraftFieldCollections(data: OperatingData) {
  data.marketplaceListingDraftFields ||= [];
  data.marketplaceListingDraftRevisions ||= [];
}

function toPersistedValue(value: unknown): ListingDraftEditableValue {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === "string");
  return String(value);
}

function sourceFor(field: GeneratedMarketplaceField): MarketplaceListingDraftField["source"] {
  if (field.source === "marketplace_default") return field.sourcePath === "categoryAccountDefault" ? "category_default" : "account_default";
  if (field.source === "user_override") return "product_override";
  if (field.source === "derived") return "mapping";
  return field.source;
}

export function materializeDraftFields(data: OperatingData, draft: ChannelListingDraft, inspector: MarketplaceDraftInspector) {
  ensureDraftFieldCollections(data);
  const created: MarketplaceListingDraftField[] = [];
  for (const field of inspector.mappingSources) {
    const existing = data.marketplaceListingDraftFields!.find((entry) => entry.draftId === draft.id && entry.fieldKey === field.fieldKey);
    const generatedValue = toPersistedValue(field.value);
    const validationMessage = field.warnings[0] || inspector.validationResults.find((message) => message.toLowerCase().includes(field.fieldKey.toLowerCase())) || null;
    if (existing) {
      existing.generatedValue = generatedValue;
      if (!existing.isOverridden) existing.currentValue = generatedValue;
      existing.source = existing.isOverridden ? "user_edit" : sourceFor(field);
      existing.sourcePath = field.sourcePath;
      existing.confidence = field.confidence;
      existing.validationState = validationMessage ? "warning" : "valid";
      existing.validationMessage = validationMessage;
      existing.updatedAt = now();
      created.push(existing);
      continue;
    }
    const row: MarketplaceListingDraftField = {
      id: id(),
      draftId: draft.id,
      fieldKey: field.fieldKey,
      generatedValue,
      currentValue: generatedValue,
      source: sourceFor(field),
      sourcePath: field.sourcePath,
      confidence: field.confidence,
      isOverridden: false,
      validationState: validationMessage ? "warning" : "valid",
      validationMessage,
      createdAt: now(),
      updatedAt: now(),
    };
    data.marketplaceListingDraftFields!.push(row);
    created.push(row);
  }
  return created;
}

export function applyDraftFieldValue(draft: ChannelListingDraft, fieldKey: string, value: ListingDraftEditableValue) {
  if (fieldKey === "title" && typeof value === "string") draft.title = value;
  else if (fieldKey === "description" && typeof value === "string") draft.description = value;
  else if (fieldKey === "price" && typeof value === "number") draft.price = Math.round(value * 100) / 100;
  else if (fieldKey === "category" && typeof value === "string") draft.category = value;
  else if (fieldKey === "images" && Array.isArray(value)) draft.imageUrls = value;
  else if (value !== null) draft.attributes[fieldKey] = Array.isArray(value) ? value.join(", ") : String(value);
  draft.updatedAt = now();
}

export function saveListingDraftField(data: OperatingData, input: { draftId: string; fieldKey: string; currentValue: ListingDraftEditableValue; actor?: string }) {
  ensureDraftFieldCollections(data);
  const draft = data.channelListingDrafts?.find((entry) => entry.id === input.draftId);
  if (!draft) throw new Error("Listing draft not found.");
  const existing = data.marketplaceListingDraftFields!.find((entry) => entry.draftId === input.draftId && entry.fieldKey === input.fieldKey);
  if (!existing) throw new Error("Listing draft field not found. Regenerate the marketplace draft before editing.");
  existing.currentValue = input.currentValue;
  existing.source = "user_edit";
  existing.isOverridden = true;
  existing.validationState = input.currentValue === null || input.currentValue === "" ? "blocked" : "valid";
  existing.validationMessage = existing.validationState === "blocked" ? "This required field needs a value before publishing." : null;
  existing.updatedAt = now();
  applyDraftFieldValue(draft, input.fieldKey, input.currentValue);
  data.marketplaceListingDraftRevisions!.push({
    id: id(),
    draftId: draft.id,
    revision: data.marketplaceListingDraftRevisions!.filter((entry) => entry.draftId === draft.id).length + 1,
    reason: "user_edit",
    snapshot: { fieldKey: input.fieldKey, currentValue: input.currentValue },
    createdBy: input.actor,
    createdAt: now(),
  });
  return existing;
}

export function resetListingDraftField(data: OperatingData, input: { draftId: string; fieldKey: string; actor?: string }) {
  ensureDraftFieldCollections(data);
  const draft = data.channelListingDrafts?.find((entry) => entry.id === input.draftId);
  if (!draft) throw new Error("Listing draft not found.");
  const existing = data.marketplaceListingDraftFields!.find((entry) => entry.draftId === input.draftId && entry.fieldKey === input.fieldKey);
  if (!existing) throw new Error("Listing draft field not found.");
  existing.currentValue = existing.generatedValue;
  existing.source = existing.source === "user_edit" ? "mapping" : existing.source;
  existing.isOverridden = false;
  existing.validationState = existing.generatedValue === null || existing.generatedValue === "" ? "blocked" : "valid";
  existing.validationMessage = existing.validationState === "blocked" ? "This generated value is missing." : null;
  existing.updatedAt = now();
  applyDraftFieldValue(draft, input.fieldKey, existing.generatedValue);
  data.marketplaceListingDraftRevisions!.push({
    id: id(),
    draftId: draft.id,
    revision: data.marketplaceListingDraftRevisions!.filter((entry) => entry.draftId === draft.id).length + 1,
    reason: "regenerated",
    snapshot: { fieldKey: input.fieldKey, currentValue: existing.generatedValue },
    createdBy: input.actor,
    createdAt: now(),
  });
  return existing;
}
