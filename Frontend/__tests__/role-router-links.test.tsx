import { describe, expect, it } from 'vitest';
import ItAssetCustodianPage from '@/app/it-asset-custodian/[[...slug]]/page';
import PropertyOfficerPage from '@/app/property-officer/[[...slug]]/page';
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

const notFoundDigest = async (page: RouterPage, slug: string[]) => {
  try {
    await render(page, slug);
  } catch (error) {
    return String((error as { digest?: string }).digest ?? '');
  }
  return '';
};

describe('IT Asset Custodian workspace', () => {
  it('serves the management reports the old /it-personnel/reports page generated', async () => {
    expect(await notFoundDigest(ItAssetCustodianPage as RouterPage, ['management-reports'])).toBe('');
  });

  it('lists them in its menu', () => {
    const items = roleNavigation.it_asset_custodian ?? [];
    expect(items.map((i) => i.href)).toContain('/it-asset-custodian/management-reports');
  });

  it('still answers an address with no screen with not-found', async () => {
    expect(await notFoundDigest(ItAssetCustodianPage as RouterPage, ['no-such-page'])).toContain('404');
  });
});

describe('Property Officer workspace', () => {
  it('sends "Go to Forms" to its own Reports & Forms page, not an IT page', async () => {
    const element = (await render(PropertyOfficerPage as RouterPage, ['assets', 'some-asset-id'])) as {
      props: { formsPath: string };
    };
    expect(element.props.formsPath).toBe('/property-officer/reports');
  });
});

describe('navigation', () => {
  it('never links to a pre-redesign shell', () => {
    const hrefs = Object.values(roleNavigation).flatMap((items) => items.map((i) => i.href));
    expect(hrefs.filter((h) => /^\/(admin|supervisor|it-personnel|management)(\/|$)/.test(h))).toEqual([]);
  });
});
