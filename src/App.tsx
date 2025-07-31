// src/App.tsx

import {useState, useCallback, DragEvent, useEffect} from 'react';
import {GoogleGenAI} from '@google/genai';
import { SignedIn, SignedOut, SignInButton, UserButton, useUser, useAuth } from "@clerk/clerk-react";
import { supabase } from './supabaseClient';

const ai = new GoogleGenAI({apiKey: import.meta.env.VITE_GEMINI_API_KEY});
const Spinner = () => (
  <svg
    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24">
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"></circle>
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

function ViralVideoScriptGenerator() {
  const { user } = useUser();
  const { getToken } = useAuth(); // We need this to get the auth token

  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [isFetchingCredits, setIsFetchingCredits] = useState(true);

  // --- THIS IS THE CORRECTED, COMBINED useEffect HOOK ---
  useEffect(() => {
    const loadUserData = async () => {
      if (user) {
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
  }, [user, getToken]); // Dependencies remain the same


  // --- All your existing states and handlers remain the same ---
  const [topic, setTopic] = useState('');
  const [videoLength, setVideoLength] = useState('Short-form');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [generatedScript, setGeneratedScript] = useState('');
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { /* ... */ };
  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => { /* ... */ }, []);
  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => { /* ... */ }, []);
  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => { /* ... */ }, []);
  const handleGenerateScript = async () => { /* ... */ };

  return (
    <div className="bg-gray-50 min-h-screen flex items-center justify-center p-4 font-sans">
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
        
        {/* ... The rest of your existing UI ... */}
        
      </div>
    </div>
  );
}

// This component remains unchanged
export default function App() {
  return (
    <div>
      <header className="p-4 flex justify-end">
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