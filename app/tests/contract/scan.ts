/**
 * Reads the app's source code so tests can check what the UI *actually* calls,
 * instead of what someone remembers it calls.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

export const APP_DIR = path.resolve(import.meta.dirname, '../..');
export const REPO_DIR = path.resolve(APP_DIR, '..');

export interface SourceFile {
  file: string; // relative to app/
  text: string;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

/** Every .ts/.tsx file under app/app (routes) and app/src. */
export function appSources(): SourceFile[] {
  return [...walk(path.join(APP_DIR, 'app')), ...walk(path.join(APP_DIR, 'src'))].map((full) => ({
    file: path.relative(APP_DIR, full).replaceAll('\\', '/'),
    text: readFileSync(full, 'utf8'),
  }));
}

export interface ApiCall {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  /** Path with `${…}` placeholders replaced by ":param". */
  path: string;
  where: string; // file:line
}

const lineOf = (text: string, index: number) => text.slice(0, index).split('\n').length;
const normalisePath = (p: string) => p.replace(/\$\{[^}]+\}/g, ':param').split('?')[0];

/** All HTTP calls the app makes: api.get/post/patch/delete(...), plus uploads and the SSE stream. */
export function apiCalls(sources = appSources()): ApiCall[] {
  const calls: ApiCall[] = [];
  for (const { file, text } of sources) {
    // api.post<Order>(`/orders/${id}/accept`, …)  — the generic is optional and may contain { … }.
    const re = /\bapi\.(get|post|patch|delete)\s*(?:<[\s\S]*?>)?\s*\(\s*([`'"])([^`'"]*)\2/g;
    for (const m of text.matchAll(re)) {
      calls.push({
        method: m[1].toUpperCase() as ApiCall['method'],
        path: normalisePath(m[3]),
        where: `${file}:${lineOf(text, m.index!)}`,
      });
    }
    // `${API_BASE_URL}/uploads` (uploadImage) and `${API_BASE_URL}/events?token=…` (SSE).
    for (const m of text.matchAll(/\$\{API_BASE_URL\}(\/[A-Za-z0-9_/.$\{\}-]+)/g)) {
      const p = normalisePath(m[1]);
      calls.push({ method: p === '/uploads' ? 'POST' : 'GET', path: p, where: `${file}:${lineOf(text, m.index!)}` });
    }
  }
  return calls;
}

export interface Navigation {
  pathname: string;
  where: string;
}

/** Every literal route the app navigates to with router.push/replace or <Link href>. */
export function navigations(sources = appSources()): Navigation[] {
  const out: Navigation[] = [];
  const patterns = [
    /router\.(?:push|replace|navigate)\(\s*([`'"])([^`'"]+)\1/g, //            router.push('/kirim/paket')
    /router\.(?:push|replace|navigate)\(\s*\{\s*pathname:\s*([`'"])([^`'"]+)\1/g, // router.push({ pathname: '…' })
    /href=\{?\s*([`'"])(\/[^`'"]*)\1/g, //                                     <Link href="/…">
  ];
  for (const { file, text } of sources) {
    for (const re of patterns) {
      for (const m of text.matchAll(re)) out.push({ pathname: m[2], where: `${file}:${lineOf(text, m.index!)}` });
    }
  }
  return out;
}

/** Route patterns that expo-router builds from the files in app/app, e.g. "/kirim/lacak/[id]". */
export function routeFiles(): Set<string> {
  const routesDir = path.join(APP_DIR, 'app');
  const routes = new Set<string>();
  for (const full of walk(routesDir)) {
    const rel = path.relative(routesDir, full).replaceAll('\\', '/').replace(/\.tsx?$/, '');
    if (rel.split('/').some((seg) => seg.startsWith('_'))) continue; // _layout, +not-found handled by router
    routes.add(toRoutePattern('/' + rel));
  }
  return routes;
}

/** Drops (group) segments and trailing /index so "/(kirim)/beranda" and "/beranda" compare equal. */
export function toRoutePattern(p: string): string {
  const segs = p.split('/').filter((s) => s && !/^\(.*\)$/.test(s));
  if (segs[segs.length - 1] === 'index') segs.pop();
  return '/' + segs.join('/');
}
