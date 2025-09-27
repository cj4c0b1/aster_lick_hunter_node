import { NextRequest, NextResponse } from 'next/server';
import { errorLogsDb } from '@/lib/db/errorLogsDb';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid error ID' },
        { status: 400 }
      );
    }

    const error = await errorLogsDb.getError(id);

    if (!error) {
      return NextResponse.json(
        { error: 'Error not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ error });
  } catch (error) {
    console.error('Failed to get error:', error);
    return NextResponse.json(
      { error: 'Failed to get error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid error ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { resolved, notes } = body;

    if (resolved === true) {
      await errorLogsDb.markResolved(id, notes);
      return NextResponse.json({
        message: 'Error marked as resolved',
        id
      });
    }

    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Failed to update error:', error);
    return NextResponse.json(
      { error: 'Failed to update error' },
      { status: 500 }
    );
  }
}