// Sprite dos ícones (/icones.svg): os desenhos longos de src/lib/icones.ts, uma vez só, com cache.
import { spriteSvg } from '../lib/icones';

export function GET() {
  return new Response(spriteSvg(), { headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' } });
}
