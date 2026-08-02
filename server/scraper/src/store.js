/**
 * 出題データの読み書き。
 * - 本番: GCS（環境変数 DATA_BUCKET のオブジェクト DATA_OBJECT、既定 beyblades.json）
 * - ローカル/DRY_RUN: SEED_PATH のローカルJSON
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const DATA_OBJECT = process.env.DATA_OBJECT || 'beyblades.json';

export async function loadCurrentData() {
  const seedPath = process.env.SEED_PATH;
  if (seedPath) {
    const abs = path.resolve(seedPath);
    const text = await readFile(abs, 'utf8');
    return { data: JSON.parse(text), from: `seed:${abs}` };
  }

  const bucketName = process.env.DATA_BUCKET;
  if (!bucketName) {
    throw new Error('DATA_BUCKET か SEED_PATH のどちらかを指定してください');
  }
  const { Storage } = await import('@google-cloud/storage');
  const storage = new Storage();
  const [buf] = await storage.bucket(bucketName).file(DATA_OBJECT).download();
  return { data: JSON.parse(buf.toString('utf8')), from: `gs://${bucketName}/${DATA_OBJECT}` };
}

export async function uploadData(nextData) {
  const bucketName = process.env.DATA_BUCKET;
  if (!bucketName) throw new Error('アップロードには DATA_BUCKET が必要です');
  const { Storage } = await import('@google-cloud/storage');
  const storage = new Storage();
  await storage
    .bucket(bucketName)
    .file(DATA_OBJECT)
    .save(JSON.stringify(nextData, null, 2), {
      contentType: 'application/json; charset=utf-8',
      resumable: false,
      metadata: { cacheControl: 'public, max-age=300' },
    });
  return `gs://${bucketName}/${DATA_OBJECT}`;
}
