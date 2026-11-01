import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth';

/** The Android app is the student experience; staff use the web console. */
export default function Index() {
  const { user } = useAuth();
  return <Redirect href={user?.role === 'STUDENT' ? '/(tabs)' : '/welcome'} />;
}
