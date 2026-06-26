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
        <Card className={`overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-200 ${className}`}>
            <div className={`${headerGradient} p-5 flex items-center gap-3`}>
                <div className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                    {icon}
                </div>
                <div className="flex-1">
                    <h3 className="text-base font-semibold text-white">{title}</h3>
                    {subtitle && <p className="text-xs text-white/80">{subtitle}</p>}
                </div>
            </div>
            <div className="p-5 bg-card">
                {children}
            </div>
        </Card>
    );
}
