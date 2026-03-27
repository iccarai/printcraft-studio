import { NextRequest, NextResponse } from 'next/server';
import { PrintifyService, PrintifyError } from '@/lib/printify';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    const allBlueprints = await PrintifyService.getBlueprints();
    return NextResponse.json({
      blueprints: allBlueprints,
      total: allBlueprints.length,
    });
  } catch (error) {
    console.error('[/api/printify/blueprints] Error:', error);
    if (error instanceof PrintifyError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode >= 400 ? error.statusCode : 500 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to fetch blueprints.' },
      { status: 500 }
    );
  }
}

export async function POST() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}