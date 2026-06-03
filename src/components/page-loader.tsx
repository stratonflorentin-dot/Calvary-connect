'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export function PageLoader() {
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const handleStart = () => setIsLoading(true);
        const handleEnd = () => setIsLoading(false);

        // Route change handlers
        router.prefetch = (href: string) => {
            setIsLoading(false);
        };

        // Global form submit handler
        const handleFormSubmit = (e: Event) => {
            const target = e.target as HTMLFormElement;
            if (target.tagName === 'FORM') {
                setIsLoading(true);
            }
        };

        // Link click handler - exclude downloads and special links
        const handleLinkClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const link = target.closest('a') as HTMLAnchorElement;

            if (link) {
                const href = link.getAttribute('href') || '';
                const isExternalOrDownload =
                    href.startsWith('http') ||
                    href.startsWith('mailto:') ||
                    href.startsWith('tel:') ||
                    link.hasAttribute('download') ||
                    link.getAttribute('target') === '_blank';

                if (!isExternalOrDownload) {
                    setIsLoading(true);
                }
            }
        };

        // bfcache handler
        const handlePageShow = (e: PageTransitionEvent) => {
            if (e.persisted) {
                setIsLoading(false);
            }
        };

        document.addEventListener('submit', handleFormSubmit);
        document.addEventListener('click', handleLinkClick);
        window.addEventListener('pageshow', handlePageShow);

        return () => {
            document.removeEventListener('submit', handleFormSubmit);
            document.removeEventListener('click', handleLinkClick);
            window.removeEventListener('pageshow', handlePageShow);
        };
    }, [router]);

    // Auto-hide after 3 seconds
    useEffect(() => {
        if (isLoading) {
            const timeout = setTimeout(() => setIsLoading(false), 3000);
            return () => clearTimeout(timeout);
        }
    }, [isLoading]);

    if (!isLoading) return null;

    return (
        <div className="fixed inset-0 bg-white/92 z-9999 flex items-center justify-center pointer-events-none">
            <style>{`
        @keyframes dotBounce {
          0%, 80%, 100% {
            opacity: 0.4;
            transform: translateY(0);
          }
          40% {
            opacity: 1;
            transform: translateY(-14px);
          }
        }
        .dot-bounce {
          animation: dotBounce 1.4s infinite;
        }
        .dot-1 { animation-delay: 0s; background-color: rgb(3, 105, 161); }
        .dot-2 { animation-delay: 0.2s; background-color: rgb(30, 144, 255); }
        .dot-3 { animation-delay: 0.4s; background-color: rgb(249, 115, 22); }
        .dot-4 { animation-delay: 0.6s; background-color: rgb(30, 144, 255); }
        .dot-5 { animation-delay: 0.8s; background-color: rgb(3, 105, 161); }
      `}</style>
            <div className="flex items-center justify-center gap-2">
                {[1, 2, 3, 4, 5].map(i => (
                    <div
                        key={i}
                        className={`dot-bounce w-3 h-3 rounded-full`}
                        style={{ '--animation-delay': `${i * 0.2}s` } as React.CSSProperties}
                        data-dot={i}
                    />
                ))}
            </div>
        </div>
    );
}
