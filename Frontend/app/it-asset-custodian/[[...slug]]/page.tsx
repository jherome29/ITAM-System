import { redirect } from 'next/navigation';
export default async function LegacyCustodianPage({ params }: Readonly<{ params: Promise<{ slug?: string[] }> }>) {
  const { slug } = await params;
  const segments = slug?.length ? [...slug] : ['dashboard'];
  if (segments[0] === 'assets') segments[0] = 'it-inventory';
  redirect('/asset-custodian/' + segments.map(encodeURIComponent).join('/'));
}
