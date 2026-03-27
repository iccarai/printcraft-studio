import { GoogleGenerativeAI, Part } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? '';

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export type ArtStyle =
  | 'caricature'
  | 'cartoon'
  | 'sketch'
  | 'comic';

export type Orientation = 'portrait' | 'landscape' | 'square';

export interface DesignOptions {
  artStyle: ArtStyle;
  orientation: Orientation;
  partnerName1?: string;
  partnerName2?: string;
  specialDate?: string;
  extraNote?: string;
}

export interface ProcessingResult {
  base64Image: string;
  mimeType: 'image/png';
  promptUsed: string;
}

export class AIProcessingError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'AIProcessingError';
  }
}

const STYLE_PROMPTS: Record<ArtStyle, string> = {
  caricature: `
    Transform this couple photo into a warm, loving caricature portrait.
    Gently and flatteringly exaggerate their most endearing facial features.
    Bold clean outlines, vibrant cheerful colours, expressive and fun.
    The tone must feel celebratory and romantic — never mean-spirited.
    Think professional caricature artist at a theme park, but elevated.
  `.trim(),

  cartoon: `
    Transform this couple photo into a charming cartoon portrait.
    Stylised with smooth clean lines, flat bold colours, and a modern
    animated feel. Think high-quality greeting card illustration.
    Expressive faces, warm and romantic mood throughout.
  `.trim(),

  sketch: `
    Transform this couple photo into a detailed pencil sketch portrait.
    Fine hatching lines, subtle shading, romantic and intimate mood.
    The style should feel like a hand-drawn gift from an artist.
    Clean white background, print-ready composition.
  `.trim(),

  comic: `
    Transform this couple photo into a bold comic book style portrait.
    Strong ink outlines, halftone shading, vibrant pop-art colours.
    Dynamic and fun composition that feels celebratory.
    Clean white background, suitable for printing on apparel and canvas.
  `.trim(),
};

const ORIENTATION_PROMPTS: Record<Orientation, string> = {
  portrait: 'Compose the image in portrait orientation (taller than wide). Both subjects centred and filling the frame from the waist up.',
  landscape: 'Compose the image in landscape orientation (wider than tall). Both subjects side by side, upper body visible.',
  square: 'Compose the image as a square format. Both subjects centred, tight framing from shoulders up.',
};

export function buildCaricaturePrompt(options: DesignOptions): string {
  const styleInstructions = STYLE_PROMPTS[options.artStyle];
  const orientationInstructions = ORIENTATION_PROMPTS[options.orientation];

  const hasPersonalisation =
    options.partnerName1 ||
    options.partnerName2 ||
    options.specialDate ||
    options.extraNote;

  const personalisationBlock = hasPersonalisation
    ? `
      PERSONALISATION — include exactly as specified:
      ${options.partnerName1 && options.partnerName2
        ? `- Add the names "${options.partnerName1} & ${options.partnerName2}" in elegant, playful lettering below the portrait.`
        : options.partnerName1
        ? `- Add the name "${options.partnerName1}" in elegant lettering below the portrait.`
        : ''}
      ${options.specialDate
        ? `- Include the date "${options.specialDate}" in smaller text beneath the names.`
        : ''}
      ${options.extraNote
        ? `- Add this short message at the bottom: "${options.extraNote}"`
        : ''}
      All text must be clearly legible, integrated naturally into the design,
      and suitable for high-resolution printing.
    `.trim()
    : '';

  return `
    You are a professional caricature and portrait artist creating a
    custom gift product for a couple.

    ${styleInstructions}

    ${orientationInstructions}

    ${personalisationBlock}

    TECHNICAL REQUIREMENTS — follow exactly:
    - Pure white background, no shadows or gradients behind subjects
    - Minimum 2000x2000px equivalent detail level
    - No watermarks, signatures, or AI-generated artifacts
    - Print-ready: high contrast, colours suitable for DTG and canvas printing
    - Do not add any text unless specified in the personalisation section above
    - Both people must be clearly recognisable from the source photo
    - The overall mood must be warm, romantic, and gift-appropriate

    This image will be printed on apparel, canvas, mugs, pillows and hoodies
    as a custom gift product. Quality and printability are the top priority.
  `.trim();
}

export async function processCouplephoto(
  imageBase64: string,
  imageMime: string,
  options: DesignOptions
): Promise<ProcessingResult> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-preview-04-17',
    generationConfig: {
      temperature: 0.7,
      topP: 0.9,
      maxOutputTokens: 8192,
    },
  });

  const prompt = buildCaricaturePrompt(options);

  const imagePart: Part = {
    inlineData: {
      mimeType: imageMime as 'image/jpeg' | 'image/png' | 'image/webp',
      data: imageBase64,
    },
  };

  const textPart: Part = {
    text: prompt,
  };

  try {
    const result = await model.generateContent([imagePart, textPart]);
    const response = result.response;

    const candidate = response.candidates?.[0];
    if (!candidate) {
      throw new AIProcessingError('No output candidate returned from Gemini');
    }

    const outputImagePart = candidate.content.parts.find(
      (part) => part.inlineData?.mimeType?.startsWith('image/')
    );

    if (!outputImagePart?.inlineData?.data) {
      const textOutput = candidate.content.parts
        .find((part) => part.text)
        ?.text;
      console.error('[AI] Gemini returned text instead of image:', textOutput);
      throw new AIProcessingError(
        'Gemini did not return an image. The input photo may be unclear or violate content policies.'
      );
    }

    return {
      base64Image: outputImagePart.inlineData.data,
      mimeType: 'image/png',
      promptUsed: prompt,
    };
  } catch (error) {
    if (error instanceof AIProcessingError) throw error;
    throw new AIProcessingError(
      'Image processing failed. Please try again with a clearer photo.',
      error
    );
  }
}

export function validateInputPhoto(base64Image: string): boolean {
  const minBytes = 10 * 1024;
  const actualBytes = (base64Image.length * 3) / 4;

  if (actualBytes < minBytes) {
    throw new AIProcessingError(
      'Photo is too small or corrupted. Please upload a clear couple photo.'
    );
  }

  return true;
}

export const ART_STYLE_OPTIONS: {
  value: ArtStyle;
  label: string;
  description: string;
  emoji: string;
}[] = [
  {
    value: 'caricature',
    label: 'Caricature',
    description: 'Fun and flattering, perfect for the apology gift',
    emoji: '🎨',
  },
  {
    value: 'cartoon',
    label: 'Cartoon',
    description: 'Clean and modern, like an animated movie still',
    emoji: '✨',
  },
  {
    value: 'sketch',
    label: 'Pencil Sketch',
    description: 'Romantic hand-drawn feel, timeless and elegant',
    emoji: '✏️',
  },
  {
    value: 'comic',
    label: 'Comic Art',
    description: 'Bold pop-art style, vibrant and eye-catching',
    emoji: '💥',
  },
];

export const ORIENTATION_OPTIONS: {
  value: Orientation;
  label: string;
  description: string;
}[] = [
  {
    value: 'portrait',
    label: 'Portrait',
    description: 'Best for canvas prints and pillows',
  },
  {
    value: 'square',
    label: 'Square',
    description: 'Best for mugs and social media',
  },
  {
    value: 'landscape',
    label: 'Landscape',
    description: 'Best for hoodies and wide prints',
  },
];