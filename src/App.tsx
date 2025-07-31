// src/App.tsx

import {useState, useEffect} from 'react';
// We are adding useSession to be 100% sure the user is loaded
import { SignedIn, SignedOut, SignInButton, UserButton, useUser, useAuth, useSession } from "@clerk/clerk-react"; 
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
  const { session } = useSession(); // Get the session object
  const { user } = useUser();
  const { getToken } = useAuth(); 

  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [isFetchingCredits, setIsFetchingCredits] = useState(true);

  useEffect(() => {
    const loadUserData = async () => {
      // **THE FINAL FIX**: We wait until the session is loaded AND we have a user.id
      if (session && user && user.id) { 
        console.log("Attempting to fetch credits for user:", user.id); // Debugging line
        setIsFetchingCredits(true);
        try {
          const supabaseToken = await getToken({ template: 'supabase' });
          if (!supabaseToken) throw new Error("Clerk token not found.");
          
          await supabase.auth.setSession({ access_token: supabaseToken, refresh_token: '' });

          const { data, error } = await supabase
            .from('profiles')
            .select('credit_balance')
            .eq('id', user.id)
            .single();

          if (error) {
            // If the error is "0 rows", it means the profile doesn't exist yet.
            // This can happen if the webhook is slightly delayed. We'll handle it gracefully.
            if (error.code === 'PGRST116') {
              console.warn("Profile not found for user, defaulting to 0 credits for now.");
              setCreditBalance(0);
            } else {
              throw error; // Re-throw other errors
            }
          }
          
          if (data) {
            setCreditBalance(data.credit_balance);
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
  }, [session, user, getToken]); // We add 'session' as a dependency

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
        
        {/* We will add the rest of the UI back here later */}
        
      </div>
    </div>
  );
}