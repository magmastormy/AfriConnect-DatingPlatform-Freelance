import { Router } from 'express';
import { EventController } from './event.controller';
import { IEventService } from './event.service';
import { authorize, requireVetted } from '@config/middleware';
import { AdminScope, SCOPE_ROLES } from '@africonnect/shared';

/**
 * Event routes.
 *
 * The catalogue (list/detail) is public so prospective members and unvetted
 * accounts can see what the community runs — that is the marketing surface.
 * Anything that reveals other members or commits a seat (attendees, RSVP,
 * stars) requires an approved vetting decision.
 */
export function eventRoutes(controller: EventController, _service: IEventService): Router {
  const router = Router();
  const vetted = [authorize(), requireVetted()];
  const eventsAdmin = authorize(...SCOPE_ROLES[AdminScope.Events]);

  router.get('/', controller.list);
  router.post('/', vetted, controller.createMine);
  router.get('/mine', vetted, controller.listMine);
  router.get('/:id', controller.detail);

  router.get('/:id/attendees', vetted, controller.attendees);
  router.post('/:id/rsvp', vetted, controller.rsvp);
  router.delete('/:id/rsvp', vetted, controller.cancelRsvp);
  router.post('/:id/star', vetted, controller.star);
  router.get('/:id/my-stars', vetted, controller.myStars);

  router.post('/admin', eventsAdmin, controller.create);
  router.put('/admin/:id', eventsAdmin, controller.update);
  router.get('/admin/:id/rsvps', eventsAdmin, controller.exportRsvps);
  return router;
}
