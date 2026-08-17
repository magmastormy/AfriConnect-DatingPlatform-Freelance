import { z } from 'zod';

/** Query accepted by POST /upload. Folder scopes where the file lands in storage. */
export const uploadQuerySchema = z.object({
  folder: z.enum(['vetting', 'photos', 'proof']).default('vetting'),
});

export type UploadQuery = z.infer<typeof uploadQuerySchema>;
