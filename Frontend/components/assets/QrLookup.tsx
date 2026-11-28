'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { IScannerControls } from '@zxing/browser';
import { useRouter } from 'next/navigation';
import { ScanBarcode, Search } from 'lucide-react';
import { assetsApi, type Asset } from '@/lib/api/assets';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PrimaryButton } from '@/components/admin/AdminUi';
import { buttonClass } from '@/components/ui/buttons';
import { controlClass, surfaceClass } from '@/components/ui/controls';
import { PageHeader } from '@/components/ui/PageHeader';
import { Notice } from '@/components/ui/Notice';

export function QrLookup({ detailBasePath, eyebrow }: Readonly<{ detailBasePath: string; eyebrow?: string }>) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<Asset | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const video = useRef<HTMLVideoElement>(null);
  const pendingLookup = useRef<AbortController | null>(null);

  const lookup = useCallback(async (value: string) => {
    const tag = value.trim();
    if (!tag) return;
    pendingLookup.current?.abort();
    const request = new AbortController();
    pendingLookup.current = request;
    setCameraOn(false);
    setQuery(tag);
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const { data } = await assetsApi.findByInventoryTag(tag, request.signal);
      if (!request.signal.aborted) setResult(data);
    } catch (err) {
      if (request.signal.aborted) return;
      const response = (err as { response?: { status?: number; data?: { message?: string } } }).response;
      setError([400, 404, 409].includes(response?.status ?? 0) && response?.data?.message
        ? response.data.message
        : 'Could not look up the inventory tag. Please try again.');
    } finally {
      if (!request.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => () => pendingLookup.current?.abort(), []);

  useEffect(() => {
    const preview = video.current;
    if (!cameraOn || !preview) return;
    let active = true;
    let stream: MediaStream | undefined;
    let controls: IScannerControls | undefined;
    const stop = () => {
      active = false;
      controls?.stop();
      stream?.getTracks().forEach((track) => track.stop());
      preview.srcObject = null;
    };

    const start = async () => {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        if (!active) return;
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (!active) { stop(); return; }
        const reader = new BrowserMultiFormatReader();
        controls = await reader.decodeFromStream(stream, preview, (decoded) => {
          if (!active || !decoded) return;
          stop();
          void lookup(decoded.getText());
        });
        if (active) setCameraReady(true);
        else controls.stop();
      } catch (err) {
        if (!active) return;
        stop();
        setCameraOn(false);
        setCameraError(err instanceof Error && err.name === 'NotAllowedError'
          ? 'Camera permission was denied. Allow access or enter the tag below.'
          : 'Could not start a camera. Check that it is connected and available.');
      }
    };
    void start();
    return stop;
  }, [cameraOn, lookup]);

  const startCamera = () => {
    setCameraError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera access needs a supported browser on localhost or HTTPS. Enter the tag below instead.');
      return;
    }
    setCameraReady(false);
    setCameraOn(true);
  };

  return (
    <div className="max-w-xl space-y-6">
      <PageHeader eyebrow={eyebrow} title="Barcode Scanner" detail="Scan a tag or type its number to open the asset record." />

      <div className={`${surfaceClass} space-y-5 p-6`}>
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
            <ScanBarcode className="h-8 w-8 text-brand" aria-hidden="true" />
          </div>
          <p className="text-center text-sm text-slate-600">
            Point your camera at a printed inventory barcode or QR tag.
          </p>
          <button type="button" disabled={loading} className={buttonClass()}
            onClick={cameraOn ? () => setCameraOn(false) : startCamera}>
            {cameraOn ? 'Stop camera' : 'Start camera'}
          </button>
        </div>
        {cameraOn && (
          <div className="space-y-2">
            <video ref={video} autoPlay muted playsInline aria-label="Inventory tag camera preview" className="aspect-video w-full rounded-lg bg-slate-950 object-contain" />
            <p role="status" className="text-center text-sm text-slate-600">{cameraReady ? 'Center the tag in the camera view.' : 'Starting camera…'}</p>
          </div>
        )}
        {cameraError && <Notice tone="red">{cameraError}</Notice>}

        <form onSubmit={(event) => { event.preventDefault(); void lookup(query); }} className="flex flex-wrap gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Barcode, QR value, or property number"
            aria-label="Barcode, QR value, or property number"
            className={`${controlClass} flex-1`}
          />
          <PrimaryButton type="submit" icon={Search} disabled={loading || !query.trim()}>
            {loading ? 'Searching…' : 'Search'}
          </PrimaryButton>
        </form>

        {error && (
          <Notice tone="red">{error}</Notice>
        )}

        {result && (
          <div className="overflow-hidden rounded-lg border border-blue-200">
            <div className="border-b border-blue-200 bg-blue-50 p-4">
              <h3 className="text-base font-bold text-brand">{result.itemDescription}</h3>
              <p className="mt-0.5 font-mono text-sm text-slate-600">{result.propertyNumber ?? result.id}</p>
            </div>
            <div className="space-y-2 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Status</span>
                <StatusBadge status={result.status} />
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Brand</span>
                <span className="text-slate-900">{result.brand ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Location</span>
                <span className="text-slate-900">{result.officeOrSection ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Condition</span>
                <span className="capitalize text-slate-900">{result.condition?.replace(/_/g, ' ') ?? '—'}</span>
              </div>
            </div>
            <div className="border-t border-slate-100 p-4">
              <button type="button" onClick={() => router.push(`${detailBasePath}/${result.id}`)} className={`${buttonClass()} w-full`}>
                View Full Asset Details
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
