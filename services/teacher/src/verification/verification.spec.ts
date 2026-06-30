import { VerificationStatus } from '@learn-and-build/types';
import {
  assertTransition,
  canTransition,
  InvalidVerificationTransitionError,
} from './verification';

describe('verification state machine', () => {
  it('allows the happy-path lifecycle', () => {
    expect(
      canTransition(VerificationStatus.PENDING, VerificationStatus.SUBMITTED),
    ).toBe(true);
    expect(
      canTransition(
        VerificationStatus.SUBMITTED,
        VerificationStatus.UNDER_REVIEW,
      ),
    ).toBe(true);
    expect(
      canTransition(
        VerificationStatus.UNDER_REVIEW,
        VerificationStatus.APPROVED,
      ),
    ).toBe(true);
  });

  it('allows a rejected teacher to resubmit', () => {
    expect(
      canTransition(VerificationStatus.REJECTED, VerificationStatus.SUBMITTED),
    ).toBe(true);
  });

  it('treats APPROVED as terminal', () => {
    expect(
      canTransition(VerificationStatus.APPROVED, VerificationStatus.SUBMITTED),
    ).toBe(false);
  });

  it('forbids skipping straight from PENDING to APPROVED', () => {
    expect(
      canTransition(VerificationStatus.PENDING, VerificationStatus.APPROVED),
    ).toBe(false);
  });

  it('assertTransition throws on an invalid transition', () => {
    expect(() =>
      assertTransition(
        VerificationStatus.PENDING,
        VerificationStatus.UNDER_REVIEW,
      ),
    ).toThrow(InvalidVerificationTransitionError);
  });

  it('assertTransition returns the target on a valid transition', () => {
    expect(
      assertTransition(
        VerificationStatus.SUBMITTED,
        VerificationStatus.UNDER_REVIEW,
      ),
    ).toBe(VerificationStatus.UNDER_REVIEW);
  });
});
