import { describe, expect, it } from 'vitest';
import ItAssetCustodianPage from '@/app/asset-custodian/[[...slug]]/page';
import PropertyCustodianPage from '@/app/property-custodian/[[...slug]]/page';
import { roleNavigation } from '@/lib/roles/role-navigation';

// The pre-redesign shells (/admin, /supervisor, /it-personnel, /management) are gone, so
// nothing may send anyone there. Their one capability with no equivalent was the IT
// custodian's management-report generator; it now lives in the IT workspace.

type RouterPage = (props: {
  params: Promise<{ slug?: string[] }>;
  searchParams: Promise<{ open?: string | string[] }>;
}) => Promise<unknown>;

const render = (page: RouterPage, slug: string[]) =>
  page({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) });

const routeDigest = async (page: RouterPage, slug: string[]) => {
  try {
    await render(page, slug);
  } catch (error) {
    return String((error as { digest?: string }).digest ?? '');
  }
  return '';
};

describe('IT Asset Custodian workspace', () => {
  it('serves the management reports the old /it-personnel/reports page generated', async () => {
    expect(await routeDigest(ItAssetCustodianPage as RouterPage, ['management-reports'])).toBe('');
  });

  it('lists them in its menu', () => {
    const items = roleNavigation.asset_custodian ?? [];
    expect(items.map((i) => i.href)).toContain('/asset-custodian/management-reports');
  });

  it('still answers an address with no screen with not-found', async () => {
    expect(await routeDigest(ItAssetCustodianPage as RouterPage, ['no-such-page'])).toContain('404');
  });
});

describe('Property Custodian workspace', () => {
  it('sends "Go to Forms" to its own Reports & Forms page, not an IT page', async () => {
    const element = (await render(ItAssetCustodianPage as RouterPage, ['assets', 'some-asset-id'])) as {
      props: { formsPath: string };
    };
    expect(element.props.formsPath).toBe('/asset-custodian/reports');
  });

  it.each([
    ['replacements', '/asset-custodian/fulfillment'],
    ['replacement-validation', '/asset-custodian/fulfillment'],
    ['disposal-review', '/asset-custodian/disposal'],
  ])('redirects the retired /%s route to %s', async (slug, destination) => {
    expect(await routeDigest(ItAssetCustodianPage, [slug])).toContain(destination);
  });

  it('opens an incident from a custodian notification', async () => {
    const element = await ItAssetCustodianPage({
      params: Promise.resolve({ slug: ['returns-incidents'] }),
      searchParams: Promise.resolve({ open: 'incident-id' }),
    });
    expect(element.props).toMatchObject({ openId: 'incident-id' });
  });

  it('still answers an address with no screen with not-found', async () => {
    expect(await routeDigest(PropertyCustodianPage as RouterPage, ['no-such-page'])).toContain('/asset-custodian/no-such-page');
  });
});

describe('navigation', () => {
  it('never links to a pre-redesign shell', () => {
    const hrefs = Object.values(roleNavigation).flatMap((items) => items.map((i) => i.href));
    expect(hrefs.filter((h) => /^\/(admin|supervisor|it-personnel|management)(\/|$)/.test(h))).toEqual([]);
  });
});
