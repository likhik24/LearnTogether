import { VerificationStatus } from '@learn-and-build/types';

/**
 * Verification lifecycle:
 *
 *   PENDING ──submit──▶ SUBMITTED ──startReview──▶ UNDER_REVIEW ─┬─approve─▶ APPROVED
 *      ▲                                                          └─reject──▶ REJECTED
 *      │                                                                         │
 *      └─────────────────────────── resubmit ◀───────────────────────────────────┘
 *
 * Admins may also approve/reject directly from SUBMITTED for convenience.
 */
export const VERIFICATION_TRANSITIONS: Record<
  VerificationStatus,
  VerificationStatus[]
> = {
  [VerificationStatus.PENDING]: [VerificationStatus.SUBMITTED],
  [VerificationStatus.SUBMITTED]: [
    VerificationStatus.UNDER_REVIEW,
    VerificationStatus.APPROVED,
    VerificationStatus.REJECTED,
  ],
  [VerificationStatus.UNDER_REVIEW]: [
    VerificationStatus.APPROVED,
    VerificationStatus.REJECTED,
  ],
  [VerificationStatus.APPROVED]: [],
  [VerificationStatus.REJECTED]: [VerificationStatus.SUBMITTED],
};

export class InvalidVerificationTransitionError extends Error {
  constructor(
    public readonly from: VerificationStatus,
    public readonly to: VerificationStatus,
  ) {
    super(`Invalid verification transition: ${from} -> ${to}`);
    this.name = 'InvalidVerificationTransitionError';
  }
}

export function canTransition(
  from: VerificationStatus,
  to: VerificationStatus,
): boolean {
  return VERIFICATION_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Returns the target status if the transition is allowed, otherwise throws. */
export function assertTransition(
  from: VerificationStatus,
  to: VerificationStatus,
): VerificationStatus {
  if (!canTransition(from, to)) {
    throw new InvalidVerificationTransitionError(from, to);
  }
  return to;
}
