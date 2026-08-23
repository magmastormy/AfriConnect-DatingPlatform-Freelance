import { Request, Response } from 'express';
import { IChatService } from './chat.service';
import { sendMessageSchema, editMessageSchema, createConversationSchema } from './chat.schema';
import { asyncHandler, success, IMediaStorage } from '@africonnect/shared';
import { z } from 'zod';

const uploadSchema = z.object({
  data: z
    .string()
    .min(1)
    .max(8 * 1024 * 1024), // base64, max 8MB
  ext: z.enum(['png', 'jpg', 'jpeg', 'webp', 'gif']).default('png'),
});

export class ChatController {
  constructor(
    private readonly service: IChatService,
    private readonly media: IMediaStorage,
  ) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const list = await this.service.listConversations(req.user!.userId);
    res.status(200).json(success(list));
  });

  messages = asyncHandler(async (req: Request, res: Response) => {
    const messages = await this.service.getMessages(req.user!.userId, req.params.id);
    res.status(200).json(success(messages));
  });

  send = asyncHandler(async (req: Request, res: Response) => {
    const body = sendMessageSchema.parse(req.body);
    const message = await this.service.send(req.user!.userId, req.params.id, body);
    res.status(201).json(success(message));
  });

  // Chat image upload. Stored via the configured IMediaStorage (Cloudinary in
  // prod, local ./uploads in dev) — replaces the old S3 presign placeholder.
  upload = asyncHandler(async (req: Request, res: Response) => {
    const { data, ext } = uploadSchema.parse(req.body);
    const matches = data.match(/^data:image\/[a-z]+;base64,(.+)$/);
    const b64 = matches ? matches[1] : data;
    const buffer = Buffer.from(b64, 'base64');
    const result = await this.media.upload(buffer, ext, 'chat');
    res.status(201).json(success({ url: result.url }));
  });

  edit = asyncHandler(async (req: Request, res: Response) => {
    const body = editMessageSchema.parse(req.body);
    const message = await this.service.edit(req.user!.userId, req.params.messageId, body);
    res.status(200).json(success(message));
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    await this.service.remove(req.user!.userId, req.params.messageId);
    res.status(200).json(success({ deleted: true }));
  });

  recall = asyncHandler(async (req: Request, res: Response) => {
    await this.service.recall(req.user!.userId, req.params.messageId);
    res.status(200).json(success({ recalled: true }));
  });

  read = asyncHandler(async (req: Request, res: Response) => {
    await this.service.markRead(req.user!.userId, req.params.id);
    res.status(200).json(success({ marked: true }));
  });

  createConversation = asyncHandler(async (req: Request, res: Response) => {
    const { targetId } = createConversationSchema.parse(req.body);
    const result = await this.service.getOrCreateConversation(req.user!.userId, targetId);
    res.status(201).json(success(result));
  });

  unreadCount = asyncHandler(async (req: Request, res: Response) => {
    const count = await this.service.unreadCount(req.user!.userId);
    res.status(200).json(success({ count }));
  });
}
