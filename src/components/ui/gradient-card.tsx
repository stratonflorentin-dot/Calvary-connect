import React, { ReactNode } from 'react';
import { Card } from './card';

interface GradientCardProps {
    title: string;
    subtitle?: string;
    icon: ReactNode;
    iconBg: string;
    headerGradient: string;
    children: ReactNode;
    className?: string;
}

export function GradientCard({
    title,
    subtitle,
    icon,
    iconBg,
    headerGradient,
    children,
    className = ''
}: GradientCardProps) {
    return (
        <Card className={`overflow-hidden ${className}`}>
            <div className={`${headerGradient} p-4 flex items-center gap-3`}>
                <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0`}>
                    {icon}
                </div>
                <div className="flex-1">
                    <h3 className="text-sm font-semibold text-white">{title}</h3>
                    {subtitle && <p className="text-xs text-white/70">{subtitle}</p>}
                </div>
            </div>
            <div className="p-4">
                {children}
            </div>
        </Card>
    );
}
