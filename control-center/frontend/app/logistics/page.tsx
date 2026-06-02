import { redirect } from 'next/navigation';

export default function LogisticsRedirect() {
  redirect(process.env.NEXT_PUBLIC_CARGOLINK_URL || 'http://localhost:3016');
}
