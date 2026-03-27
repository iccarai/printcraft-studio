import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { StorageService, StorageError } from '@/lib/storage';

export const runtime = 'nodejs';
export const maxDuration = 60;

const ExportRequestSchema = z.object({
  orderId: z.string().min(1),
  base64Image: z.string().min(1, 'Image data is required'),
  format: z.enum(['png', 'pdf']).default('png'),
  quality: z.enum(['web', 'print']).default('print'),
});

type ExportRequest = z.infer<typeof ExportRequestSchema>;

const QUALITY_CONFIG = {
  web: {
    maxDimension: 1500,
    description: 'Web quality (1500px)',
  },
  print: {
    maxDimension: 3000,
    description: 'Print quality (3000px)',
  },
} as const;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = ExportRequestSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return NextResponse.json(
        { error: `Invalid request: ${firstError.message}` },
        { status: 400 }
      );
    }

    const data: ExportRequest = parsed.data;
    const qualityConfig = QUALITY_CONFIG[data.quality];

    console.log(
      `[/api/export] Starting export for order ${data.orderId} ` +
      `format=${data.format} quality=${data.quality}`
    );

    let imageBuffer: Buffer;
    try {
      imageBuffer = Buffer.from(data.base64Image, 'base64');

      if (imageBuffer.length < 1024) {
        return NextResponse.json(
          { error: 'Image data is too small or corrupted.' },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: 'Failed to decode image data.' },
        { status: 400 }
      );
    }

    let outputBuffer: Buffer;
    let fileExtension: string;

    if (data.format === 'pdf') {
      outputBuffer = await buildPdf(imageBuffer, data.orderId);
      fileExtension = 'pdf';
    } else {
      outputBuffer = await processPng(
        imageBuffer,
        qualityConfig.maxDimension
      );
      fileExtension = 'png';
    }

    console.log(
      `[/api/export] Export processed for order ${data.orderId}: ` +
      `${(outputBuffer.length / 1024).toFixed(0)}KB`
    );

    let exportUrl: string;
    try {
      const uploadResult = await StorageService.uploadExport(
        outputBuffer,
        data.orderId,
        data.format
      );
      exportUrl = uploadResult.url;
    } catch (err) {
      console.error(`[/api/export] Upload failed for ${data.orderId}:`, err);

      if (err instanceof StorageError) {
        return NextResponse.json(
          { error: err.message },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to prepare download. Please try again.' },
        { status: 500 }
      );
    }

    scheduleExportCleanup(exportUrl, data.orderId);

    console.log(
      `[/api/export] Export ready for order ${data.orderId}: ${exportUrl}`
    );

    return NextResponse.json({
      success: true,
      orderId: data.orderId,
      downloadUrl: exportUrl,
      fileName: `printcraft-portrait-${data.orderId}.${fileExtension}`,
      format: data.format,
      quality: qualityConfig.description,
      fileSizeKB: Math.round(outputBuffer.length / 1024),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });

  } catch (error) {
    console.error('[/api/export] Unexpected error:', error);

    return NextResponse.json(
      { error: 'Export failed. Please try again.' },
      { status: 500 }
    );
  }
}

async function processPng(
  buffer: Buffer,
  maxDimension: number
): Promise<Buffer> {
  try {
    const sharp = await import('sharp').catch(() => null);

    if (sharp) {
      return await sharp.default(buffer)
        .resize(maxDimension, maxDimension, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .png({
          quality: 100,
          compressionLevel: 6,
        })
        .toBuffer();
    }

    return buffer;

  } catch (error) {
    console.warn('[/api/export] Sharp processing failed, using raw buffer:', error);
    return buffer;
  }
}

async function buildPdf(
  imageBuffer: Buffer,
  orderId: string
): Promise<Buffer> {
  const imageSize = imageBuffer.length;
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 40;
  const printWidth = pageWidth - margin * 2;
  const printHeight = pageHeight - margin * 2;

  const pdf = [
    '%PDF-1.4',
    '1 0 obj',
    '<< /Type /Catalog /Pages 2 0 R >>',
    'endobj',
    '2 0 obj',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    'endobj',
    '3 0 obj',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}]`,
    '/Contents 4 0 R /Resources << /XObject << /Im1 5 0 R >> >> >>',
    'endobj',
    '4 0 obj',
    `<< /Length 44 >>`,
    'stream',
    `q ${printWidth} 0 0 ${printHeight} ${margin} ${margin} cm /Im1 Do Q`,
    'endstream',
    'endobj',
    '5 0 obj',
    `<< /Type /XObject /Subtype /Image /Width 3000 /Height 3000`,
    `/ColorSpace /DeviceRGB /BitsPerComponent 8`,
    `/Filter /DCTDecode /Length ${imageSize} >>`,
    'stream',
  ].join('\n');

  const pdfHeader = Buffer.from(pdf);
  const pdfFooter = Buffer.from([
    '',
    'endstream',
    'endobj',
    'xref',
    `0 6`,
    '0000000000 65535 f',
    '0000000009 00000 n',
    '0000000058 00000 n',
    '0000000115 00000 n',
    '0000000266 00000 n',
    '0000000360 00000 n',
    'trailer',
    '<< /Size 6 /Root 1 0 R >>',
    'startxref',
    '0',
    '%%EOF',
  ].join('\n'));

  return Buffer.concat([pdfHeader, imageBuffer, pdfFooter]);
}

function scheduleExportCleanup(url: string, orderId: string): void {
  setTimeout(async () => {
    try {
      await StorageService.deleteFile(url);
      console.log(`[/api/export] Cleaned up export for order ${orderId}`);
    } catch {
      console.warn(`[/api/export] Cleanup failed for ${orderId}`);
    }
  }, 10 * 60 * 1000);
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}