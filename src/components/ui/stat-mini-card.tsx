import React, { ReactNode } from 'react';
import Link from 'next/link';
import { Card } from './card';

interface StatMiniCardProps {
    title: string;
    value: string | number;
    icon: ReactNode;
    iconBg: string;
    valueColor: string;
    href?: string;
    className?: string;
}

export function StatMiniCard({
    title,
    value,
    icon,
    iconBg,
    valueColor,
    href,
    className = ''
}: StatMiniCardProps) {
    const content = (
        <Card className={`p-4 text-center hover:shadow-md transition-shadow ${className}`}>
            <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center mx-auto mb-2`}>
                {icon}
            </div>
            <p className="text-xs text-muted-foreground mb-1">{title}</p>
            <p className={`text-sm font-bold ${valueColor}`}>{value}</p>
        </Card>
    );

    if (href) {
        return <Link href={href}>{content}</Link>;
    }

    return content;
}
