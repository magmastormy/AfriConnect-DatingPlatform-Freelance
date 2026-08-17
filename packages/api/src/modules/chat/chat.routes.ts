import { Router } from 'express';
import { ChatController } from './chat.controller';
import { IChatService } from './chat.service';
import { authorize, requireVetted } from '@config/middleware';

/**
 * Messaging is members-only: conversations only exist between mutual matches,
 * and matching itself requires vetting. Gating here as well means an unvetted
 * account cannot reach a conversation through a stale or guessed id.
 */
export function chatRoutes(controller: ChatController, _service: IChatService): Router {
  const router = Router();
  const vetted = [authorize(), requireVetted()];

  router.get('/conversations', vetted, controller.list);
  router.get('/conversations/:id', vetted, controller.messages);
  router.post('/conversations/:id', vetted, controller.send);
  router.post('/upload', vetted, controller.upload);
  router.put('/conversations/:id/messages/:messageId', vetted, controller.edit);
  router.delete('/conversations/:id/messages/:messageId', vetted, controller.remove);
  router.post('/conversations/:id/messages/:messageId/recall', vetted, controller.recall);
  router.post('/conversations/:id/read', vetted, controller.read);
  return router;
}
