export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    if (!url || !url.startsWith('http')) {
      return new Response('Valid URL required', { status: 400 });
    }

    // Attempt to proxy from local FastAPI backend if running
    try {
      const backendRes = await fetch(`http://127.0.0.1:8000/api/screenshot?url=${encodeURIComponent(url)}`, {
        signal: AbortSignal.timeout(6000),
      });
      if (backendRes.ok) {
        const blob = await backendRes.arrayBuffer();
        return new Response(blob, {
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=86400',
          },
        });
      }
    } catch {
      // Local backend not reachable on 8000 or timed out
    }

    // Fallback: return 404 so UI displays the clean fallback badge/link
    return new Response('Screenshot capture unavailable', { status: 404 });
  } catch {
    return new Response('Screenshot capture failed', { status: 500 });
  }
}
