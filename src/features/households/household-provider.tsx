import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import {
  CareRecipient,
  createCareRecipient,
  fetchCareRecipient,
  updateFeedIntervalMinutes,
} from '@/features/careRecipients/api';
import { useSession } from '@/features/auth/session-provider';

import {
  acceptHouseholdInviteRpc,
  createHouseholdInvite,
  createHouseholdRpc,
  fetchHouseholdCaregivers,
  fetchHouseholdForUser,
  fetchPendingInviteForEmail,
  Household,
  HouseholdCaregiver,
} from './api';

// Second, explicit exception to features/'s "no JSX" convention — see
// features/auth/session-provider.tsx for the first. Same shape: a Context
// wrapper around otherwise-pure state and data-fetching logic.

type MutationResult = { error: Error | null };

type HouseholdContextValue = {
  household: Household | null;
  careRecipient: CareRecipient | null;
  isLoading: boolean;
  createHousehold: (name: string) => Promise<MutationResult>;
  createCareRecipient: (name: string, dateOfBirth: string | null) => Promise<MutationResult>;
  updateFeedInterval: (minutes: number) => Promise<MutationResult>;
  caregivers: HouseholdCaregiver[];
  isLoadingCaregivers: boolean;
  refreshCaregivers: () => Promise<void>;
  inviteCaregiver: (email: string) => Promise<MutationResult>;
};

const HouseholdContext = createContext<HouseholdContextValue | undefined>(undefined);

// household_invites unique-violation and duplicate-caregiver-trigger errors
// translated to calm, specific copy — matches the tone established by
// features/auth/auth-error-messages.ts for auth errors.
function toCalmInviteMessage(error: { code?: string; message: string }): string {
  if (error.code === '23505') return 'This person has already been invited.';
  if (error.message.includes('already a caregiver')) {
    return 'This person is already a caregiver in this household.';
  }
  if (error.message.includes('row-level security')) {
    return "You can't invite yourself.";
  }
  console.warn('Unmapped invite error:', error.message);
  return 'Something went wrong sending that invite. Please try again.';
}

export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  const { session } = useSession();
  const userId = session?.user?.id ?? null;
  const userEmail = session?.user?.email ?? null;

  const [household, setHousehold] = useState<Household | null>(null);
  const [careRecipient, setCareRecipient] = useState<CareRecipient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [caregivers, setCaregivers] = useState<HouseholdCaregiver[]>([]);
  const [isLoadingCaregivers, setIsLoadingCaregivers] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!userId) {
        if (!cancelled) {
          setHousehold(null);
          setCareRecipient(null);
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);

      let fetchedHousehold = await fetchHouseholdForUser(userId);
      if (cancelled) return;

      // No existing membership — check for a pending invite before falling
      // through to onboarding's "create a new household" flow. A broken or
      // stale invite (expired, already accepted, a race) must never block
      // a new user's ability to create their own household, so this whole
      // block fails open on any error.
      if (!fetchedHousehold && userEmail) {
        try {
          const invite = await fetchPendingInviteForEmail(userEmail);
          if (invite) {
            const { data: membership, error } = await acceptHouseholdInviteRpc(invite.id);
            if (error) throw error;
            if (membership) {
              fetchedHousehold = await fetchHouseholdForUser(userId);
            }
          }
        } catch (error) {
          console.warn('Failed to auto-accept pending household invite', error);
        }
        if (cancelled) return;
      }

      setHousehold(fetchedHousehold);

      if (fetchedHousehold) {
        const fetchedRecipient = await fetchCareRecipient(fetchedHousehold.id);
        if (cancelled) return;
        setCareRecipient(fetchedRecipient);
      } else {
        setCareRecipient(null);
      }

      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, userEmail]);

  const value = useMemo<HouseholdContextValue>(
    () => ({
      household,
      careRecipient,
      isLoading,
      createHousehold: async (name) => {
        const { data, error } = await createHouseholdRpc(name);
        if (data) setHousehold(data);
        return { error };
      },
      createCareRecipient: async (name, dateOfBirth) => {
        if (!household) return { error: new Error('No household to add a care recipient to') };
        const { data, error } = await createCareRecipient(household.id, name, dateOfBirth);
        if (data) setCareRecipient(data);
        return { error };
      },
      updateFeedInterval: async (minutes) => {
        if (!careRecipient) return { error: new Error('No care recipient to update') };
        const { data, error } = await updateFeedIntervalMinutes(careRecipient.id, minutes);
        if (data) setCareRecipient(data);
        return { error };
      },
      caregivers,
      isLoadingCaregivers,
      refreshCaregivers: async () => {
        if (!household) return;
        setIsLoadingCaregivers(true);
        const fetched = await fetchHouseholdCaregivers(household.id);
        setCaregivers(fetched);
        setIsLoadingCaregivers(false);
      },
      inviteCaregiver: async (email) => {
        if (!household) return { error: new Error('No household to invite a caregiver to') };
        const { error } = await createHouseholdInvite(household.id, email);
        if (error) return { error: new Error(toCalmInviteMessage(error)) };
        return { error: null };
      },
    }),
    [household, careRecipient, isLoading, caregivers, isLoadingCaregivers]
  );

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>;
}

export function useHousehold(): HouseholdContextValue {
  const context = useContext(HouseholdContext);
  if (!context) {
    throw new Error('useHousehold must be used within a HouseholdProvider');
  }
  return context;
}
