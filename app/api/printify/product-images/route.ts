import { NextRequest, NextResponse } from 'next/server';
import { PrintifyService, PrintifyError } from '@/lib/printify';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const idsParam = request.nextUrl.searchParams.get('ids');
  if (!idsParam) {
    return NextResponse.json({ error: 'Missing ids parameter' }, { status: 400 });
  }

  const ids = idsParam.split(',').map(Number).filter((n) => !isNaN(n));
  if (ids.length === 0) {
    return NextResponse.json({});
  }

  try {
    const blueprints = await PrintifyService.getBlueprints();
    const result: Record<number, string> = {};

    for (const bp of blueprints) {
      if (ids.includes(bp.id) && bp.images.length > 0) {
        result[bp.id] = bp.images[0];
      }
    }

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, max-age=3600' },
    });
  } catch (error) {
    if (error instanceof PrintifyError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: 'Failed to fetch product images.' }, { status: 500 });
  }
}
