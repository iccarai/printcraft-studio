import { z } from 'zod';

const PRINTIFY_API_KEY = process.env.PRINTIFY_API_KEY;
const PRINTIFY_SHOP_ID = process.env.PRINTIFY_SHOP_ID;
const BASE_URL = 'https://api.printify.com/v1';

if (!PRINTIFY_API_KEY) throw new Error('Missing PRINTIFY_API_KEY');
if (!PRINTIFY_SHOP_ID) throw new Error('Missing PRINTIFY_SHOP_ID');

const BlueprintSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string(),
  brand: z.string(),
  model: z.string(),
  images: z.array(z.string()),
}).passthrough();

const BlueprintListSchema = z.array(BlueprintSchema);

const UploadedImageSchema = z.object({
  id: z.string(),
  file_name: z.string(),
  height: z.number(),
  width: z.number(),
  size: z.number(),
  mime_type: z.string(),
  preview_url: z.string(),
  upload_time: z.string(),
}).passthrough();

const CreatedProductSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  visible: z.boolean(),
  is_locked: z.boolean(),
}).passthrough();

export type Blueprint = z.infer<typeof BlueprintSchema>;
export type UploadedImage = z.infer<typeof UploadedImageSchema>;
export type CreatedProduct = z.infer<typeof CreatedProductSchema>;

export interface PrintProvider {
  id: number;
  title: string;
  [key: string]: unknown;
}

export interface Variant {
  id: number;
  title: string;
  options: Record<string, string>;
  placeholders: Array<{
    position: string;
    height: number;
    width: number;
    [key: string]: unknown;
  }>;
  cost: number;
  enabled: boolean;
  [key: string]: unknown;
}

export interface PrintProviderVariants {
  id: number;
  title: string;
  variants: Variant[];
  [key: string]: unknown;
}

export interface PublishProductInput {
  title: string;
  description: string;
  blueprintId: number;
  printProviderId: number;
  variantIds: number[];
  imageId: string;
  retailPrice: number;
  publishNow: boolean;
  tags: string[];
}

async function printifyFetch<T>(
  path: string,
  options: RequestInit = {},
  schema: z.ZodSchema<T>,
  cacheSeconds = 0
): Promise<T> {
  const url = `${BASE_URL}${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${PRINTIFY_API_KEY}`,
      ...options.headers,
    },
    next: cacheSeconds > 0
      ? { revalidate: cacheSeconds }
      : { revalidate: 0 },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new PrintifyError(res.status, path, body);
  }

  const json = await res.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    console.error('[Printify] Schema mismatch:', parsed.error.flatten());
    console.error('[Printify] Raw response:', JSON.stringify(json).slice(0, 500));
    throw new PrintifyError(0, path, 'Response failed schema validation');
  }

  return parsed.data;
}

async function printifyRawFetch(
  path: string,
  cacheSeconds = 0
): Promise<unknown> {
  const url = `${BASE_URL}${path}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${PRINTIFY_API_KEY}`,
    },
    next: cacheSeconds > 0
      ? { revalidate: cacheSeconds }
      : { revalidate: 0 },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new PrintifyError(res.status, path, body);
  }

  return await res.json();
}

export class PrintifyError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly endpoint: string,
    public readonly detail: string
  ) {
    super(`Printify API error [${statusCode}] on ${endpoint}: ${detail}`);
    this.name = 'PrintifyError';
  }
}

export class PrintifyService {
  static async getBlueprints(): Promise<Blueprint[]> {
    return printifyFetch(
      '/catalog/blueprints.json',
      { method: 'GET' },
      BlueprintListSchema,
      3600
    );
  }

  static async getPrintProviders(
    blueprintId: number
  ): Promise<PrintProvider[]> {
    const json = await printifyRawFetch(
      `/catalog/blueprints/${blueprintId}/print_providers.json`,
      3600
    );
    return json as PrintProvider[];
  }

  static async getProviderVariants(
    blueprintId: number,
    printProviderId: number
  ): Promise<PrintProviderVariants> {
    const json = await printifyRawFetch(
      `/catalog/blueprints/${blueprintId}/print_providers/${printProviderId}/variants.json`,
      3600
    );
    return json as PrintProviderVariants;
  }

  static async uploadImage(
    base64Data: string,
    fileName: string
  ): Promise<UploadedImage> {
    return printifyFetch(
      '/uploads/images.json',
      {
        method: 'POST',
        body: JSON.stringify({
          file_name: fileName,
          contents: base64Data,
        }),
      },
      UploadedImageSchema
    );
  }

  static async createProduct(
    input: PublishProductInput
  ): Promise<{ product: CreatedProduct; productUrl: string }> {
    const payload = {
      title: input.title,
      description: input.description,
      blueprint_id: input.blueprintId,
      print_provider_id: input.printProviderId,
      variants: input.variantIds.map((id) => ({
        id,
        price: input.retailPrice,
        is_enabled: true,
      })),
      print_areas: [
        {
          variant_ids: input.variantIds,
          placeholders: [
            {
              position: 'front',
              images: [
                {
                  id: input.imageId,
                  x: 0.5,
                  y: 0.5,
                  scale: 1,
                  angle: 0,
                },
              ],
            },
          ],
        },
      ],
      tags: input.tags,
    };

    const product = await printifyFetch(
      `/shops/${PRINTIFY_SHOP_ID}/products.json`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      CreatedProductSchema
    );

    if (input.publishNow) {
      await PrintifyService.publishProduct(product.id);
      const published = await PrintifyService.getProduct(product.id);
      const external = (published as Record<string, unknown>).external as { handle?: string } | undefined;
      const productUrl = external?.handle ?? `https://printify.com/app/store/products/${product.id}/edit`;
      return { product, productUrl };
    }

    const productUrl = `https://printify.com/app/store/products/${product.id}/edit`;
    return { product, productUrl };
  }

  static async getProduct(productId: string): Promise<CreatedProduct> {
    return printifyFetch(
      `/shops/${PRINTIFY_SHOP_ID}/products/${productId}.json`,
      { method: 'GET' },
      CreatedProductSchema
    );
  }

  static async publishProduct(productId: string): Promise<void> {
    await fetch(
      `${BASE_URL}/shops/${PRINTIFY_SHOP_ID}/products/${productId}/publish.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${PRINTIFY_API_KEY}`,
        },
        body: JSON.stringify({
          title: true,
          description: true,
          images: true,
          variants: true,
          tags: true,
          keyFeatures: true,
          shipping_template: true,
        }),
      }
    );
  }

  static async getShopProducts(): Promise<unknown[]> {
    const res = await fetch(
      `${BASE_URL}/shops/${PRINTIFY_SHOP_ID}/products.json`,
      {
        headers: { Authorization: `Bearer ${PRINTIFY_API_KEY}` },
      }
    );
    const json = await res.json();
    return json.data ?? [];
  }
}