import type { User } from '@/lib/api/users';

/** Options for the "Alternate approver" <select> — active supervisors, minus self. */
export function alternateApproverOptions(
  users: User[],
  selfId: string,
): { value: string; label: string }[] {
  return users
    .filter((x) => x.role === 'supervisor' && x.isActive && x.id !== selfId)
    .map((x) => ({ value: x.id, label: `${x.lastName}, ${x.firstName}` }));
}

/** Form values → PATCH body for availability. Empty/blank date becomes null. */
export function buildAvailabilityPayload(form: {
  unavailable: boolean;
  until: string;
}): { unavailable: boolean; unavailableUntil: string | null } {
  const trimmed = form.until.trim();
  return { unavailable: form.unavailable, unavailableUntil: trimmed === '' ? null : trimmed };
}
