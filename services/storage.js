/**
 * RFT Entertainment — Supabase Storage Service
 *
 * Uploads files to Supabase Storage instead of Railway's local disk.
 * Railway's /uploads/ folder is wiped on every deploy — this is permanent.
 *
 * Buckets used:
 *   rft-uploads/kyc/        — KYC identity documents
 *   rft-uploads/recharge/   — Recharge payment screenshots
 *
 * Setup (run once in Supabase SQL Editor):
 *   INSERT INTO storage.buckets (id, name, public)
 *   VALUES ('rft-uploads', 'rft-uploads', true)
 *   ON CONFLICT DO NOTHING;
 */

const path = require('path');
const fs   = require('fs');

const SUPABASE_URL    = process.env.SUPABASE_URL;
const SUPABASE_ANON   = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY;
const BUCKET          = 'rft-uploads';
const STORAGE_BASE    = `${SUPABASE_URL}/storage/v1/object`;
const PUBLIC_BASE     = `${SUPABASE_URL}/storage/v1/object/public`;

/**
 * Upload a file (Buffer or path string) to Supabase Storage.
 * Returns the public URL on success, null on failure.
 *
 * @param {Buffer|string} fileSource  — Buffer or local file path
 * @param {string}        folder      — 'kyc' | 'recharge' | 'avatars'
 * @param {string}        originalName — original filename for extension
 * @param {string}        mimeType    — e.g. 'image/jpeg'
 */
async function uploadFile(fileSource, folder, originalName, mimeType = 'image/jpeg') {
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    console.warn('[Storage] SUPABASE_URL or SUPABASE_ANON_KEY not set — falling back to local disk');
    return null;
  }

  try {
    // Read buffer if path string given
    let buffer;
    if (typeof fileSource === 'string') {
      buffer = fs.readFileSync(fileSource);
    } else {
      buffer = fileSource;
    }

    const ext      = path.extname(originalName) || '.jpg';
    const filename = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 9)}${ext}`;
    const url      = `${STORAGE_BASE}/${BUCKET}/${filename}`;

    const response = await fetch(url, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON}`,
        'Content-Type':  mimeType,
        'x-upsert':      'false'
      },
      body: buffer
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[Storage] Upload failed:', err);
      return null;
    }

    const publicUrl = `${PUBLIC_BASE}/${BUCKET}/${filename}`;
    console.log('[Storage] Uploaded:', publicUrl);
    return publicUrl;

  } catch (err) {
    console.error('[Storage] Upload error:', err.message);
    return null;
  }
}

/**
 * Delete a file from Supabase Storage by its public URL.
 */
async function deleteFile(publicUrl) {
  if (!SUPABASE_URL || !SUPABASE_ANON || !publicUrl) return false;
  try {
    // Extract path from URL: .../object/public/rft-uploads/kyc/xxx.jpg → kyc/xxx.jpg
    const marker = `${BUCKET}/`;
    const idx    = publicUrl.indexOf(marker);
    if (idx === -1) return false;
    const filePath = publicUrl.slice(idx + marker.length);

    const response = await fetch(`${STORAGE_BASE}/${BUCKET}/${filePath}`, {
      method:  'DELETE',
      headers: { 'Authorization': `Bearer ${SUPABASE_ANON}` }
    });
    return response.ok;
  } catch (err) {
    console.error('[Storage] Delete error:', err.message);
    return false;
  }
}

module.exports = { uploadFile, deleteFile, BUCKET };
