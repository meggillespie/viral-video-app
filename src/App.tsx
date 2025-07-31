// src/App.tsx

import {useState, useCallback, DragEvent, useEffect} from 'react'; // <-- Added useEffect
import {GoogleGenAI} from '@google/genai';
import { SignedIn, SignedOut, SignInButton, UserButton, useUser } from "@clerk/clerk-react";
import { supabase } from './supabaseClient'; // <-- Import our new Supabase client

// ... (The rest of your imports and the 'ai' and 'Spinner' constants remain the same) ...
const ai = new GoogleGenAI({apiKey: import.meta.env.VITE_GEMINI_API_KEY});
const Spinner = () => ( /* ... spinner svg code ... */ );


// This is your main application logic, now wrapped as a component
function ViralVideoScriptGenerator() {
  const { user } = useUser();
  
  // --- NEW: State for credit balance ---
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [isFetchingCredits, setIsFetchingCredits] = useState(true);


  // --- NEW: useEffect to fetch credits when the user logs in ---
  useEffect(() => {
    if (user) {
      const fetchCredits = async () => {
        setIsFetchingCredits(true);
        try {
          // Fetch the user's profile from Supabase
          const { data, error } = await supabase
            .from('profiles')
            .select('credit_balance')
            .eq('id', user.id)
            .single(); // .single() expects only one row and makes it an object

          if (error) {
            console.error("Error fetching profile:", error);
            // Handle case where profile might not exist yet, though webhook should prevent this
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
  }, [user]); // This effect runs whenever the 'user' object changes


  // --- STATE MANAGEMENT (Your existing states) ---
  const [topic, setTopic] = useState('');
  // ... (rest of your existing state variables) ...
  const [videoLength, setVideoLength] = useState('Short-form');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [generatedScript, setGeneratedScript] = useState('');
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');


  // ... (All your existing handler functions: handleFileChange, handleDrop, etc. remain the same) ...
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { /* ... */ };
  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => { /* ... */ }, []);
  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => { /* ... */ }, []);
  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => { /* ... */ }, []);
  const handleGenerateScript = async () => { /* ... */ };


  // --- UI RENDERING ---
  return (
    <div className="bg-gray-50 min-h-screen flex items-center justify-center p-4 font-sans">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-3xl space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-800">
            Viral Video Script Generator
          </h1>
          <p className="text-gray-500 mt-2">
            Welcome, {user?.firstName || 'Creator'}!
          </p>
          {/* --- NEW: Display Credit Balance --- */}
          <div className="mt-2 text-sm text-gray-600">
            {isFetchingCredits ? (
              <span>Loading credits...</span>
            ) : (
              <span>Credits remaining: <strong>{creditBalance ?? 0}</strong></span>
            )}
          </div>
        </div>
        
        {/* ... (The rest of your existing UI for inputs, buttons, etc.) ... */}
        
      </div>
    </div>
  );
}


// This is the main export that controls what users see
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