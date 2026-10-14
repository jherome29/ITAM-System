'use client';

import { useEffect, useMemo, useRef } from 'react';
import { FileText, ImagePlus, X } from 'lucide-react';
import { MAX_FILES, fileProblem, formatBytes } from '@/lib/asset-requests/asset-request-rules';

/**
 * Real file input for return / incident evidence: up to 3 JPG/PNG/WEBP/PDF
 * files, 5 MB each, with image thumbnails. The server re-validates every file
 * by content — this only gives instant feedback.
 */
export function AttachmentPicker({
  files,
  onChange,
}: Readonly<{ files: File[]; onChange: (files: File[]) => void }>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previews = useMemo(
    () => files.map((f) => (f.type.startsWith('image/') ? URL.createObjectURL(f) : null)),
    [files],
  );
  useEffect(() => () => previews.forEach((url) => url && URL.revokeObjectURL(url)), [previews]);

  const problem = fileProblem(files);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3">
        {files.map((file, i) => (
          <div key={`${file.name}-${i}`} className="relative h-24 w-24 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
            {previews[i] ? (
              // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
              <img src={previews[i]} alt={file.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-1 p-2 text-center text-[11px] text-slate-600">
                <FileText className="h-6 w-6 text-slate-400" />
                <span className="line-clamp-2 break-all">{file.name}</span>
              </div>
            )}
            <span className="absolute bottom-0 left-0 right-0 bg-slate-900/60 px-1 text-[10px] text-white">{formatBytes(file.size)}</span>
            <button
              type="button"
              onClick={() => onChange(files.filter((_, j) => j !== i))}
              className="absolute right-1 top-1 rounded-full bg-white/90 p-0.5 text-slate-700 shadow hover:bg-white"
              aria-label={`Remove ${file.name}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {files.length < MAX_FILES && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-slate-300 text-xs font-semibold text-slate-600 hover:border-blue-400 hover:text-blue-700"
          >
            <ImagePlus className="h-6 w-6" />
            Add file
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        multiple
        className="hidden"
        onChange={(event) => {
          const picked = Array.from(event.target.files ?? []);
          onChange([...files, ...picked].slice(0, MAX_FILES));
          event.target.value = '';
        }}
      />
      <p className={`text-xs ${problem ? 'font-semibold text-red-600' : 'text-slate-500'}`}>
        {problem ?? `Photos or PDF — up to ${MAX_FILES} files, 5 MB each.`}
      </p>
    </div>
  );
}
