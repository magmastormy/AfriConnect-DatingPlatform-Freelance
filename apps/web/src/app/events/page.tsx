import type { Metadata } from 'next';
import { PublicEventsList } from './PublicEventsList';

export const metadata: Metadata = {
  title: 'Events',
  description: 'Hosted mixers, salons and retreats for verified Nia members.',
};

export default function PublicEventsPage() {
  return <PublicEventsList />;
}
