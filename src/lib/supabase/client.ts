import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

// EXPO_PUBLIC_* variables are inlined at build time from .env.local.
// If either is missing, the Supabase client will fail to connect —
// create your .env.local from .env.example before running the app.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// SecureStoreAdapter persists the Supabase session token using the iOS Keychain
// and Android Keystore. The session survives app restarts and cannot be read
// by other apps on the device.
const SecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: SecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
