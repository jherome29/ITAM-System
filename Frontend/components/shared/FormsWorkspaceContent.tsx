'use client';

import { useState } from 'react';
import { FormsArchiveContent } from './FormsArchiveContent';
import { FormsGeneratorContent } from './FormsGeneratorContent';

export function FormsWorkspaceContent() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-6">
      <FormsGeneratorContent onGenerated={() => setRefreshKey((key) => key + 1)} />
      <FormsArchiveContent key={refreshKey} showHeader={false} />
    </div>
  );
}
