// src/App.tsx

import {useState, useCallback, DragEvent} from 'react';
import {GoogleGenAI} from '@google/genai';
import { SignedIn, SignedOut, SignInButton, UserButton, useUser } from "@clerk/clerk-react";

// Initialize the GoogleGenAI client.
// It's assumed that VITE_GEMINI_API_KEY is configured in the environment.
const ai = new GoogleGenAI({apiKey: import.meta.env.VITE_GEMINI_API_KEY});

// SVG icon for the loading spinner
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

// This is your main application logic, now wrapped as a component
function ViralVideoScriptGenerator() {
  const { user } = useUser(); // Hook to get the signed-in user's data

  // --- STATE MANAGEMENT ---
  const [topic, setTopic] = useState('');
  const [videoLength, setVideoLength] = useState('Short-form');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [generatedScript, setGeneratedScript] = useState('');
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // --- FILE HANDLING ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setVideoFile(e.target.files[0]);
      setYoutubeUrl(''); // Clear URL if a file is selected
    }
  };

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      // Ensure it's a video file
      if (e.dataTransfer.files[0].type.startsWith('video/')) {
        setVideoFile(e.dataTransfer.files[0]);
        setYoutubeUrl(''); // Clear URL if a file is dropped
        setError('');
      } else {
        setError('Please drop a valid video file.');
      }
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  // --- CORE LOGIC: SCRIPT GENERATION ---
  const handleGenerateScript = async () => {
    // 1. Reset states and start loading
    setError('');
    setGeneratedScript('');
    setStatusMessage('');

    // 2. Input validation
    if (!topic) {
      setError('Please enter a topic.');
      return;
    }
    if (!youtubeUrl && !videoFile) {
      setError('Please provide a YouTube URL or upload a video file.');
      return;
    }
    if (youtubeUrl && videoFile) {
      setError('Please provide either a YouTube URL or a file, not both.');
      return;
    }

    setIsLoading(true);

    try {
      // 3. Construct the prompt for the AI model
      const prompt = `Analyze the provided video's key elements: the hook, pacing, visual style, editing cuts, on-screen text usage, and overall format. Then, using those 'viral' elements as inspiration, generate a complete ${videoLength} video script for the topic of '${topic}'. The script should include a strong opening hook, clear sections, calls to action, and placeholders for customization like [Your Name] or [Your Product]. Format the output clearly with headings for each section (e.g., Hook, Part 1, Part 2, Call to Action).`;

      let videoPart: {fileData: {mimeType: string; fileUri: string}};

      // 4. Handle video data source (URL or File)
      if (youtubeUrl) {
        // Use the provided YouTube URL directly
        videoPart = {
          fileData: {
            mimeType: 'video/youtube',
            fileUri: youtubeUrl,
          },
        };
      } else if (videoFile) {
        // Upload the file first to get a URI
        setStatusMessage('Uploading video... this may take a moment.');

        const uploadedFile = await ai.files.upload({file: videoFile});
        
        if (!uploadedFile.name) {
          throw new Error("Uploaded file is missing a name. Cannot process.");
        }

        setStatusMessage(
          'Processing video... this can take a few minutes for longer videos.',
        );

        // Poll for the file status until it's 'ACTIVE'
        let file = await ai.files.get({name: uploadedFile.name});
        while (file.state === 'PROCESSING') {
          // Wait for 5 seconds before checking again
          await new Promise((resolve) => setTimeout(resolve, 5000));
          file = await ai.files.get({name: file.name});
        }

        if (file.state === 'FAILED') {
          throw new Error('Video processing failed. Please try another video.');
        }

        if (!file.mimeType || !file.uri) {
          throw new Error("Uploaded file is missing required metadata (MIME type or URI).");
        }

        videoPart = {
          fileData: {
            mimeType: file.mimeType, // No 'as string' needed now
            fileUri: file.uri,
          },
        };
      } else {
        // This case is already handled by validation, but as a safeguard:
        throw new Error('No video source provided.');
      }

      setStatusMessage('Analyzing video and generating script...');

      // 5. Call the generative model with the prompt and video data
      const response = await ai.models.generateContent({
        model: 'gemini-1.5-flash', // Note: Using 1.5-flash as 2.5 is not yet available via API
        contents: [{parts: [{text: prompt}, videoPart]}],
      });

      // 6. Display the generated script
      setGeneratedScript(response.text ?? 'No response text received.');
    } catch (err: any) {
      console.error(err);
      setError(
        err.message ||
          'An unexpected error occurred. Please check the console for details.',
      );
      setGeneratedScript('');
    } finally {
      // 7. Stop loading
      setIsLoading(false);
      setStatusMessage('');
    }
  };

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
        </div>

        {/* Topic Input */}
        <div>
          <label
            htmlFor="topic"
            className="block text-sm font-medium text-gray-700 mb-1">
            Video Topic
          </label>
          <input
            type="text"
            id="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g., How to make the perfect sourdough bread"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
            disabled={isLoading}
          />
        </div>

        {/* Video Length */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Video Length
          </label>
          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="videoLength"
                value="Short-form"
                checked={videoLength === 'Short-form'}
                onChange={(e) => setVideoLength(e.target.value)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                disabled={isLoading}
              />
              <span className="text-gray-700">Short-form (e.g., TikTok)</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="videoLength"
                value="Long-form"
                checked={videoLength === 'Long-form'}
                onChange={(e) => setVideoLength(e.target.value)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                disabled={isLoading}
              />
              <span className="text-gray-700">Long-form (e.g., YouTube)</span>
            </label>
          </div>
        </div>

        {/* Video Source */}
        <div className="space-y-4">
          <div>
            <label
              htmlFor="youtubeUrl"
              className="block text-sm font-medium text-gray-700 mb-1">
              Inspiration Video (YouTube URL)
            </label>
            <input
              type="text"
              id="youtubeUrl"
              value={youtubeUrl}
              onChange={(e) => {
                setYoutubeUrl(e.target.value);
                setVideoFile(null);
              }}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
              disabled={isLoading}
            />
          </div>
          <div className="relative flex items-center justify-center text-sm text-gray-400">
            <span className="absolute bg-white px-2">OR</span>
            <div className="w-full h-px bg-gray-300"></div>
          </div>
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`relative block w-full border-2 ${
              isDragging ? 'border-indigo-500' : 'border-gray-300'
            } border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 transition`}>
            <input
              type="file"
              id="videoFile"
              onChange={handleFileChange}
              accept="video/*"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={isLoading}
            />
            <div className="flex flex-col items-center justify-center space-y-1 pointer-events-none">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
                aria-hidden="true">
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="font-medium text-indigo-600 hover:text-indigo-500">
                Upload a file
              </span>
              <span className="text-gray-500"> or drag and drop</span>
              {videoFile && (
                <p className="text-sm text-gray-600 mt-2">
                  Selected: {videoFile.name}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div>
          <button
            onClick={handleGenerateScript}
            disabled={isLoading}
            className="w-full flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 disabled:cursor-not-allowed transition">
            {isLoading ? <Spinner /> : null}
            {isLoading ? 'Generating...' : 'Generate Script'}
          </button>
        </div>

        {/* Display Area */}
        <div className="space-y-4">
          {error && (
            <div
              className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg"
              role="alert">
              <strong className="font-bold">Error: </strong>
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          {isLoading && statusMessage && (
            <div
              className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded-lg"
              role="status">
              <p>{statusMessage}</p>
            </div>
          )}

          {generatedScript && !isLoading && (
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">
                Generated Script:
              </h2>
              <div className="bg-gray-100 p-4 rounded-lg">
                <pre className="whitespace-pre-wrap font-mono text-sm text-gray-700">
                  {generatedScript}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// This is the new main export that controls what users see
export default function App() {
  return (
    <div>
      <header className="p-4 flex justify-end">
        <SignedIn>
          {/* Shows a user profile button with a sign-out option when signed in */}
          <UserButton afterSignOutUrl="/" />
        </SignedIn>
      </header>
      <main>
        <SignedIn>
          {/* Users who are signed in see your main application */}
          <ViralVideoScriptGenerator />
        </SignedIn>
        <SignedOut>
          {/* Users who are signed out see a landing page and sign-in button */}
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