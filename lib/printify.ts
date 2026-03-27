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

const VariantSchema = z.object({
  id: z.number(),
  title: z.string(),
  options: z.record(z.string()),
  placeholders: z.array(
    z.object({
      position: z.string(),
      height: z.number(),
      width: z.number(),
    }).passthrough()
  ),
  cost: z.number(),
  enabled: z.boolean(),
}).passthrough();

const PrintProviderVariantsSchema = z.object({
  id: z.number(),
  title: z.string(),
  variants: z.array(VariantSchema),
}).passthrough();

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
export type Variant = z.infer<typeof VariantSchema>;
export type PrintProviderVariants = z.infer<typeof PrintProviderVariantsSchema>;
export type UploadedImage = z.infer<typeof UploadedImageSchema>;
export type CreatedProduct = z.infer<typeof CreatedProductSchema>;

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

export interface PrintProvider {
  id: number;
  title: string;
  location: {
    address1: string;
    city: string;
    country: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
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

  static async getProviderVariants(
    blueprintId: number,
    printProviderId: number
  ): Promise<PrintProviderVariants> {
    return printifyFetch(
      `/catalog/blueprints/${blueprintId}/print_providers/${printProviderId}/variants.json`,
      { method: 'GET' },
      PrintProviderVariantsSchema,
      3600
    );
  }

  static async getPrintProviders(
    blueprintId: number
  ): Promise<PrintProvider[]> {
    const res = await fetch(
      `${BASE_URL}/catalog/blueprints/${blueprintId}/print_providers.json`,
      {
        headers: {
          Authorization: `Bearer ${PRINTIFY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        next: { revalidate: 3600 },
      }
    );

    if (!res.ok) {
      const body = await res.text();
      throw new PrintifyError(res.status, `/catalog/blueprints/${blueprintId}/print_providers.json`, body);
    }

    const json = await res.json();
    return json as PrintProvider[];
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
    }

    const productUrl = `https://printify.com/app/store/products/${product.id}/edit`;

    return { product, productUrl };
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