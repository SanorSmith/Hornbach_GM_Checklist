import { NextResponse } from 'next/server';
import { AuthError, requireUser } from '@/lib/auth/guard';
import { repository } from '@/lib/repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Serves one photo.
 *
 * Behind authentication, always: these are pictures of a workplace, attached to
 * a named employee's checklist. They are never public, and the cache header is
 * `private` so no shared proxy keeps a copy.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await params;

    const file = await repository().readAttachment(id);
    if (!file) {
      return NextResponse.json({ ok: false, error: 'Bilden finns inte.' }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(file.bytes), {
      headers: {
        'content-type': file.contentType,
        'content-length': String(file.bytes.byteLength),
        'cache-control': 'private, max-age=3600',
        'content-disposition': 'inline',
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    throw error;
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireUser();
    const { id } = await params;
    await repository().deleteAttachment(id, session.userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    throw error;
  }
}
