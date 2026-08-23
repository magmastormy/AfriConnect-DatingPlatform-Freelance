import { z } from 'zod';

export const sendMessageSchema = z
  .object({
    content: z.string().max(4000).optional(),
    imageUrl: z.string().url().optional(),
  })
  .refine((d) => (d.content && d.content.trim().length > 0) || d.imageUrl, {
    message: 'Message must contain text or an image',
  });

export const editMessageSchema = z.object({
  content: z.string().min(1, 'Message cannot be empty').max(4000),
});

export const createConversationSchema = z.object({
  targetId: z.string().min(1, 'targetId is required'),
});

export type SendMessageDTO = z.infer<typeof sendMessageSchema>;
export type EditMessageDTO = z.infer<typeof editMessageSchema>;
export type CreateConversationDTO = z.infer<typeof createConversationSchema>;
