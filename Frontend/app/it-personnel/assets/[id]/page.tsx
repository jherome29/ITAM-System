'use client';

import { useParams } from 'next/navigation';
import { AssetDetailManager } from '@/components/assets/AssetDetailManager';

export default function AssetDetailPage() {
  const params = useParams<{ id: string }>();
  return <AssetDetailManager assetId={params.id} basePath="/it-personnel/assets" formsPath="/it-personnel/forms" />;
}
