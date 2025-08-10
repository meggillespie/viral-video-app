// File: backend/src/routes/generate-image-content.ts

import { Request, Response } from 'express';
import { vertexAI, imageQueue, withBackoff } from '../services';

// Use Imagen 3. Auto-pick based on whether a reference image is uploaded.
function pickImagenModel(hasReferenceImage: boolean) {
  // Capability = editing/customization/style transfer; Fast = prompt→image speed
  return hasReferenceImage ? 'imagen-3.0-capability-001' : 'imagen-3.0-fast-generate-001';
}

function sizeForAspect(aspect?: string) {
  // Keep your current square output; add aspect support later if you expose it in the UI.
  return { width: 1024, height: 1024 };
}

function buildPrompt(topic: string, details: string, styleInfluence: number) {
  const influence = Math.max(0, Math.min(100, Number(styleInfluence)));
  const guide =
    influence > 0
      ? `Use the uploaded image as a STYLE GUIDE with ~${influence}% influence (palette, mood, composition) without copying it exactly.`
      : `Do not use the uploaded image for styling.`;

  return `Create a high-quality social image for the topic: "${topic}". ${details || ''}
${guide}
- Strong focal subject, clean composition, high contrast.
- Suitable for social sharing; avoid tiny text unless requested.`;
}

// (kept) small helper to generate social text + optional headline with Gemini
async function generateSocialText(topic: string, details: string, headlineWanted: boolean) {
  const model = vertexAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
  const prompt = `You are a social copywriter.

Topic: "${topic}"
${details ? `Details: ${details}` : ''}

Return concise copy for three platforms and an optional headline:
- LinkedIn: 1 short paragraph + a CTA. Professional tone.
- Twitter: <= 250 characters, punchy, with 1-2 relevant hashtags.
- Instagram: 1-2 short lines + 2-3 playful hashtags.
${headlineWanted ? '- Headline: 6-10 words, bold and catchy.' : ''}

Output JSON with keys: linkedin, twitter, instagram${headlineWanted ? ', headline' : ''}.`;

  const resp = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  });

  const text = resp.response?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '{}';

  try {
    const parsed = JSON.parse(text);
    return {
      linkedin: parsed.linkedin || '',
      twitter: parsed.twitter || '',
      instagram: parsed.instagram || '',
      headline: headlineWanted ? parsed.headline || null : null,
    };
  } catch {
    return {
      linkedin: `Sharing quick insights on ${topic}.`,
      twitter: `${topic} — thoughts and takeaways.`,
      instagram: `On ${topic} today! ✨`,
      headline: headlineWanted ? topic : null,
    };
  }
}

export const generateImageContent = async (req: Request, res: Response) => {
  try {
    const sourceImage: any =
      (req as any).file ||
      (req as any).files?.sourceImage ||
      (Array.isArray((req as any).files) ? (req as any).files[0] : undefined);

    const { topic, details, styleInfluence, withTextOverlay } = req.body;
    if (!topic) return res.status(400).json({ error: 'Topic is required.' });
    if (!sourceImage) return res.status(400).json({ error: 'Source image file is required.' });

    const includeText = String(withTextOverlay ?? 'true') === 'true';

    const prompt = buildPrompt(String(topic), String(details || ''), Number(styleInfluence || 0));
    const { width, height } = sizeForAspect();

    const modelId = pickImagenModel(!!sourceImage);
    const model = vertexAI.getGenerativeModel({ model: modelId });

    // Build parts: reference image (if present) + prompt
    const parts: any[] = [{ text: prompt }];

    if (sourceImage) {
      const buf: Buffer =
        sourceImage.buffer ||
        sourceImage.data ||
        (typeof sourceImage.arrayBuffer === 'function'
          ? Buffer.from(await sourceImage.arrayBuffer())
          : undefined);

      if (!buf) return res.status(400).json({ error: 'Could not read uploaded image.' });

      parts.unshift({
        inlineData: {
          mimeType: sourceImage.mimetype || 'image/png',
          data: buf.toString('base64'),
        },
      });
    }

    // Queue + backoff to avoid 429 bursts
    const gen = await imageQueue(() =>
      withBackoff(() =>
        model.generateContent({
          contents: [{ role: 'user', parts }],
          generationConfig: {
            // width/height accepted by Imagen 3 for text-to-image/edit
            // @ts-expect-error: width/height supported by Imagen 3
            width,
            height,
            seed: Math.floor(Math.random() * 1e9),
          },
        })
      )
    );

    const imagePart =
      gen?.response?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'));

    if (!imagePart?.inlineData?.data) {
      return res.status(502).json({ error: 'No image returned by model.' });
    }

    const base64 = imagePart.inlineData.data;
    const mime = imagePart.inlineData.mimeType || 'image/png';
    const imageUrl = `data:${mime};base64,${base64}`;

    const copy = await withBackoff(() => generateSocialText(String(topic), String(details || ''), includeText));

    return res.status(200).json({
      result: {
        imageUrl,
        posts: {
          linkedin: copy.linkedin,
          twitter: copy.twitter,
          instagram: copy.instagram,
        },
        headline: copy.headline,
      },
    });
  } catch (error: any) {
    console.error('--- FATAL ERROR in /api/generate-image-content ---', error);
    const code = Number(error?.code || error?.status) || 500;
    return res.status(code).json({ error: error?.message || 'An internal server error occurred.' });
  }
};
