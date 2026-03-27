import { NextRequest, NextResponse } from 'next/server';
import { PrintifyService, PrintifyError } from '@/lib/printify';

export const runtime = 'nodejs';
export const maxDuration = 30;

const PRODUCT_BLUEPRINTS: Record<string, number> = {
  tee: 5,
  hoodie: 6,
  pillow: 9,
  mug: 439,
  canvas: 536,
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter');

    const allBlueprints = await PrintifyService.getBlueprints();

    const yourBlueprintIds = Object.values(PRODUCT_BLUEPRINTS);
    let filtered = allBlueprints.filter((bp) =>
      yourBlueprintIds.includes(bp.id)
    );

    if (filter) {
      const requested = filter.split(',').map((f) => f.trim());
      const requestedIds = requested
        .map((key) => PRODUCT_BLUEPRINTS[key])
        .filter(Boolean);
      filtered = filtered.filter((bp) => requestedIds.includes(bp.id));
    }

    const enriched = filtered.map((bp) => {
      const key = Object.entries(PRODUCT_BLUEPRINTS).find(
        ([, id]) => id === bp.id
      )?.[0] ?? 'unknown';

      return {
        ...bp,
        productKey: key,
        displayName: getDisplayName(key),
        recommendedRetail: getRecommendedRetail(key),
      };
    });

    return NextResponse.json({
      blueprints: enriched,
      total: enriched.length,
    });

  } catch (error) {
    console.error('[/api/printify/blueprints] Error:', error);

    if (error instanceof PrintifyError) {
      return NextResponse.json(
        { error: error.message, detail: error.detail },
        { status: error.statusCode >= 400 ? error.statusCode : 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch product catalogue. Please try again.' },
      { status: 500 }
    );
  }
}

function getDisplayName(key: string): string {
  const names: Record<string, string> = {
    tee: 'Custom Couple T-Shirt',
    hoodie: 'Custom Couple Hoodie',
    pillow: 'Custom Couple Pillow',
    mug: 'Custom Couple Mug',
    canvas: 'Custom Couple Canvas Print',
  };
  return names[key] ?? key;
}

function getRecommendedRetail(key: string): {
  min: number;
  max: number;
  suggested: number;
} {
  const prices: Record
    string,
    { min: number; max: number; suggested: number }
  > = {
    tee:    { min: 3500, max: 4500, suggested: 4200 },
    hoodie: { min: 5500, max: 7500, suggested: 6500 },
    pillow: { min: 4500, max: 5500, suggested: 5200 },
    mug:    { min: 3500, max: 4500, suggested: 4000 },
    canvas: { min: 4500, max: 6500, suggested: 5500 },
  };
  return prices[key] ?? { min: 3000, max: 5000, suggested: 4000 };
}

export async function POST() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}