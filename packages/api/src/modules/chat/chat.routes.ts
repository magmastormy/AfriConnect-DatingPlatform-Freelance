import { Router } from 'express';
import { ChatController } from './chat.controller';
import { IChatService } from './chat.service';
import { authorize } from '@config/middleware';

export function chatRoutes(controller: ChatController, _service: IChatService): Router {
  const router = Router();
  router.get('/conversations', authorize(), controller.list);
  router.get('/conversations/:id', authorize(), controller.messages);
  router.post('/conversations/:id', authorize(), controller.send);
  router.post('/upload', authorize(), controller.upload);
  router.put('/conversations/:id/messages/:messageId', authorize(), controller.edit);
  router.delete('/conversations/:id/messages/:messageId', authorize(), controller.remove);
  router.post('/conversations/:id/messages/:messageId/recall', authorize(), controller.recall);
  router.post('/conversations/:id/read', authorize(), controller.read);
  return router;
}
