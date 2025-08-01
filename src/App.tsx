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
          <UserButton afterSignOutUrl="/" />
        </SignedIn>
      </header>
      <main>
        <SignedIn>
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


// --- This component now handles all of its own data and logic ---
function ViralVideoScriptGenerator() {
  const { user } = useUser();
  const { getToken } = useAuth(); 

  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [isFetchingCredits, setIsFetchingCredits] = useState(true);

  // This useEffect now calls our secure Supabase Edge Function
  useEffect(() => {
    const loadUserData = async () => {
      // We wait until we have a user and the getToken function is ready
      if (user && getToken) {
        setIsFetchingCredits(true);
        try {
          // 1. Get the authentication token from Clerk
          const token = await getToken({ template: 'supabase' });
          if (!token) throw new Error("Clerk token not found.");

          // 2. Call our new 'get-credits' Edge Function with the auth token
          const { data, error } = await supabase.functions.invoke('get-credits', {
            headers: { Authorization: `Bearer ${token}` }
          });

          if (error) throw error;

          // 3. Set the credit balance from the function's response
          setCreditBalance(data.credit_balance);

        } catch (error) {
          console.error("Error loading user data:", error);
          setCreditBalance(0); // Default to 0 on error
        } finally {
          setIsFetchingCredits(false);
        }
      }
    };
    loadUserData();
  }, [user, getToken]); // This effect runs when the user logs in

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
          <div className="mt-2 text-sm text-gray-600">
            {isFetchingCredits ? (
              <span>Loading credits...</span>
            ) : (
              <span>Credits remaining: <strong>{creditBalance ?? 0}</strong></span>
            )}
          </div>
        </div>
        {/* We will add the UI for the generator back in here later */}
      </div>
    </div>
  );
}