'use client';

import { useEffect, useState } from 'react';
import { useSmartValStore } from '@/store';

/**
 * Custom hook to handle Zustand store hydration in Next.js.
 * Returns true only after the store has been hydrated from localStorage.
 * All components that read from the store should gate rendering on this.
 */
export function useHydration() {
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        // Manually trigger rehydration
        useSmartValStore.persist.rehydrate();
        setHydrated(true);
    }, []);

    return hydrated;
}
