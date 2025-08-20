// src/index.tsx

import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App'; // Import our newly refactored App component
import './index.css';
import { ClerkProvider } from '@clerk/clerk-react';
import { dark } from '@clerk/themes';

// Get the key from your environment variables
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Clerk Publishable Key");
}

const root = createRoot(document.getElementById('root')!);

root.render(
  <React.StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: '#E600FF', 
          colorBackground: '#111115', 
          colorText: '#F5F5F7',
          colorInputBackground: '#26262A',
          colorInputText: '#F5F5F7',
        },
        elements: {
          userButtonPopoverFooter: {
            display: 'none',
          },
          footer: { 
            display: 'none',
          }
        }
      }}
    >
      <App />
    </ClerkProvider>
  </React.StrictMode>,
);