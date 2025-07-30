// src/index.tsx

import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App'; // Import our newly refactored App component
import './index.css';
import { ClerkProvider } from '@clerk/clerk-react';

// Get the key from your environment variables
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Clerk Publishable Key");
}

const root = createRoot(document.getElementById('root')!);

root.render(
  <React.StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <App />
    </ClerkProvider>
  </React.StrictMode>,
);