import { createHash } from 'node:crypto';
import type { Database } from './database';

// Images stay out of product/config JSON responses. Immutable content URLs can be cached by the CDN.
export async function separateImage(database: Database, image?: string) {
  if (!image?.startsWith('data:')) return image;
  const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=\r\n]+)$/.exec(image);
  if (!match) throw new Error('Use imagem JPEG, PNG, WebP ou GIF.');
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > 2 * 1024 * 1024) throw new Error('A imagem deve ter até 2 MB.');
  const id = createHash('sha256').update(bytes).digest('hex');
  // Identical uploads do not replace an existing immutable image.
  await database.client.execute({ sql: 'INSERT INTO media(id,payload) VALUES (?,?) ON CONFLICT(id) DO NOTHING', args: [id, JSON.stringify({ type: match[1], base64: bytes.toString('base64') })] });
  return `/api/media/${id}`;
}
