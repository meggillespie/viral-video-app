/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */

import {FunctionDeclaration, GoogleGenAI, File as GenAIFile} from '@google/genai';

const systemInstruction = `When given a video and a query, call the relevant function only once with the appropriate timecodes and text for the video`;

// --- Corrected AI Client Initialization ---

// Get the API key from the environment variables
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// Throw an error if the API key is missing
if (!API_KEY) {
  throw new Error('VITE_GEMINI_API_KEY is not set in the environment.');
}

// Initialize the client only if the key exists
const ai = new GoogleGenAI({apiKey: API_KEY});


// --- Corrected generateContent Function ---
async function generateContent(
  text: string,
  functionDeclarations: FunctionDeclaration[],
  file: GenAIFile,
) {
  // Add checks to ensure file metadata exists before using it
  if (!file.mimeType || !file.uri) {
    throw new Error('Uploaded file is missing required metadata (MIME type or URI).');
  }

  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          {text},
          {
            fileData: {
              mimeType: file.mimeType, // Now safe to use
              fileUri: file.uri,       // Now safe to use
            },
          },
        ],
      },
    ],
    config: {
      systemInstruction,
      temperature: 0.5,
      tools: [{functionDeclarations}],
    },
  });

  return response;
}


// --- Corrected uploadFile Function ---
async function uploadFile(file: globalThis.File) {
  console.log('Uploading...');
  const uploadedFile = await ai.files.upload({
    file,
  });
  console.log('Uploaded.');
  
  // Add a check to ensure the uploaded file has a name
  if (!uploadedFile.name) {
    throw new Error("Uploaded file doesn't have a name, cannot get status.");
  }
  
  console.log('Getting...');
  let getFile = await ai.files.get({
    name: uploadedFile.name, // Now safe to use
  });

  while (getFile.state === 'PROCESSING') {
    // Wait for 5 seconds before checking again
    await new Promise((resolve) => setTimeout(resolve, 5000));
    getFile = await ai.files.get({
      name: uploadedFile.name, // Now safe to use
    });
    console.log(`current file status: ${getFile.state}`);
  }

  console.log(getFile.state);
  if (getFile.state === 'FAILED') {
    throw new Error('File processing failed.');
  }

  console.log('Done');
  return getFile;
}

export {generateContent, uploadFile};