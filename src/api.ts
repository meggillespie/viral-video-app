/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */

import {FunctionDeclaration, GoogleGenAI, File} from '@google/genai';

const systemInstruction = `When given a video and a query, call the relevant \
function only once with the appropriate timecodes and text for the video`;

const ai = new GoogleGenAI({apiKey: process.env.VITE_GEMINI_API_KEY});

async function generateContent(
  text: string,
  functionDeclarations: FunctionDeclaration[],
  file: File,
) {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          {text},
          {
            fileData: {
              mimeType: file.mimeType as string,
              fileUri: file.uri as string,
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

async function uploadFile(file: globalThis.File) {
  console.log('Uploading...');
  const uploadedFile = await ai.files.upload({
    file,
    displayName: file.name,
  });
  console.log('Uploaded.');
  console.log('Getting...');
  let getFile = await ai.files.get({
    name: uploadedFile.name,
  });
  while (getFile.state === 'PROCESSING') {
    // Wait for 5 seconds before checking again
    await new Promise((resolve) => setTimeout(resolve, 5000));
    getFile = await ai.files.get({
      name: uploadedFile.name,
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
