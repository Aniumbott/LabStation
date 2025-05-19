import { redirect } from 'next/navigation';

export default function HomePage() {
  // Permanently redirect the root path to the dashboard
  redirect('/dashboard');
}
