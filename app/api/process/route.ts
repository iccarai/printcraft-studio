import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  processCouplephoto,
  validateInputPhoto,
  AIProcessingError,
  type DesignOptions,
} from '@/lib/ai';
import { StorageService, StorageError } from '@/lib/storage';

export const runtime = 'nodejs';
export const maxDuration = 60;

const ProcessRequestSchema = z.object({
  imageBase64: z.string().min(1, 'Image data is required'),
  imageMime: z.enum([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ]),
  options: z.object({
    artStyle: z.enum(['caricature', 'cartoon', 'sketch', 'comic']),
    orientation: z.enum(['portrait', 'landscape', 'square']),
    partnerName1: z.string().max(50).optional(),
    partnerName2: z.string().max(50).optional(),
    specialDate: z.string().max(50).optional(),
    extraNote: z.string().max(100).optional(),
  }),
});

type ProcessRequest = z.infer<typeof ProcessRequestSchema>;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = ProcessRequestSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return NextResponse.json(
        { error: `Invalid request: ${firstError.message}` },
        { status: 400 }
      );
    }

    const { imageBase64, imageMime, options }: ProcessRequest = parsed.data;

    try {
      validateInputPhoto(imageBase64);
    } catch (err) {
      return NextResponse.json(
        {
          error: err instanceof AIProcessingError
            ? err.message
            : 'Photo validation failed',
        },
        { status: 400 }
      );
    }

    const orderId = `order_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 8)}`;

    console.log(`[/api/process] Starting AI processing for order ${orderId}`);

    let processingResult;
    try {
      processingResult = await processCouplephoto(
        imageBase64,
        imageMime,
        options as DesignOptions
      );
    } catch (err) {
      console.error(`[/api/process] AI processing failed for ${orderId}:`, err);

      if (err instanceof AIProcessingError) {
        return NextResponse.json(
          { error: err.message },
          { status: 422 }
        );
      }

      return NextResponse.json(
        { error: 'Portrait generation failed. Please try again.' },
        { status: 500 }
      );
    }

    console.log(`[/api/process] AI processing complete for order ${orderId}`);

    let uploadResult;
    try {
      uploadResult = await StorageService.uploadProcessedDesign(
        processingResult.base64Image,
        orderId
      );
    } catch (err) {
      console.error(`[/api/process] Design upload failed for ${orderId}:`, err);

      if (err instanceof StorageError) {
        return NextResponse.json(
          { error: err.message },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to save your portrait. Please try again.' },
        { status: 500 }
      );
    }

    console.log(
      `[/api/process] Design uploaded for order ${orderId}: ${uploadResult.url}`
    );

    return NextResponse.json({
      orderId,
      base64Image: processingResult.base64Image,
      dataUrl: `data:image/png;base64,${processingResult.base64Image}`,
      blobUrl: uploadResult.url,
      promptUsed: processingResult.promptUsed,
      appliedOptions: options,
    });

  } catch (error) {
    console.error('[/api/process] Unexpected error:', error);

    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}