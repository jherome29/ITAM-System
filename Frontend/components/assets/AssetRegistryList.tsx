"use client";

import { useEffect, useState, type ComponentType } from "react";
import Link from "next/link";
import {
  Archive,
  Boxes,
  Grid2X2,
  Laptop,
  List,
  MapPin,
  Package,
  Plus,
  Printer,
  QrCode,
  Search,
  Server,
  Wifi,
} from "lucide-react";
import { assetsApi, type Asset } from "@/lib/api/assets";
import { locationLabel } from "@/lib/assets/asset-location";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { CenteredModal } from "@/components/ui/CenteredModal";
import { Toast } from "@/components/ui/Toast";
import { RegisterAssetForm } from "@/components/assets/RegisterAssetForm";
import { PrimaryButton } from "@/components/admin/AdminUi";
import { buttonClass } from "@/components/ui/buttons";
import { surfaceClass } from "@/components/ui/controls";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchToolbar } from "@/components/ui/SearchToolbar";

const STATUS_OPTIONS = [
  "registered",
  "available",
  "issued",
  "returned",
  "transferred",
  "under_repair",
  "flagged_for_disposal",
  "disposed",
];

const ASSET_CLASS_OPTIONS = [
  { value: "PPE", label: "Property, Plant & Equipment" },
  { value: "SEP", label: "Semi-Expendable Property" },
  { value: "IES", label: "Inventory & Supplies" },
];

// 10 mirrors DEFAULT_REORDER_LEVEL in packages/shared/src/constants
const DEFAULT_REORDER_LEVEL = 10;
const PAGE_SIZE = 6;

export function isLowStock(
  asset: Pick<Asset, "quantity" | "reorderLevel">,
): boolean {
  return asset.quantity <= (asset.reorderLevel ?? DEFAULT_REORDER_LEVEL);
}

function formatLabel(value?: string | null): string {
  if (!value) return "Not recorded";
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function displayId(asset: Asset): string {
  return (
    asset.propertyNumber ||
    asset.itemCode ||
    asset.id.slice(0, 12).toUpperCase()
  );
}

function isAttentionAsset(asset: Asset): boolean {
  return (
    asset.status === "under_repair" ||
    asset.status === "flagged_for_disposal" ||
    asset.status === "disposed" ||
    asset.condition === "unserviceable" ||
    asset.condition === "for_repair" ||
    asset.condition === "for_disposal" ||
    (asset.assetType === "Supplies" && isLowStock(asset))
  );
}

function AssetIcon({
  asset,
  className,
}: Readonly<{ asset: Asset; className: string }>) {
  const description =
    `${asset.itemDescription} ${asset.brand ?? ""} ${asset.assetType ?? ""}`.toLowerCase();
  let Icon: ComponentType<{ className?: string }> = Boxes;

  if (description.includes("laptop") || description.includes("workstation"))
    Icon = Laptop;
  else if (description.includes("printer")) Icon = Printer;
  else if (description.includes("server") || description.includes("storage"))
    Icon = Server;
  else if (
    description.includes("network") ||
    description.includes("switch") ||
    description.includes("router")
  )
    Icon = Wifi;
  else if (description.includes("cabinet") || description.includes("furniture"))
    Icon = Archive;
  else if (asset.assetType === "Supplies") Icon = Package;

  return <Icon className={className} />;
}

function scanPath(basePath: string): string {
  if (basePath.startsWith("/property")) return "/property-custodian/qr-scanner";
  return "/it-asset-custodian/qr-scanner";
}

function registryDescription(assetType?: string): string {
  if (assetType === "Supplies")
    return "Monitor stock on hand, reorder levels, storage locations, and supply movement.";
  if (assetType === "Fixed")
    return "Manage accountable property, locations, assignments, and physical condition.";
  return "Manage devices, ownership, serviceability, warranty, and lifecycle records.";
}

function RegistryTabs({
  basePath,
  assetType,
}: Readonly<{ basePath: string; assetType?: string }>) {
  const tabs = basePath.startsWith("/it-asset-custodian")
    ? [
        ["Asset registry", "/it-asset-custodian/assets"],
        ["Physical inventory", "/it-asset-custodian/physical-inventory"],
        ["Maintenance & repair", "/it-asset-custodian/maintenance"],
      ]
    : basePath.startsWith("/property-custodian")
      ? [
          ["Fixed assets", "/property-custodian/fixed-assets"],
          ["Supplies", "/property-custodian/supplies"],
          ["Physical inventory", "/property-custodian/physical-inventory"],
        ]
      : [];

  if (tabs.length === 0) return null;

  const activePath =
    assetType === "Supplies" ? "/property-custodian/supplies" : basePath;
  return (
    <nav
      aria-label="Inventory sections"
      className="flex gap-7 overflow-x-auto border-b border-slate-200"
    >
      {tabs.map(([label, href]) => (
        <Link
          key={href}
          href={href}
          className={`relative flex h-11 flex-none items-center text-sm font-semibold ${
            href === activePath
              ? "text-blue-700"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          {label}
          {href === activePath && (
            <span className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-600" />
          )}
        </Link>
      ))}
    </nav>
  );
}

export function AssetRegistryList({
  basePath,
  assetType,
  title = "ICT Asset Registry",
}: Readonly<{ basePath: string; assetType?: string; title?: string }>) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterClass, setFilterClass] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [createOpen, setCreateOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toast, setToast] = useState("");

  useEffect(() => {
    assetsApi
      .list(
        page,
        PAGE_SIZE,
        search || undefined,
        filterStatus || undefined,
        assetType,
        filterClass || undefined,
      )
      .then((res) => {
        setError("");
        setAssets(res.data.data ?? []);
        setTotal(res.data.total ?? 0);
        setTotalPages(Math.max(1, res.data.totalPages ?? 1));
      })
      .catch(() => {
        setAssets([]);
        setTotal(0);
        setError("The asset registry could not be loaded. Please try again.");
      })
      .finally(() => setLoading(false));
  }, [page, search, filterStatus, filterClass, assetType, refreshKey]);

  const startRecord = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endRecord = Math.min(page * PAGE_SIZE, total);
  const visiblePages = Array.from(
    { length: totalPages },
    (_, index) => index + 1,
  ).filter(
    (item) => item === 1 || item === totalPages || Math.abs(item - page) <= 1,
  );

  const resetAndLoad = (update: () => void) => {
    setLoading(true);
    setPage(1);
    update();
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <PageHeader
        eyebrow={assetType === "Fixed" || assetType === "Supplies" ? "Property Custodian" : "IT Asset Custodian"}
        title={title}
        detail={registryDescription(assetType)}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href={scanPath(basePath)} className={buttonClass({ variant: "secondary" })}>
              <QrCode className="h-5 w-5" /> Scan tag
            </Link>
            <PrimaryButton icon={Plus} onClick={() => setCreateOpen(true)}>
              {assetType === "Supplies" ? "Record stock" : "Add asset"}
            </PrimaryButton>
          </div>
        }
      />

      <RegistryTabs basePath={basePath} assetType={assetType} />

      <section className={`space-y-4 p-4 ${surfaceClass}`}>
        <SearchToolbar
          bare
          value={search}
          onChange={(next) => resetAndLoad(() => setSearch(next))}
          placeholder="Search assets by name, ID, serial, or location"
          filters={[
            {
              label: "All categories",
              value: filterClass,
              options: [{ value: "", label: "All categories" }, ...ASSET_CLASS_OPTIONS.map((item) => ({ value: item.value, label: item.label }))],
              onChange: (next) => resetAndLoad(() => setFilterClass(next)),
            },
            {
              label: "All statuses",
              value: filterStatus,
              options: [{ value: "", label: "All statuses" }, ...STATUS_OPTIONS.map((status) => ({ value: status, label: formatLabel(status) }))],
              onChange: (next) => resetAndLoad(() => setFilterStatus(next)),
            },
          ]}
        >
          <div className="flex h-11 overflow-hidden rounded-md border border-slate-300" aria-label="Registry view">
            <button
              type="button"
              onClick={() => setView("list")}
              className={`grid w-11 place-items-center ${view === "list" ? "bg-blue-700 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
              aria-label="List view"
              title="List view"
            >
              <List className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setView("grid")}
              className={`grid w-11 place-items-center border-l border-slate-300 ${view === "grid" ? "bg-blue-700 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
              aria-label="Grid view"
              title="Grid view"
            >
              <Grid2X2 className="h-5 w-5" />
            </button>
          </div>
        </SearchToolbar>

        <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-950">
              {assetType === "Supplies" ? "Supplies" : "Assets"}{" "}
              <span className="font-medium text-slate-500">({total})</span>
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Showing {startRecord}-{endRecord} of {total} records
            </p>
          </div>
          <div className="flex items-center gap-1 text-sm">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => {
                setLoading(true);
                setPage((current) => Math.max(1, current - 1));
              }}
              className="h-9 rounded-md px-2 text-slate-600 hover:bg-slate-100 disabled:text-slate-500"
            >
              Previous
            </button>
            {visiblePages.map((item, index) => (
              <span key={item} className="contents">
                {index > 0 && item - visiblePages[index - 1] > 1 && (
                  <span className="px-1 text-slate-500">…</span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setLoading(true);
                    setPage(item);
                  }}
                  className={`h-9 min-w-9 rounded-md px-2 font-semibold ${page === item ? "bg-blue-700 text-white" : "text-slate-600 hover:bg-slate-100"}`}
                >
                  {item}
                </button>
              </span>
            ))}
            <button
              type="button"
              disabled={page === totalPages}
              onClick={() => {
                setLoading(true);
                setPage((current) => Math.min(totalPages, current + 1));
              }}
              className="h-9 rounded-md px-2 text-slate-600 hover:bg-slate-100 disabled:text-slate-500"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <LoadingSkeleton rows={6} />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-12 text-center text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : assets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <Search className="mx-auto h-6 w-6 text-slate-500" />
          <p className="mt-3 text-sm font-bold text-slate-900">
            No matching assets
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Adjust the search or filters to see more inventory.
          </p>
        </div>
      ) : view === "grid" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {assets.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              href={`${basePath}/${asset.id}`}
            />
          ))}
        </div>
      ) : (
        <AssetTable
          assets={assets}
          basePath={basePath}
          showQuantity={assetType === "Supplies"}
        />
      )}

      <CenteredModal
        open={createOpen}
        title={
          assetType === "Supplies" ? "Record New Stock" : "Register New Asset"
        }
        description="All fields marked * are required. Complete per CICC asset tagging procedure."
        onClose={() => setCreateOpen(false)}
      >
        <RegisterAssetForm
          basePath={basePath}
          embedded
          defaultAssetType={assetType ?? "ICT"}
          onCancel={() => setCreateOpen(false)}
          onCreated={(asset) => {
            setCreateOpen(false);
            setLoading(true);
            setPage(1);
            setRefreshKey((current) => current + 1);
            setToast(`${asset.itemDescription} was registered successfully.`);
          }}
        />
      </CenteredModal>
      <Toast message={toast} />
    </div>
  );
}

function AssetCard({ asset, href }: Readonly<{ asset: Asset; href: string }>) {
  const attention = isAttentionAsset(asset);
  const where = locationLabel(asset);
  const location =
    where === "—"
      ? asset.division || "Location not recorded"
      : where;
  const supportingText =
    asset.assetType === "Supplies"
      ? `${asset.quantity} on hand · Reorder at ${asset.reorderLevel ?? DEFAULT_REORDER_LEVEL}`
      : formatLabel(asset.condition);

  return (
    <Link
      href={href}
      className={`group min-h-48 overflow-hidden text-left transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md ${surfaceClass}`}
    >
      <div className="flex h-full">
        <span className="grid w-24 flex-none place-items-center bg-slate-50 text-slate-500 transition group-hover:bg-blue-50 group-hover:text-blue-700">
          <AssetIcon asset={asset} className="h-11 w-11" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col p-4">
          <span className="line-clamp-2 text-base font-bold leading-5 text-slate-950">
            {asset.itemDescription}
          </span>
          <span className="mt-1 block text-xs text-slate-500">
            {displayId(asset)}
          </span>
          <span className="mt-2 flex items-center gap-1.5 text-xs text-slate-600">
            <i
              className={`h-1.5 w-1.5 rounded-full ${attention ? "bg-red-500" : "bg-emerald-500"}`}
            />
            {asset.brand || asset.assetClass} · {formatLabel(asset.status)}
          </span>
          <span className="mt-auto block pt-4">
            <span className="flex items-start gap-1.5 text-xs text-slate-600">
              <MapPin className="mt-0.5 h-4 w-4 flex-none" />
              <span className="line-clamp-2">{location}</span>
            </span>
            <span
              className={`mt-2 block truncate text-xs font-semibold ${attention ? "text-red-600" : "text-emerald-700"}`}
            >
              {supportingText}
            </span>
          </span>
        </span>
      </div>
    </Link>
  );
}

function AssetTable({
  assets,
  basePath,
  showQuantity,
}: Readonly<{ assets: Asset[]; basePath: string; showQuantity: boolean }>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full">
        <thead className="bg-slate-50">
          <tr>
            {[
              "Asset",
              "Category",
              "Type",
              "Location",
              "Status",
              ...(showQuantity ? ["Quantity"] : []),
              "",
            ].map((heading) => (
              <th
                key={heading}
                className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {assets.map((asset) => (
            <tr key={asset.id} className="hover:bg-blue-50/60">
              <td className="px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-slate-600">
                    <AssetIcon asset={asset} className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-slate-950">
                      {asset.itemDescription}
                    </span>
                    <span className="text-xs text-slate-500">
                      {displayId(asset)}
                    </span>
                  </span>
                </div>
              </td>
              <td className="px-5 py-3 text-sm text-slate-600">
                {asset.assetClass}
              </td>
              <td className="px-5 py-3 text-sm text-slate-600">
                {asset.assetType}
              </td>
              <td className="px-5 py-3 text-sm text-slate-600">
                {locationLabel(asset)}
              </td>
              <td className="px-5 py-3">
                <StatusBadge status={asset.status} />
              </td>
              {showQuantity && (
                <td className="px-5 py-3 text-sm text-slate-600">
                  {asset.quantity}
                </td>
              )}
              <td className="px-5 py-3">
                <Link
                  href={`${basePath}/${asset.id}`}
                  className="text-sm font-semibold text-blue-700 hover:underline"
                >
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
