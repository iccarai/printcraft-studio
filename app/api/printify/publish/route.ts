import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PrintifyService, PrintifyError } from '@/lib/printify';
import { StorageService, StorageError } from '@/lib/storage';

export const runtime = 'nodejs';
export const maxDuration = 60;

const PublishRequestSchema = z.object({
  orderId: z.string().min(1),
  blobUrl: z.string().url('Invalid design URL'),
  blueprintId: z.number().int().positive(),
  printProviderId: z.number().int().positive(),
  variantIds: z
    .array(z.number().int().positive())
    .min(1, 'Select at least one variant'),
  title: z.string().min(1).max(140),
  description: z.string().max(5000).default(''),
  retailPrice: z.number().int().positive(),
  tags: z.array(z.string().max(20)).max(13).default([]),
  publishNow: z.boolean().default(false),
  fitMode: z.enum(['contain', 'fill']).default('fill'),
  appliedOptions: z.object({
    artStyle: z.string(),
    orientation: z.string(),
    partnerName1: z.string().optional(),
    partnerName2: z.string().optional(),
    specialDate: z.string().optional(),
    extraNote: z.string().optional(),
  }),
});

type PublishRequest = z.infer<typeof PublishRequestSchema>;

function buildDescription(
  blueprintId: number,
  options: PublishRequest['appliedOptions']
): string {
  const personalisation = [
    options.partnerName1 && options.partnerName2
      ? `Names: ${options.partnerName1} & ${options.partnerName2}`
      : options.partnerName1
      ? `Name: ${options.partnerName1}`
      : null,
    options.specialDate ? `Date: ${options.specialDate}` : null,
    options.extraNote ? `Message: "${options.extraNote}"` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const productDetails: Record<number, string> = {
    5: `Custom couple caricature portrait printed on a premium unisex t-shirt.\n\nSoft, comfortable Bella+Canvas 3001 jersey. True to size fit. Machine washable.\n\nPrint method: Direct-to-garment (DTG) for vibrant, lasting colour.`,
    6: `Custom couple caricature portrait on a cosy unisex hoodie.\n\nGildan 18500 heavy blend. Kangaroo pocket. Machine washable.\n\nPrint method: Direct-to-garment (DTG) for vibrant, lasting colour.`,
    9: `Custom couple caricature portrait pillow.\n\nSoft microfibre cover, available in multiple sizes. Insert not included.\n\nPrint method: All-over print (AOP) for edge-to-edge design.`,
    439: `Custom couple caricature portrait mug.\n\n11oz ceramic, dishwasher and microwave safe.\n\nPrint method: Sublimation for photo-quality, fade-resistant colour.`,
    536: `Custom couple caricature portrait canvas print.\n\nPremium gallery-wrapped canvas, ready to hang. Available in multiple sizes.\n\nPrint method: Fine art giclée for museum-quality colour accuracy.`,
  };

  const base = productDetails[blueprintId] ?? 'Custom couple caricature portrait product.';
  const personalisationBlock = personalisation
    ? `\n\nYour personalisation:\n${personalisation}`
    : '';

  return `${base}${personalisationBlock}\n\nEvery portrait is uniquely generated from your photo. No two are alike.\n\nProcessing time: 2–3 business days before shipping.`;
}

function buildTags(
  blueprintId: number,
  customTags: string[]
): string[] {
  const baseTags: Record<number, string[]> = {
    5: ['couple gift', 'custom tshirt', 'caricature portrait', 'boyfriend gift', 'girlfriend gift', 'anniversary gift'],
    6: ['couple hoodie', 'custom hoodie', 'caricature portrait', 'couples gift', 'anniversary gift', 'boyfriend gift'],
    9: ['couple pillow', 'custom pillow', 'caricature portrait', 'couples gift', 'bedroom decor', 'anniversary gift'],
    439: ['couple mug', 'custom mug', 'caricature portrait', 'couples gift', 'funny gift', 'boyfriend gift'],
    536: ['couple portrait', 'canvas print', 'caricature art', 'couples gift', 'wall art', 'anniversary gift', 'custom portrait'],
  };

  const base = baseTags[blueprintId] ?? ['custom portrait', 'couples gift', 'caricature'];
  return [...new Set([...base, ...customTags])].slice(0, 13);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = PublishRequestSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return NextResponse.json(
        { error: `Invalid request: ${firstError.message}` },
        { status: 400 }
      );
    }

    const data: PublishRequest = parsed.data;

    console.log(`[/api/printify/publish] Uploading image for order ${data.orderId}`);

    let printifyImageId: string;
    let printScale = 1;
    try {
      const imageResponse = await fetch(data.blobUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch design from storage: ${imageResponse.status}`);
      }

      const imageBuffer = await imageResponse.arrayBuffer();
      const base64Image = Buffer.from(imageBuffer).toString('base64');

      const uploadedImage = await PrintifyService.uploadImage(
        base64Image,
        `${data.orderId}-design.png`
      );

      printifyImageId = uploadedImage.id;
      console.log(`[/api/printify/publish] Image uploaded to Printify: ${printifyImageId}`);

      // Calculate scale for contain fit mode
      if (data.fitMode === 'contain') {
        try {
          const imageAR = uploadedImage.width / uploadedImage.height;
          const variantData = await PrintifyService.getProviderVariants(
            data.blueprintId,
            data.printProviderId
          );
          const front = variantData.variants[0]?.placeholders?.find(
            (p: { position: string }) => p.position === 'front'
          );
          if (front) {
            const printAR = front.width / front.height;
            printScale = imageAR < printAR ? imageAR / printAR : 1;
            console.log(
              `[/api/printify/publish] contain scale: ${printScale.toFixed(3)} ` +
              `(imageAR=${imageAR.toFixed(3)}, printAR=${printAR.toFixed(3)})`
            );
          }
        } catch {
          console.warn('[/api/printify/publish] Could not fetch print area for scale calc, using 1');
        }
      }

    } catch (err) {
      console.error(`[/api/printify/publish] Image upload failed:`, err);
      return NextResponse.json(
        { error: 'Failed to upload design to Printify. Please try again.' },
        { status: 500 }
      );
    }

    const description = data.description ||
      buildDescription(data.blueprintId, data.appliedOptions);
    const tags = buildTags(data.blueprintId, data.tags);

    console.log(`[/api/printify/publish] Creating Printify product for order ${data.orderId}`);

    let productResult: { product: { id: string; title: string }; productUrl: string };
    try {
      productResult = await PrintifyService.createProduct({
        title: data.title,
        description,
        blueprintId: data.blueprintId,
        printProviderId: data.printProviderId,
        variantIds: data.variantIds,
        imageId: printifyImageId,
        retailPrice: data.retailPrice,
        publishNow: data.publishNow,
        tags,
        scale: printScale,
      });

      console.log(
        `[/api/printify/publish] Product created: ${productResult.product.id}`
      );

    } catch (err) {
      console.error(`[/api/printify/publish] Product creation failed:`, err);

      if (err instanceof PrintifyError) {
        return NextResponse.json(
          { error: err.message, detail: err.detail },
          { status: err.statusCode >= 400 ? err.statusCode : 500 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to create product in Printify. Please try again.' },
        { status: 500 }
      );
    }

    try {
      await StorageService.deleteFile(data.blobUrl);
      console.log(`[/api/printify/publish] Cleaned up Blob file for order ${data.orderId}`);
    } catch {
      console.warn(`[/api/printify/publish] Blob cleanup failed for ${data.orderId}`);
    }

    return NextResponse.json({
      success: true,
      orderId: data.orderId,
      productId: productResult.product.id,
      productTitle: productResult.product.title,
      productUrl: productResult.productUrl,
      publishedToShop: data.publishNow,
      message: data.publishNow
        ? 'Your product is now live in your Printify shop.'
        : 'Your product has been saved as a draft in Printify.',
    });

  } catch (error) {
    console.error('[/api/printify/publish] Unexpected error:', error);

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