"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { assetsApi, type Asset, type CreateAssetDto } from "@/lib/api/assets";

export interface RegisterAssetFormState {
  sapClassification: string;
  itemCode: string;
  itemDescription: string;
  brand: string;
  serialNumber: string;
  propertyNumber: string;
  components: string;
  acquisitionCost: string;
  acquisitionDate: string;
  accountableOfficer: string;
  division: string;
  officeOrSection: string;
  officeLocation: string;
  condition: string;
  supplier: string;
  dateOfDelivery: string;
  assetClass: string;
  assetType: string;
  quantity: string;
  reorderLevel: string;
}

// Pure, DOM-free so it is unit-testable without a render environment. Supply-stock
// fields only exist for IES assets — for PPE/SEP they must be stripped entirely, or
// the `...form` spread would send them as strings and 400 the backend @IsInt guard.
export function buildCreateAssetPayload(
  form: RegisterAssetFormState,
): CreateAssetDto {
  const { quantity, reorderLevel, ...base } = form;
  const payload: CreateAssetDto = {
    ...base,
    acquisitionCost: form.acquisitionCost
      ? parseFloat(form.acquisitionCost)
      : undefined,
    acquisitionDate: form.acquisitionDate || undefined,
    dateOfDelivery: form.dateOfDelivery || undefined,
  };
  if (form.assetClass === "IES") {
    payload.quantity = quantity ? parseInt(quantity, 10) : 1;
    payload.reorderLevel = reorderLevel
      ? parseInt(reorderLevel, 10)
      : undefined;
  }
  return payload;
}

const ASSET_CLASSES = ["PPE", "SEP", "IES"] as const;
// Must match packages/shared/src/enums AssetType exactly — CreateAssetDto validates
// with @IsEnum(AssetType), so any other value (e.g. legacy 'FURNITURE'/'VEHICLE') 400s.
const ASSET_TYPES = ["ICT", "Fixed", "Supplies"] as const;
// Must match packages/shared/src/enums AssetCondition exactly (lowercase snake_case) —
// CreateAssetDto validates with @IsEnum(AssetCondition).
const CONDITIONS = [
  "serviceable",
  "unserviceable",
  "for_repair",
  "for_disposal",
] as const;

const inputClass =
  "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4d7a]/30 focus:border-[#1a4d7a] transition-colors bg-white";

function Section({
  title,
  children,
}: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <fieldset className="border border-gray-200 rounded-lg p-5 mb-5">
      <legend className="px-2 text-xs font-semibold text-[#1a4d7a] uppercase tracking-wider">
        {title}
      </legend>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
        {children}
      </div>
    </fieldset>
  );
}

function Field({
  label,
  required,
  children,
}: Readonly<{ label: string; required?: boolean; children: ReactNode }>) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

export function RegisterAssetForm({
  basePath,
  embedded = false,
  defaultAssetType = "",
  onCancel,
  onCreated,
}: Readonly<{
  basePath: string;
  embedded?: boolean;
  defaultAssetType?: string;
  onCancel?: () => void;
  onCreated?: (asset: Asset) => void;
}>) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState<RegisterAssetFormState>({
    sapClassification: "",
    itemCode: "",
    itemDescription: "",
    brand: "",
    serialNumber: "",
    propertyNumber: "",
    components: "",
    acquisitionCost: "",
    acquisitionDate: "",
    accountableOfficer: "",
    division: "",
    officeOrSection: "",
    officeLocation: "",
    condition: "serviceable",
    supplier: "",
    dateOfDelivery: "",
    assetClass: defaultAssetType === "Supplies" ? "IES" : "",
    assetType: defaultAssetType,
    quantity: "1",
    reorderLevel: "",
  });

  const set = (field: string, val: string) =>
    setForm((prev) => ({ ...prev, [field]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.itemDescription) {
      setError("Item description is required.");
      return;
    }
    if (!form.assetClass) {
      setError("Asset class is required.");
      return;
    }
    if (!form.assetType) {
      setError("Asset type is required.");
      return;
    }
    setSaving(true);
    try {
      const res = await assetsApi.create(buildCreateAssetPayload(form));
      if (onCreated) onCreated(res.data);
      else router.push(`${basePath}/${res.data.id}`);
    } catch (err: unknown) {
      const msg = (
        err as { response?: { data?: { message?: string | string[] } } }
      )?.response?.data?.message;
      setError(
        Array.isArray(msg)
          ? msg.join(" · ")
          : (msg ?? "Failed to register asset."),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    else router.back();
  };

  return (
    <div className={embedded ? "space-y-4" : "max-w-3xl space-y-4"}>
      {!embedded && (
        <>
          <button
            type="button"
            onClick={handleCancel}
            className="flex items-center gap-2 text-sm text-[#1a4d7a] hover:underline"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Inventory
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-[#1a4d7a]">
              Register New Asset
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              All fields marked * are required. Complete per CICC asset tagging
              procedure.
            </p>
          </div>
        </>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <Section title="Classification & Identification">
          <Field label="Item Description" required>
            <input
              className={inputClass}
              value={form.itemDescription}
              onChange={(e) => set("itemDescription", e.target.value)}
              placeholder="e.g. Laptop Computer, Dell Latitude 5420"
            />
          </Field>
          <Field label="Asset Class" required>
            <select
              className={inputClass}
              value={form.assetClass}
              onChange={(e) => set("assetClass", e.target.value)}
            >
              <option value="">Select class...</option>
              {ASSET_CLASSES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Asset Type" required>
            <select
              className={inputClass}
              value={form.assetType}
              onChange={(e) => set("assetType", e.target.value)}
            >
              <option value="">Select type...</option>
              {ASSET_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="SAP Classification">
            <input
              className={inputClass}
              value={form.sapClassification}
              onChange={(e) => set("sapClassification", e.target.value)}
              placeholder="SAP code"
            />
          </Field>
          <Field label="Item Code">
            <input
              className={inputClass}
              value={form.itemCode}
              onChange={(e) => set("itemCode", e.target.value)}
              placeholder="e.g. ICT-LAPTOP-001"
            />
          </Field>
          <Field label="Property Number">
            <input
              className={inputClass}
              value={form.propertyNumber}
              onChange={(e) => set("propertyNumber", e.target.value)}
              placeholder="Official CICC property #"
            />
          </Field>
          <Field label="Brand / Make">
            <input
              className={inputClass}
              value={form.brand}
              onChange={(e) => set("brand", e.target.value)}
              placeholder="e.g. Dell, HP, Canon"
            />
          </Field>
          <Field label="Serial Number">
            <input
              className={inputClass}
              value={form.serialNumber}
              onChange={(e) => set("serialNumber", e.target.value)}
              placeholder="Manufacturer serial #"
            />
          </Field>
          <div className="md:col-span-2">
            <Field label="Components / Accessories">
              <input
                className={inputClass}
                value={form.components}
                onChange={(e) => set("components", e.target.value)}
                placeholder="e.g. charger, mouse, carrying bag"
              />
            </Field>
          </div>
        </Section>

        <Section title="Acquisition Details">
          <Field label="Acquisition Cost (PHP)">
            <input
              className={inputClass}
              type="number"
              min="0"
              step="0.01"
              value={form.acquisitionCost}
              onChange={(e) => set("acquisitionCost", e.target.value)}
              placeholder="0.00"
            />
          </Field>
          <Field label="Acquisition Date">
            <input
              className={inputClass}
              type="date"
              value={form.acquisitionDate}
              onChange={(e) => set("acquisitionDate", e.target.value)}
            />
          </Field>
          <Field label="Supplier / Vendor">
            <input
              className={inputClass}
              value={form.supplier}
              onChange={(e) => set("supplier", e.target.value)}
              placeholder="e.g. PCMS Technologies"
            />
          </Field>
          <Field label="Date of Delivery">
            <input
              className={inputClass}
              type="date"
              value={form.dateOfDelivery}
              onChange={(e) => set("dateOfDelivery", e.target.value)}
            />
          </Field>
        </Section>

        <Section title="Accountability & Location">
          <Field label="Accountable Officer">
            <input
              className={inputClass}
              value={form.accountableOfficer}
              onChange={(e) => set("accountableOfficer", e.target.value)}
              placeholder="Full name"
            />
          </Field>
          <Field label="Division">
            <input
              className={inputClass}
              value={form.division}
              onChange={(e) => set("division", e.target.value)}
              placeholder="e.g. Operations Division"
            />
          </Field>
          <Field label="Office / Section">
            <input
              className={inputClass}
              value={form.officeOrSection}
              onChange={(e) => set("officeOrSection", e.target.value)}
              placeholder="e.g. ICT Section"
            />
          </Field>
          <Field label="Office Location">
            <input
              className={inputClass}
              value={form.officeLocation}
              onChange={(e) => set("officeLocation", e.target.value)}
              placeholder="e.g. Room 302, 3F CICC Bldg"
            />
          </Field>
        </Section>

        {form.assetClass === "IES" && (
          <Section title="Supply Stock">
            <Field label="Quantity on Hand">
              <input
                className={inputClass}
                type="number"
                min="0"
                value={form.quantity}
                onChange={(e) => set("quantity", e.target.value)}
                placeholder="1"
              />
            </Field>
            <Field label="Reorder Level">
              <input
                className={inputClass}
                type="number"
                min="0"
                value={form.reorderLevel}
                onChange={(e) => set("reorderLevel", e.target.value)}
                placeholder="Optional — low-stock alert threshold"
              />
            </Field>
          </Section>
        )}

        <Section title="Physical Condition">
          <Field label="Condition" required>
            <select
              className={inputClass}
              value={form.condition}
              onChange={(e) => set("condition", e.target.value)}
            >
              {CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {c
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (ch) => ch.toUpperCase())}
                </option>
              ))}
            </select>
          </Field>
        </Section>

        <div className="flex gap-3 justify-end pt-2">
          <button
            type="button"
            onClick={handleCancel}
            className="px-6 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-[#1a4d7a] text-white rounded-md text-sm font-medium hover:bg-[#143d61] disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-150"
          >
            {saving ? "Registering..." : "Register Asset"}
          </button>
        </div>
      </form>
    </div>
  );
}
