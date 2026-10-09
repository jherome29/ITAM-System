'use client';

import { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { assetRequestsApi, type AssetRequestAttachment } from '@/lib/api/asset-requests';
import { formatBytes } from '@/lib/asset-requests/asset-request-rules';

/**
 * Thumbnails for a request's attachments. Files sit behind the bearer token, so
 * they are fetched as blobs and shown through object URLs rather than linked
 * directly. Clicking opens the full file in a new tab.
 */
export function AttachmentGallery({
  requestId,
  attachments,
}: Readonly<{ requestId: string; attachments: AssetRequestAttachment[] }>) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  // Keyed on the ids, not the array: callers pass filtered copies, and a new
  // array each render must not refetch every file.
  const idsKey = attachments.map((a) => a.id).join(',');

  useEffect(() => {
    let cancelled = false;
    const created: string[] = [];
    Promise.all(
      idsKey.split(',').filter(Boolean).map((attachmentId) =>
        assetRequestsApi.attachment(requestId, attachmentId).then((blob) => {
          const url = URL.createObjectURL(blob);
          created.push(url);
          return [attachmentId, url] as const;
        }),
      ),
    )
      .then((pairs) => { if (!cancelled) setUrls(Object.fromEntries(pairs)); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => {
      cancelled = true;
      created.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [requestId, idsKey]);

  if (attachments.length === 0) return <p className="text-sm text-slate-500">No attachments.</p>;
  if (failed) return <p className="text-sm font-semibold text-red-600">Attachments could not be loaded.</p>;

  return (
    <div className="flex flex-wrap gap-3">
      {attachments.map((a) => {
        const url = urls[a.id];
        return (
          <a
            key={a.id}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!url}
            className="block h-28 w-28 overflow-hidden rounded-md border border-slate-200 bg-slate-50 hover:border-blue-400"
            title={`${a.fileName} · ${formatBytes(a.sizeBytes)}`}
          >
            {url && a.mimeType.startsWith('image/') ? (
              // eslint-disable-next-line @next/next/no-img-element -- authenticated blob URL
              <img src={url} alt={a.fileName} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-1 p-2 text-center text-[11px] text-slate-600">
                <FileText className="h-6 w-6 text-slate-400" />
                <span className="line-clamp-2 break-all">{url ? a.fileName : 'Loading…'}</span>
              </div>
            )}
          </a>
        );
      })}
    </div>
  );
}
