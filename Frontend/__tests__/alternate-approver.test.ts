import { describe, expect, it } from 'vitest';
import { alternateApproverOptions, buildAvailabilityPayload } from '@/lib/users/availability';
import type { User } from '@/lib/api/users';

const u = (over: Partial<User>): User => ({
  id: 'x', email: 'x@cicc.gov.ph', firstName: 'A', lastName: 'B', employeeId: 'E',
  role: 'supervisor', division: 'D', officeOrSection: 'S', isActive: true,
  createdAt: '', updatedAt: '', alternateApproverId: null, unavailable: false, unavailableUntil: null,
  ...over,
});

describe('alternateApproverOptions', () => {
  it('keeps only active supervisors and drops the current user', () => {
    const users = [
      u({ id: 'self', role: 'supervisor' }),
      u({ id: 's2', role: 'supervisor', firstName: 'Alex', lastName: 'Reyes' }),
      u({ id: 'e1', role: 'employee' }),
      u({ id: 's3', role: 'supervisor', isActive: false }),
    ];
    expect(alternateApproverOptions(users, 'self')).toEqual([{ value: 's2', label: 'Reyes, Alex' }]);
  });
});

describe('buildAvailabilityPayload', () => {
  it('passes an ISO date through and coerces empty to null', () => {
    expect(buildAvailabilityPayload({ unavailable: true, until: '2026-09-15' }))
      .toEqual({ unavailable: true, unavailableUntil: '2026-09-15' });
    expect(buildAvailabilityPayload({ unavailable: false, until: '   ' }))
      .toEqual({ unavailable: false, unavailableUntil: null });
  });
});
