import { z } from 'zod';

export const USERNAME_RE = /^[a-z0-9_]{3,24}$/;

export const kindSchema = z.enum(['album', 'song']);

export const searchSchema = z.object({
  kind: kindSchema,
  q: z.string().trim().min(1).max(200),
});

export const listInputSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1, 'Give the list a title').max(140),
  description: z.string().trim().max(1000).default(''),
  kind: kindSchema,
  status: z.enum(['draft', 'published']),
  entries: z
    .array(
      z.object({
        mbid: z.string().uuid(),
        blurb: z.string().trim().max(280).default(''),
      }),
    )
    .max(999, 'Lists cap at 999 entries'),
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
