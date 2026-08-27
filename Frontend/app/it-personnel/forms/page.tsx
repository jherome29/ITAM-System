import { FormsWorkspaceContent } from '@/components/shared/FormsWorkspaceContent';

/**
 * IT Personnel — Generate Official Forms.
 *
 * The generator + archive UI is the shared `FormsWorkspaceContent`, the same
 * implementation mounted by the redesigned IT Asset Custodian and Property
 * Custodian workspaces. This route is a thin wrapper so the form-generation
 * logic lives in exactly one place.
 */
export default function FormsPage() {
  return <FormsWorkspaceContent />;
}
