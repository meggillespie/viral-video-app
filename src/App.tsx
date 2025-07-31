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

  useEffect(() => {
    const loadUserData = async () => {
      console.log("--- Starting loadUserData ---");
      if (user && user.id) { 
        console.log("User object is ready. User ID:", user.id);
        setIsFetchingCredits(true);
        try {
          console.log("Attempting to get Supabase token from Clerk...");
          const supabaseToken = await getToken({ template: 'supabase' });
          
          if (!supabaseToken) {
            console.error("CRITICAL: Failed to get Supabase token from Clerk.");
            throw new Error("Clerk token not found.");
          }
          console.log("Successfully got Supabase token.");

          console.log("Attempting to set Supabase session...");
          await supabase.auth.setSession({ access_token: supabaseToken, refresh_token: '' });
          console.log("Supabase session set successfully.");

          console.log("Attempting to fetch profile from Supabase for user:", user.id);
          const { data, error } = await supabase
            .from('profiles')
            .select('credit_balance')
            .eq('id', user.id);

          if (error) {
            console.error("Supabase fetch error:", error);
            throw error;
          }
          
          console.log("Supabase fetch successful. Data received:", data);

          if (data && data.length > 0) {
            console.log("Profile found. Setting credit balance to:", data[0].credit_balance);
            setCreditBalance(data[0].credit_balance);
          } else {
            console.warn("No profile found for this user in the database.");
            setCreditBalance(0);
          }
        } catch (error) {
          console.error("Full error in catch block:", error);
          setCreditBalance(0);
        } finally {
          setIsFetchingCredits(false);
          console.log("--- Finished loadUserData ---");
        }
      } else {
        console.log("User object not ready yet, skipping fetch.");
      }
    };

    loadUserData();
  }, [user, getToken]);

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
      </div>
    </div>
  );
}