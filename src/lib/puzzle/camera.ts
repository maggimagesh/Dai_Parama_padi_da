export const MIN_CAMERA_ZOOM = 1;
export const MAX_CAMERA_ZOOM = 3;
export const CAMERA_ZOOM_STEP = 0.1;

/** Client hints where available; UA fallback for Safari and other browsers. */
export function isPhoneCamera(userAgent: string, mobileHint?: boolean): boolean {
  return mobileHint === true || /iPhone|iPod|Android.*Mobile|Windows Phone|IEMobile|Opera Mini/i.test(userAgent);
}

export function clampCameraZoom(value: number): number {
  if (!Number.isFinite(value)) return MIN_CAMERA_ZOOM;
  return Math.round(Math.min(MAX_CAMERA_ZOOM, Math.max(MIN_CAMERA_ZOOM, value)) * 10) / 10;
}

/** Matches a centered, square object-fit: cover video scaled by digital zoom. */
export function cameraCrop(width: number, height: number, zoom: number) {
  const side = Math.min(width, height) / clampCameraZoom(zoom);
  return { x: (width - side) / 2, y: (height - side) / 2, side };
}
