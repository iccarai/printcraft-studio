import { NextRequest, NextResponse } from 'next/server';
import { StorageService, validateFile, StorageError } from '@/lib/storage';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'No file provided. Please select a photo to upload.' },
        { status: 400 }
      );
    }

    try {
      validateFile(file, file.type);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof StorageError ? err.message : 'Invalid file' },
        { status: 400 }
      );
    }

    const result = await StorageService.uploadPhoto(
      file,
      file.type,
      'uploads'
    );

    return NextResponse.json({
      url: result.url,
      pathname: result.pathname,
      contentType: result.contentType,
      sizeKB: Math.round(result.size / 1024),
    });

  } catch (error) {
    console.error('[/api/upload] Error:', error);

    if (error instanceof StorageError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Upload failed. Please try again.' },
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