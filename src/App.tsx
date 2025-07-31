// src/App.tsx

import {useState, useEffect} from 'react';
// import {GoogleGenAI} from '@google/genai'; // Commented out as 'ai' is not used yet
import { SignedIn, SignedOut, SignInButton, UserButton, useUser, useAuth } from "@clerk/clerk-react";
import { supabase } from './supabaseClient';

// const ai = new GoogleGenAI({apiKey: import.meta.env.VITE_GEMINI_API_KEY}); // Commented out as 'ai' is not used yet
// const Spinner = () => ( /* ... spinner svg code ... */ ); // Commented out as 'Spinner' is not used yet

function ViralVideoScriptGenerator() {
  const { user } = useUser();
  const { getToken } = useAuth();

  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [isFetchingCredits, setIsFetchingCredits] = useState(true);

  useEffect(() => {
    const loadUserData = async () => {
      if (user) {
        setIsFetchingCredits(true);
        try {
          const supabaseToken = await getToken({ template: 'supabase' });
          if (!supabaseToken) {
            throw new Error("Unable to get Supabase token from Clerk.");
          }
          await supabase.auth.setSession({ access_token: supabaseToken, refresh_token: '' });

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
          setCreditBalance(0);
        } finally {
          setIsFetchingCredits(false);
        }
      }
    };

    loadUserData();
  }, [user, getToken]);


  // --- All unused states and handlers are temporarily commented out ---
  /*
  const [topic, setTopic] = useState('');
  const [videoLength, setVideoLength] = useState('Short-form');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [generatedScript, setGeneratedScript] = useState('');
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {};
  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {}, []);
  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {}, []);
  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {}, []);
  const handleGenerateScript = async () => {};
  */

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
        
        {/* We will add the rest of the UI back here in the next steps */}
        
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