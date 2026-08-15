import React, { ReactNode } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Card } from './card';
import { AnimatedCounter } from './animated-counter';
import { hoverLift } from '@/lib/animations';

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
    const isPlainNumber = typeof value === 'number' && Number.isFinite(value);

    const content = (
        <Card className={`p-5 text-center hover:shadow-xl hover:border-primary/50 transition-all duration-200 cursor-pointer group ${className}`}>
            <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform duration-200`}>
                {icon}
            </div>
            <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide">{title}</p>
            <p className={`text-lg font-bold ${valueColor}`}>
                {isPlainNumber ? <AnimatedCounter value={value as number} /> : value}
            </p>
        </Card>
    );

    if (href) {
        return (
            <Link href={href}>
                <motion.div whileHover={hoverLift} whileTap={{ scale: 0.98 }}>
                    {content}
                </motion.div>
            </Link>
        );
    }

    return content;
}
