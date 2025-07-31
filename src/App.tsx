// src/App.tsx

import {useState, useEffect} from 'react';
// We need to import useAuth to get the token
import { SignedIn, SignedOut, SignInButton, UserButton, useUser, useAuth } from "@clerk/clerk-react"; 
import { supabase } from './supabaseClient';

// This is the main component that controls what users see
export default function App() {
  // We are moving the logic that needs authentication here
  const { isSignedIn, user } = useUser();
  const { getToken } = useAuth(); 

  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [isFetchingCredits, setIsFetchingCredits] = useState(true);

  // This single, combined useEffect handles authentication and data fetching
  useEffect(() => {
    const loadUserData = async () => {
      if (isSignedIn) {
        setIsFetchingCredits(true);
        try {
          // 1. Get the authentication token from Clerk
          const supabaseToken = await getToken({ template: 'supabase' });
          if (!supabaseToken) {
            throw new Error("Unable to get Supabase token from Clerk.");
          }
          
          // 2. Set the session for the Supabase client
          await supabase.auth.setSession({ access_token: supabaseToken, refresh_token: '' });

          // 3. NOW that the client is authenticated, fetch the profile
          const { data, error } = await supabase
            .from('profiles')
            .select('credit_balance')
            .eq('id', user.id)
            .single();

          if (error) throw error;
          
          if (data) {
            setCreditBalance(data.credit_balance);
          }
        } catch (error) {
          console.error("Error loading user data:", error);
          setCreditBalance(0); // Default to 0 on error
        } finally {
          setIsFetchingCredits(false);
        }
      }
    };

    loadUserData();
  }, [isSignedIn, user, getToken]);

  return (
    <div>
      <header className="p-4 flex justify-end items-center space-x-4">
        <SignedIn>
          {/* We will display the credits here in the header */}
          <div className="text-sm text-gray-600">
            {isFetchingCredits ? (
              <span>Loading...</span>
            ) : (
              <span>Credits: <strong>{creditBalance ?? 0}</strong></span>
            )}
          </div>
          <UserButton afterSignOutUrl="/" />
        </SignedIn>
      </header>
      <main>
        <SignedIn>
          {/* We pass the credit balance down to the generator component */}
          <ViralVideoScriptGenerator />
        </SignedIn>
        <SignedOut>
          <div className="text-center p-16">
            <h2 className="text-2xl font-bold text-gray-800">Welcome!</h2>
            <p className="text-gray-600 my-4">Please sign in to continue.</p>
            <SignInButton mode="modal">
                <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">
                    Sign In
                </button>
            </SignInButton>
          </div>
        </SignedOut>
      </main>
    </div>
  )
}


// --- This component is now just for the UI ---
function ViralVideoScriptGenerator() {
  const { user } = useUser();

  // All the state and handlers for the generator UI will live here
  // For now, it's just the display
  
  return (
    <div className="bg-gray-50 flex items-center justify-center p-4 font-sans">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-3xl space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-800">
            Viral Video Script Generator
          </h1>
          <p className="text-gray-500 mt-2">
            Welcome, {user?.firstName || 'Creator'}!
          </p>
        </div>
        
        {/* We will add the rest of the UI (inputs, buttons) back here later */}
        
      </div>
    </div>
  );
}