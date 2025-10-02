import { createClient } from '@supabase/supabase-js';

const rawUrl = (import.meta as any)?.env?.VITE_SUPABASE_URL as string | undefined;
const rawAnon = (import.meta as any)?.env?.VITE_SUPABASE_ANON_KEY as string | undefined;

function isHttpUrl(v: string | undefined): v is string {
	if (!v || typeof v !== 'string') return false;
	try {
		const u = new URL(v);
		return u.protocol === 'http:' || u.protocol === 'https:';
	} catch {
		return false;
	}
}

let client: ReturnType<typeof createClient> | null = null;
if (isHttpUrl(rawUrl) && rawAnon && !/^\s*$/.test(rawAnon)) {
	try {
		client = createClient(rawUrl, rawAnon);
	} catch (e: any) {
		// eslint-disable-next-line no-console
		console.warn('[Supabase] Disabled — invalid configuration:', e?.message || e);
		client = null;
	}
} else if (rawUrl || rawAnon) {
	// eslint-disable-next-line no-console
	console.warn('[Supabase] Disabled — missing or invalid VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY');
}

export const supabase = client;
