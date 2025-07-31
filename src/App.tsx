// src/App.tsx

import {useState, useEffect} from 'react';
import { SignedIn, SignedOut, SignInButton, UserButton, useUser, useAuth } from "@clerk/clerk-react"; 
import { supabase } from './supabaseClient';

// --- This is the main component that controls the overall page layout and auth state ---
export default function App() {
  return (
    <div>
      <header className="p-4 flex justify-end items-center space-x-4">
        <SignedIn>
          {/* The UserButton for sign-out lives here */}
          <UserButton afterSignOutUrl="/" />
        </SignedIn>
      </header>
      <main>
        <SignedIn>
          {/* The main app logic is now fully contained in this component */}
          <ViralVideoScriptGenerator />
        </SignedIn>
        <SignedOut>
          {/* The landing page for signed-out users */}
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


// --- This component now handles all of its own data and logic ---
function ViralVideoScriptGenerator() {
  const { user } = useUser();
  const { getToken } = useAuth(); 

  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [isFetchingCredits, setIsFetchingCredits] = useState(true);

  // This single, robust useEffect handles authentication and data fetching
  useEffect(() => {
    const loadUserData = async () => {
      // **CRUCIAL FIX**: Wait until we have a user and a user.id before doing anything
      if (user && user.id) { 
        setIsFetchingCredits(true);
        try {
          const supabaseToken = await getToken({ template: 'supabase' });
          if (!supabaseToken) throw new Error("Clerk token not found.");
          
          await supabase.auth.setSession({ access_token: supabaseToken, refresh_token: '' });

          const { data, error } = await supabase
            .from('profiles')
            .select('credit_balance')
            .eq('id', user.id) // Now we know user.id is available
            .single();

          if (error) throw error;
          
          if (data) {
            setCreditBalance(data.credit_balance);
          } else {
            setCreditBalance(0); // If no profile is found, default to 0
          }
        } catch (error) {
          console.error("Error loading user data:", error);
          setCreditBalance(0);
        } finally {
          setIsFetchingCredits(false);
        }
      }
    };

    loadUserData();
  }, [user, getToken]); // This effect re-runs when the user object is ready

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
          {/* This display logic is now inside the component that fetches the data */}
          <div className="mt-2 text-sm text-gray-600">
            {isFetchingCredits ? (
              <span>Loading credits...</span>
            ) : (
              <span>Credits remaining: <strong>{creditBalance ?? 0}</strong></span>
            )}
          </div>
        </div>
        
        {/* We will add the rest of the UI (inputs, buttons) back here later */}
        
      </div>
    </div>
  );
}