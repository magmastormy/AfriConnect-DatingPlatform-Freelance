import { Router } from 'express';
import { MockChatController } from './mockchat.controller';
import { IMockChatService } from './mockchat.service';
import { authorize, requireVetted } from '@config/middleware';

/**
 * Mock Chat Routes
 * 
 * All endpoints require authentication and vetting (same as regular chat).
 * Prefix: /mockchat
 */
export function mockChatRoutes(controller: MockChatController, _service: IMockChatService): Router {
  const router = Router();
  const vetted = [authorize(), requireVetted()];

  // Persona discovery (public-ish but still authenticated)
  router.get('/personas', vetted, controller.listPersonas);
  router.get('/personas/:id', vetted, controller.getPersona);

  // Conversation management
  router.get('/conversations', vetted, controller.listConversations);
  router.post('/conversations', vetted, controller.createConversation);
  
  // Must be registered before the `/conversations/:id` param route
  router.get('/conversations/unread-count', vetted, controller.listConversations); // Reuse for now
  
  router.get('/conversations/:id', vetted, controller.getMessages);
  router.post('/conversations/:id', vetted, controller.sendMessage);
  router.post('/conversations/:id/read', vetted, controller.markRead);

  // Config (admin only - would need admin middleware)
  // router.get('/config', [authorize(), requireAdmin()], controller.getConfig);

  return router;
}