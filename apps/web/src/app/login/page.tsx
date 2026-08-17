import { redirect } from 'next/navigation';

/** Legacy alias for the canonical /sign-in route. */
export default function LoginAliasPage() {
  redirect('/sign-in');
}
