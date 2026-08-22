import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { CareRecipient, createCareRecipient, fetchCareRecipient } from '@/features/careRecipients/api';
import { useSession } from '@/features/auth/session-provider';

import { createHouseholdRpc, fetchHouseholdForUser, Household } from './api';

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
};

const HouseholdContext = createContext<HouseholdContextValue | undefined>(undefined);

export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  const { session } = useSession();
  const userId = session?.user?.id ?? null;

  const [household, setHousehold] = useState<Household | null>(null);
  const [careRecipient, setCareRecipient] = useState<CareRecipient | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

      const fetchedHousehold = await fetchHouseholdForUser(userId);
      if (cancelled) return;
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
  }, [userId]);

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
    }),
    [household, careRecipient, isLoading],
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
