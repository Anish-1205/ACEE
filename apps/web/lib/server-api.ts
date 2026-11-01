import 'server-only';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

/** Public, cacheable reads for server-rendered pages. Returns null when the API is unreachable so pages still render. */
export async function publicGet<T>(path: string, revalidate = 60): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1${path}`, { next: { revalidate } });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}
