import { AppError } from '../../lib/errors.js';
import type { RateDeckDownload } from './types.js';

const safeFilename = (value: string): string => {
  const cleaned = value.replace(/[\\/:*?"<>|\r\n]+/g, '-').trim();
  return cleaned.toLowerCase().endsWith('.csv') ? cleaned : `${cleaned || 'rates'}.csv`;
};

const responseFilename = (header: string | null, fallback: string): string => {
  if (!header) return safeFilename(fallback);
  const utf8 = header.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plain = header.match(/filename="?([^";]+)"?/i)?.[1];
  const candidate = utf8 ? decodeURIComponent(utf8) : plain;
  return safeFilename(candidate || fallback);
};

export async function fetchRateDeckFile(
  url: string,
  fallbackFilename: string,
  headers: Record<string, string> = {},
): Promise<RateDeckDownload> {
  const response = await fetch(url, { headers: { Accept: 'text/csv,application/octet-stream,*/*', ...headers } });
  if (!response.ok) throw new AppError(502, 'peeredge_rate_download', `Rate download returned ${response.status}`);
  return {
    filename: responseFilename(response.headers.get('content-disposition'), fallbackFilename),
    contentType: response.headers.get('content-type') || 'text/csv; charset=utf-8',
    bytes: new Uint8Array(await response.arrayBuffer()),
  };
}
