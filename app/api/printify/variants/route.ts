import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PrintifyService, PrintifyError } from '@/lib/printify';

export const runtime = 'nodejs';
export const maxDuration = 30;

const PREFERRED_PROVIDERS: Record<number, number> = {
  12:  99,   // Unisex Jersey Short Sleeve Tee -> Printify Choice
  229: 10,   // Spun Polyester Square Pillowcase -> MWW On Demand
  439: 3,    // Three-Panel Fleece Hoodie -> Marco Fine Arts
  635: 99,   // Accent Coffee Mug -> Printify Choice
  937: 105,  // Matte Canvas, Stretched 0.75" -> Jondo
  // Legacy / kept for backward compat
  5:   99,
  6:   99,
  9:   2,
};

const VariantsQuerySchema = z.object({
  blueprintId: z.string().regex(/^\d+$/, 'blueprintId must be a number'),
  printProviderId: z.string().regex(/^\d+$/).optional(),
  listProviders: z.enum(['true', 'false']).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const query = VariantsQuerySchema.safeParse({
      blueprintId: searchParams.get('blueprintId'),
      printProviderId: searchParams.get('printProviderId') ?? undefined,
      listProviders: searchParams.get('listProviders') ?? undefined,
    });

    if (!query.success) {
      return NextResponse.json(
        { error: `Invalid parameters: ${query.error.errors[0].message}` },
        { status: 400 }
      );
    }

    const blueprintId = parseInt(query.data.blueprintId);

    if (query.data.listProviders === 'true') {
      const providers = await PrintifyService.getPrintProviders(blueprintId);
      return NextResponse.json({ providers });
    }

    let printProviderId: number;

    if (query.data.printProviderId) {
      printProviderId = parseInt(query.data.printProviderId);
    } else if (PREFERRED_PROVIDERS[blueprintId]) {
      printProviderId = PREFERRED_PROVIDERS[blueprintId];
    } else {
      return NextResponse.json(
        {
          error: `No print provider configured for blueprint ${blueprintId}. Pass ?printProviderId=X explicitly.`,
        },
        { status: 400 }
      );
    }

    const providerVariants = await PrintifyService.getProviderVariants(
      blueprintId,
      printProviderId
    );

    const enrichedVariants = providerVariants.variants.map((variant) => ({
      ...variant,
      costFormatted: `$${(variant.cost / 100).toFixed(2)}`,
      suggestedRetail: Math.ceil((variant.cost * 3) / 100) * 100,
      suggestedRetailFormatted: `$${(Math.ceil((variant.cost * 3) / 100)).toFixed(2)}`,
      isPremiumSize: isPremiumSize(variant.options),
    }));

    const groupedByColour = groupVariantsByColour(enrichedVariants);

    return NextResponse.json({
      blueprintId,
      printProviderId,
      providerTitle: providerVariants.title,
      variants: enrichedVariants,
      groupedByColour,
      total: enrichedVariants.length,
      printAreas: extractPrintAreas(providerVariants.variants),
    });

  } catch (error) {
    console.error('[/api/printify/variants] Error:', error);

    if (error instanceof PrintifyError) {
      return NextResponse.json(
        { error: error.message, detail: error.detail },
        { status: error.statusCode >= 400 ? error.statusCode : 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch product variants. Please try again.' },
      { status: 500 }
    );
  }
}

function isPremiumSize(options: Record<string, string>): boolean {
  const size = options['size'] ?? options['Size'] ?? '';
  return ['2XL', '3XL', '4XL', '5XL', 'XXL', 'XXXL'].some((s) =>
    size.toUpperCase().includes(s)
  );
}

function groupVariantsByColour(
  variants: Array<{
    id: number;
    title: string;
    options: Record<string, string>;
    cost: number;
    costFormatted: string;
    enabled: boolean;
    isPremiumSize: boolean;
  }>
): Record<string, typeof variants> {
  return variants.reduce(
    (acc, variant) => {
      const colour =
        variant.options['color'] ??
        variant.options['Color'] ??
        variant.options['colour'] ??
        'Default';

      if (!acc[colour]) acc[colour] = [];
      acc[colour].push(variant);
      return acc;
    },
    {} as Record<string, typeof variants>
  );
}

function extractPrintAreas(
  variants: Array<{
    placeholders: Array<{
      position: string;
      height: number;
      width: number;
    }>;
  }>
): Array<{ position: string; width: number; height: number }> {
  const seen = new Set<string>();
  const areas: Array<{ position: string; width: number; height: number }> = [];

  for (const variant of variants) {
    for (const placeholder of variant.placeholders) {
      const key = `${placeholder.position}-${placeholder.width}-${placeholder.height}`;
      if (!seen.has(key)) {
        seen.add(key);
        areas.push({
          position: placeholder.position,
          width: placeholder.width,
          height: placeholder.height,
        });
      }
    }
  }

  return areas;
}

export async function POST() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}
