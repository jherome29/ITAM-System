import { redirect } from 'next/navigation';
export default async function LegacyCustodianPage({ params }: Readonly<{ params: Promise<{ slug?: string[] }> }>) {
  const { slug } = await params;
  const segments = slug?.length ? [...slug] : ['dashboard'];

  redirect('/asset-custodian/' + segments.map(encodeURIComponent).join('/'));
}
