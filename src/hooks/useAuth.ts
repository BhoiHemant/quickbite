import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useRestaurantStore } from '../store/useRestaurantStore';
import * as api from '../api/restaurantApi';

export interface UserProfile {
  id: string;
  email: string;
  role: 'owner';
}

export const useAuth = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { setHotel, setUserId, clearAllData } = useRestaurantStore();

    useEffect(() => {
      let isMounted = true;
      console.log('[Auth Debug] Initializing Auth State listener...');

      // Safety release timeout to prevent loading lock if Supabase connection hangs
      const safetyTimeout = setTimeout(() => {
        if (isMounted) {
          console.warn('[Auth Debug] Safety release timeout triggered. Releasing auth loader gate.');
          setLoading(false);
        }
      }, 2500);

      // Single unified listener handles startup session check and state changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log(`[Auth Debug] onAuthStateChange event triggered: ${event}`);
        if (!isMounted) return;

        setLoading(true);
        setError(null);
        
        try {
          if (session?.user) {
            console.log('[Auth Debug] Active session found for user:', session.user.email);
            const loggedUser: UserProfile = {
              id: session.user.id,
              email: session.user.email || '',
              role: 'owner'
            };
            
            if (isMounted) {
              setUser(loggedUser);
              setUserId(session.user.id);
            }

            // Fetch hotel configuration with a robust 2-second timeout to prevent database locks
            console.log('[Database Fetch Debug] Restoring hotel state for owner:', session.user.id);
            const hotel = await Promise.race([
              api.getHotelByOwner(session.user.id),
              new Promise<null>((resolve) => setTimeout(() => {
                console.warn('[Database Fetch Debug] Hotel fetch timed out after 2000ms. Falling back.');
                resolve(null);
              }, 2000))
            ]);
            
            if (isMounted) {
              if (hotel) {
                console.log('[Database Fetch Debug] Hotel config restored:', hotel.name);
                setHotel(hotel);
              } else {
                console.log('[Database Fetch Debug] No hotel configuration found.');
                setHotel(null);
              }
            }
          } else {
            console.log('[Auth Debug] No active session. Cleaning credentials...');
            if (isMounted) {
              setUser(null);
              setUserId(null);
              setHotel(null);
            }
          }
        } catch (err: any) {
          const errMsg = err?.message || err || 'Authentication error occurred';
          console.error('[Auth Debug] Error in onAuthStateChange callback:', errMsg);
          if (isMounted) {
            setError(String(errMsg));
          }
        } finally {
          if (isMounted) {
            clearTimeout(safetyTimeout);
            setLoading(false);
            console.log('[Auth Debug] Auth initialization completed. Loading released.');
          }
        }
      });

      return () => {
        isMounted = false;
        clearTimeout(safetyTimeout);
        subscription.unsubscribe();
      };
    }, [setHotel, setUserId, clearAllData]);

  const login = async (email: string, password: string) => {
    setError(null);
    setLoading(true);
    console.log('[Auth Debug] Initiating login attempt for email:', email);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (signInError) throw signInError;
      
      console.log('[Auth Debug] Login successful for user:', data.user.email);
      const loggedUser: UserProfile = {
        id: data.user.id,
        email: data.user.email || '',
        role: 'owner'
      };
      setUser(loggedUser);
      setUserId(data.user.id);

      console.log('[Database Fetch Debug] Querying hotel config for logged user:', data.user.id);
      const hotel = await api.getHotelByOwner(data.user.id);
      if (hotel) {
        console.log('[Database Fetch Debug] Hotel loaded successfully:', hotel.name);
        setHotel(hotel);
      } else {
        console.log('[Database Fetch Debug] No hotel configured yet.');
        setHotel(null);
      }

      return { user: loggedUser, error: null };
    } catch (err: any) {
      console.error('[Auth Debug] Login execution failed:', err.message, err.stack);
      setError(err.message);
      setLoading(false);
      return { user: null, error: err.message };
    }
  };

  const signup = async (email: string, password: string) => {
    setError(null);
    setLoading(true);
    console.log('[Auth Debug] Initiating signup attempt for email:', email);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password
      });
      if (signUpError) throw signUpError;

      if (!data.user) throw new Error('Signup succeeded but user is null');
      
      console.log('[Auth Debug] Signup successful. User ID created:', data.user.id);

      // Check if email confirmation is required (session will be null if verification email is sent)
      const { data: { session } } = await supabase.auth.getSession();
      const isUnconfirmed = !session && data.user.identities && data.user.identities.length > 0;
      
      if (isUnconfirmed) {
        console.log('[Auth Debug] Email confirmation is required. Account created but unverified.');
      }

      const loggedUser: UserProfile = {
        id: data.user.id,
        email: data.user.email || '',
        role: 'owner'
      };
      
      if (isUnconfirmed) {
        setUser(null);
        setUserId(null);
        setLoading(false);
        return { user: loggedUser, error: 'email_not_confirmed' };
      }

      setUser(loggedUser);
      setUserId(data.user.id);
      setHotel(null); // Force setup wizard

      return { user: loggedUser, error: null };
    } catch (err: any) {
      console.error('[Auth Debug] Signup execution failed:', err.message, err.stack);
      setError(err.message);
      setLoading(false);
      return { user: null, error: err.message };
    }
  };

  const resendVerification = async (email: string) => {
    console.log('[Auth Debug] Resending verification link to:', email);
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email
      });
      if (resendError) throw resendError;
      console.log('[Auth Debug] Verification email sent successfully to:', email);
      return { error: null };
    } catch (err: any) {
      console.error('[Auth Debug] Resending verification link failed:', err.message, err.stack);
      return { error: err.message };
    }
  };

  const logout = async () => {
    setLoading(true);
    console.log('[Auth Debug] Executing profile signout...');
    try {
      await supabase.auth.signOut();
      console.log('[Auth Debug] User signed out and cache flushed.');
    } catch (err: any) {
      console.error('[Auth Debug] Supabase signOut error:', err.message);
    } finally {
      setUser(null);
      setUserId(null);
      clearAllData();
      setLoading(false);
    }
  };

  return {
    user,
    loading,
    error,
    login,
    signup,
    resendVerification,
    logout,
    isMock: false
  };
};
