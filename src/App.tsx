// src/App.tsx

import {useState, useCallback, DragEvent, useEffect} from 'react';
import {GoogleGenAI} from '@google/genai';
// --- useAuth is the new, important import ---
import { SignedIn, SignedOut, SignInButton, UserButton, useUser, useAuth } from "@clerk/clerk-react"; 
import { supabase } from './supabaseClient';

const ai = new GoogleGenAI({apiKey: import.meta.env.VITE_GEMINI_API_KEY});
const Spinner = () => ( /* ... spinner svg code ... */ );

function ViralVideoScriptGenerator() {
  const { user } = useUser();
  const { getToken } = useAuth(); // <-- NEW: Get the getToken function from Clerk

  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [isFetchingCredits, setIsFetchingCredits] = useState(true);

  // --- NEW: This useEffect authenticates our Supabase client ---
  useEffect(() => {
    const setSupabaseAuth = async () => {
      if (user) {
        // Get a special token from Clerk that Supabase understands
        const supabaseToken = await getToken({ template: 'supabase' });
        if (supabaseToken) {
          // Set the token for the Supabase client
          supabase.auth.setSession({ access_token: supabaseToken, refresh_token: '' });
        }
      }
    };

    setSupabaseAuth();
  }, [user, getToken]);


  // This useEffect now depends on the authenticated client to fetch credits
  useEffect(() => {
    if (user) {
      const fetchCredits = async () => {
        setIsFetchingCredits(true);
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('credit_balance')
            .eq('id', user.id)
            .single();

          if (error) {
            console.error("Error fetching profile:", error);
            if (error.code === 'PGRST116') { 
              setCreditBalance(0);
            }
          } else if (data) {
            setCreditBalance(data.credit_balance);
          }
        } catch (err) {
          console.error("An unexpected error occurred:", err);
        } finally {
          setIsFetchingCredits(false);
        }
      };

      fetchCredits();
    }
  }, [user]);


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