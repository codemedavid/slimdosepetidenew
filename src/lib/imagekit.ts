// ImageKit helpers: uploads go straight from the browser to ImageKit (signed by
// /api/imagekit-auth), and images are served from ImageKit's CDN resized to the
// size they are displayed at — so no image bytes come out of Supabase egress.

const URL_ENDPOINT = (import.meta.env.VITE_IMAGEKIT_URL_ENDPOINT as string | undefined)?.replace(/\/+$/, '');
const PUBLIC_KEY = import.meta.env.VITE_IMAGEKIT_PUBLIC_KEY as string | undefined;

const UPLOAD_API = 'https://upload.imagekit.io/api/v1/files/upload';
const AUTH_ENDPOINT = '/api/imagekit-auth';
const ROOT_FOLDER = '/slimdose';
const DEFAULT_QUALITY = 80;

export const isImageKitEnabled = Boolean(URL_ENDPOINT && PUBLIC_KEY);

interface UploadAuth {
  token: string;
  expire: number;
  signature: string;
}

interface UploadResult {
  url: string;
  fileId: string;
}

export const isImageKitUrl = (url: string): boolean =>
  (URL_ENDPOINT !== undefined && url.startsWith(URL_ENDPOINT)) || url.includes('ik.imagekit.io/');

/**
 * Returns a CDN URL resized to `width` CSS pixels (doubled for retina screens)
 * with automatic WebP/AVIF. Non-ImageKit URLs (local /assets files) are returned unchanged.
 */
export function optimizedImageUrl(
  url: string | null | undefined,
  width: number,
  quality: number = DEFAULT_QUALITY,
): string {
  if (!url) return '';
  if (!isImageKitUrl(url) || /[?&]tr=/.test(url) || url.includes('/tr:')) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}tr=w-${Math.round(width * 2)},q-${quality},f-auto`;
}

async function fetchUploadAuth(): Promise<UploadAuth> {
  const response = await fetch(AUTH_ENDPOINT, { cache: 'no-store' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.signature) {
    throw new Error(body.error || `Could not get upload permission (HTTP ${response.status}).`);
  }
  return body as UploadAuth;
}

/** Uploads a file to ImageKit under /slimdose/<folder> and returns its CDN URL. */
export async function uploadToImageKit(file: File, folder: string, fileName: string): Promise<UploadResult> {
  if (!isImageKitEnabled || !PUBLIC_KEY) {
    throw new Error('ImageKit is not configured (VITE_IMAGEKIT_URL_ENDPOINT / VITE_IMAGEKIT_PUBLIC_KEY).');
  }

  const auth = await fetchUploadAuth();
  const form = new FormData();
  form.append('file', file);
  form.append('fileName', fileName);
  form.append('folder', `${ROOT_FOLDER}/${folder}`);
  form.append('useUniqueFileName', 'true');
  form.append('publicKey', PUBLIC_KEY);
  form.append('token', auth.token);
  form.append('expire', String(auth.expire));
  form.append('signature', auth.signature);

  const response = await fetch(UPLOAD_API, { method: 'POST', body: form });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.url) {
    throw new Error(`Upload failed: ${body.message || `HTTP ${response.status}`}`);
  }
  return { url: body.url as string, fileId: body.fileId as string };
}
