import { useRouter } from 'expo-router';
import { useAuthStore } from '../stores/authStore';

export function usePremium() {
  const router = useRouter();
  const isPremium = useAuthStore((s) => s.profile?.is_premium ?? false);

  const requirePremium = (featureName: string): boolean => {
    if (isPremium) return true;
    router.push('/premium');
    return false;
  };

  return { isPremium, requirePremium };
}
