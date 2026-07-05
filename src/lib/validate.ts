import { z } from 'zod';

export const USERNAME_RE = /^[a-z0-9_]{3,24}$/;

export const kindSchema = z.enum(['album', 'song']);

export const searchSchema = z.object({
  kind: kindSchema,
  q: z.string().trim().min(1).max(200),
});

/** Allowed Top-N sizes for public lists (matches the 0003 DB check). */
export const LIST_TYPES = [5, 10, 20, 50, 100, 1000] as const;

/**
 * Curated broad genres — deliberately coarse buckets, not a taxonomy.
 * 'all time' is pinned first as the catch-all.
 */
export const GENRES = [
  'all time',
  'rock',
  'classic rock',
  'punk',
  'metal',
  'goth',
  'indie',
  'alternative',
  'shoegaze',
  'psychedelic',
  'pop',
  'city pop',
  'hip hop',
  'rap',
  'r&b',
  'soul',
  'funk',
  'disco',
  'jazz',
  'blues',
  'folk',
  'country',
  'electronic',
  'ambient',
  'techno',
  'house',
  'experimental',
  'classical',
  'reggae',
  'latin',
  'world',
  'soundtrack',
] as const;

export const listInputSchema = z
  .object({
    id: z.string().uuid().optional(),
    title: z.string().trim().min(1, 'Give the list a title').max(140),
    description: z.string().trim().max(1000).default(''),
    kind: kindSchema,
    status: z.enum(['draft', 'published', 'private']),
    list_type: z
      .union([
        z.literal(5),
        z.literal(10),
        z.literal(20),
        z.literal(50),
        z.literal(100),
        z.literal(1000),
      ])
      .nullable()
      .default(null),
    genres: z.array(z.enum(GENRES)).max(3, 'Pick up to three genres').default([]),
    entries: z
      .array(
        z.object({
          mbid: z.string().uuid(),
          blurb: z.string().trim().max(280).default(''),
        }),
      )
      .max(999, 'Lists cap at 999 entries'),
  })
  .superRefine((v, ctx) => {
    if (v.status !== 'published') return;
    if (v.list_type == null) {
      ctx.addIssue({
        code: 'custom',
        path: ['list_type'],
        message: 'Pick a Top-N size before publishing.',
      });
    }
    if (v.genres.length < 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['genres'],
        message: 'Pick at least one genre before publishing (“all time” is the catch-all).',
      });
    }
    if (v.list_type != null && v.entries.length > v.list_type) {
      ctx.addIssue({
        code: 'custom',
        path: ['entries'],
        message: `A Top ${v.list_type} holds at most ${v.list_type} entries — you have ${v.entries.length}.`,
      });
    }
  });
export type ListInput = z.infer<typeof listInputSchema>;

export const ratingSchema = z.object({
  itemMbid: z.string().uuid(),
  value: z
    .number()
    .min(0.5)
    .max(5)
    .refine(v => Math.round(v * 2) === v * 2, 'Ratings move in half-star steps'),
});

export const commentSchema = z.object({
  listId: z.string().uuid(),
  body: z.string().trim().min(1, 'Write a comment first').max(500),
});

export const likeSchema = z.object({
  targetType: z.enum(['list', 'comment']),
  targetId: z.string().uuid(),
});

export const followSchema = z.object({ userId: z.string().uuid() });

export const profileSchema = z.object({
  displayName: z.string().trim().min(1, 'Display name is required').max(80),
  bio: z.string().trim().max(280).default(''),
});

export const pinSchema = z.object({ itemMbid: z.string().uuid() });
