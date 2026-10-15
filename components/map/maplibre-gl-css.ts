// Runtime CSS injection for maplibre-gl on web
// Metro bundler doesn't support CSS imports, so we inject via <link> tag

const CSS_ID = 'maplibre-gl-css';
const CSS_URL = 'https://unpkg.com/maplibre-gl@5.20.1/dist/maplibre-gl.css';

export function ensureMapLibreCSS(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(CSS_ID)) return;

  const link = document.createElement('link');
  link.id = CSS_ID;
  link.rel = 'stylesheet';
  link.href = CSS_URL;
  document.head.appendChild(link);
}
