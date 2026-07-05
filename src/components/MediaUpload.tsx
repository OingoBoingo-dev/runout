'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { removeProfileMedia, uploadProfileMedia, type MediaKind } from '@/app/actions/media';

const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/**
 * Photo/background uploader for Settings. Cobalt = interactive (the picker),
 * red is reserved for errors and Remove. Stacks cleanly at 375px.
 */
export function MediaUpload({
  kind,
  currentUrl,
}: {
  kind: MediaKind;
  currentUrl: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isAvatar = kind === 'avatar';
  const title = isAvatar ? 'Photo' : 'Background';

  const onFile = (file: File | null) => {
    setError(null);
    if (!file) return;
    // Pre-check client-side so obvious rejects never hit the server.
    if (!ALLOWED.includes(file.type)) {
      setError('Use a JPEG, PNG, WebP, or GIF.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('That image is over 4MB — pick a smaller one.');
      return;
    }
    const fd = new FormData();
    fd.set('file', file);
    fd.set('kind', kind);
    startTransition(async () => {
      const res = await uploadProfileMedia(fd);
      if ('error' in res) setError(res.error);
      else {
        setPreview(res.url);
        router.refresh();
      }
      if (inputRef.current) inputRef.current.value = '';
    });
  };

  const onRemove = () => {
    setError(null);
    startTransition(async () => {
      const res = await removeProfileMedia(kind);
      if ('error' in res) setError(res.error);
      else {
        setPreview(null);
        router.refresh();
      }
    });
  };

  return (
    <div>
      <p className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.13em] text-secondary">
        {title}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {/* Preview: current image or dashed placeholder. */}
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt={`Current ${title.toLowerCase()}`}
            className={
              isAvatar
                ? 'h-16 w-16 flex-none rounded-full border border-hairline object-cover'
                : 'h-16 w-28 flex-none rounded-card border border-hairline object-cover'
            }
          />
        ) : (
          <span
            aria-hidden
            className={`flex flex-none items-center justify-center border border-dashed border-secondary/50 font-mono text-[10px] uppercase tracking-wider text-secondary ${
              isAvatar ? 'h-16 w-16 rounded-full' : 'h-16 w-28 rounded-card'
            }`}
          >
            none
          </span>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          aria-label={`Choose ${title.toLowerCase()} image`}
          onChange={e => onFile(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
          className="press rounded-chip border border-hairline px-4 py-2.5 font-mono text-xs uppercase tracking-wider text-cobalt hover:border-cobalt/40 disabled:opacity-50"
        >
          {pending ? 'Uploading…' : preview ? `Change ${title.toLowerCase()}` : `Add ${title.toLowerCase()}`}
        </button>
        {preview && (
          <button
            type="button"
            disabled={pending}
            onClick={onRemove}
            className="press rounded-chip border border-hairline px-4 py-2.5 font-mono text-xs uppercase tracking-wider text-secondary hover:border-red/40 hover:text-red disabled:opacity-50"
          >
            Remove
          </button>
        )}
      </div>
      <p aria-live="polite" className="mt-1.5 font-mono text-[11px] text-secondary">
        {error ? <span className="text-red">{error}</span> : 'JPEG, PNG, WebP, or GIF · up to 4MB'}
      </p>
    </div>
  );
}
