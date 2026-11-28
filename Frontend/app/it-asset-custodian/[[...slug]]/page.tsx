import { redirect } from 'next/navigation';
export default async function LegacyCustodianPage({ params, searchParams }: Readonly<{
  params: Promise<{ slug?: string[] }>;
  searchParams: Promise<{ open?: string | string[] }>;
}>) {
  const { slug } = await params;
  const segments = slug?.length ? [...slug] : ['dashboard'];
  if (segments[0] === 'assets') segments[0] = 'it-inventory';
  const { open } = await searchParams;
  redirect('/asset-custodian/' + segments.map(encodeURIComponent).join('/') + (typeof open === 'string' ? `?open=${encodeURIComponent(open)}` : ''));
}
