"use client";

import React, { useEffect, useState } from "react";

export default function IconFallback({ name, className }: { name: string; className?: string }) {
    const [Icon, setIcon] = useState<React.ComponentType<any> | null>(null);

    useEffect(() => {
        let mounted = true;
        import("lucide-react")
            .then((mod) => {
                if (!mounted) return;
                const found = (mod as any)[name];
                if (found) setIcon(() => found as React.ComponentType<any>);
                else
                    setIcon(() => () => (
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className={className}
                        >
                            <circle cx="12" cy="12" r="9" />
                            <path d="M12 8v4" />
                            <path d="M12 16h.01" />
                        </svg>
                    ));
            })
            .catch(() => {
                if (!mounted) return;
                setIcon(() => () => (
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={className}
                    >
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 8v4" />
                        <path d="M12 16h.01" />
                    </svg>
                ));
            });

        return () => {
            mounted = false;
        };
    }, [name, className]);

    if (!Icon) return <span className={className} />;
    const C = Icon;
    return <C className={className} />;
}
