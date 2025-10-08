/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

// Access Vite env directly so it gets statically injected in dev/build
const rawUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const rawAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Minimal, safe debug surface (no secrets) to help verify env detection in the browser console
try {
	(window as any).__SUPABASE_DEBUG__ = {
		hasUrl: !!rawUrl,
		hasAnon: !!rawAnon && !/^\s*$/.test(rawAnon || ''),
		urlHost: (function () {
			try { return rawUrl ? new URL(rawUrl).host : null; } catch { return null; }
		})(),
	};
} catch {}

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
		try { (window as any).__supabase = client; } catch {}
		try {
			const host = new URL(rawUrl).host;
			console.info(`[Supabase] Enabled — ${host}`);
		} catch {}
	} catch (e: any) {
		console.warn('[Supabase] Disabled — invalid configuration:', e?.message || e);
		client = null;
	}
} else if (rawUrl || rawAnon) {
	console.warn('[Supabase] Disabled — missing or invalid VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY');
} else {
	console.warn('[Supabase] Disabled — env vars not found (apps/ui/.env.local missing or not loaded)');
}

export const supabase = client;
