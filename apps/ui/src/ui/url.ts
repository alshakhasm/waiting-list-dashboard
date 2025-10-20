import type { CSSProperties } from 'react';

export type NavParams = {
  set?: Record<string, string | number | boolean | null | undefined>;
  delete?: string[];
  mode?: 'replace' | 'assign';
  path?: string;
  hash?: string;
  navigate?: boolean; // default true
};

export function getBasePath(): string {
  try {
    const path = window.location.pathname || '/';
    const ghBase = '/waiting-list-dashboard';
    return path.startsWith(ghBase) ? ghBase : '';
  } catch {
    return '';
  }
}

export function getRedirectBase(): string {
  try {
    return window.location.origin + getBasePath();
  } catch {
    return window.location.origin;
  }
}

export function buildUrl(params: NavParams): string {
  const u = new URL(window.location.href);
  if (params.path) u.pathname = params.path;
  if (params.hash !== undefined) u.hash = params.hash;
  if (params.delete) for (const k of params.delete) u.searchParams.delete(k);
  if (params.set)
    for (const [k, v] of Object.entries(params.set)) {
      if (v === undefined || v === null || v === false) u.searchParams.delete(k);
      else u.searchParams.set(k, String(v === true ? 1 : v));
    }
  return u.toString();
}

export function navigateWithParams(params: NavParams): string {
  const url = buildUrl(params);
  if (params.navigate === false) return url;
  try {
    if (params.mode === 'replace') {
      window.history.replaceState({}, '', url);
    } else {
      window.location.href = url;
    }
  } catch {
    window.location.href = url;
  }
  return url;
}

