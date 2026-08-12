import { Router } from 'express';
import { EventController } from './event.controller';
import { IEventService } from './event.service';
import { authorize } from '@config/middleware';
import { UserRole } from '@africonnect/shared';

export function eventRoutes(controller: EventController, _service: IEventService): Router {
  const router = Router();
  router.get('/', controller.list);
  router.get('/:id', controller.detail);
  router.get('/:id/attendees', authorize(), controller.attendees);
  router.post('/:id/rsvp', authorize(), controller.rsvp);
  router.delete('/:id/rsvp', authorize(), controller.cancelRsvp);
  router.post('/:id/star', authorize(), controller.star);
  router.get('/:id/my-stars', authorize(), controller.myStars);

  router.post('/admin', authorize(UserRole.Admin, UserRole.SuperAdmin), controller.create);
  router.put('/admin/:id', authorize(UserRole.Admin, UserRole.SuperAdmin), controller.update);
  router.get(
    '/admin/:id/rsvps',
    authorize(UserRole.Admin, UserRole.SuperAdmin),
    controller.exportRsvps,
  );
  return router;
}
