import { useEffect } from 'react';
import { getExp, logoutAndReload } from '../utils/auth';

export default function useAutoLogout(pingMs = 15000) {
  useEffect(() => {
    const id = setInterval(() => {
      const exp = getExp();
      if (!exp) return;

      const now = Math.floor(Date.now() / 1000);
      if (now >= exp) {
        logoutAndReload('/login');
      }
    }, pingMs);

    return () => clearInterval(id);
  }, [pingMs]);
}
