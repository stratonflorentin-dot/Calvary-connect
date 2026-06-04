import React from 'react';
import { Badge } from './badge';
import { Star } from 'lucide-react';

interface VehicleHealthBadgeProps {
    score: number;
    className?: string;
}

export function VehicleHealthBadge({ score, className = '' }: VehicleHealthBadgeProps) {
    let label = '';
    let colorClass = '';

    if (score > 75) {
        label = 'Excellent';
        colorClass = 'bg-yellow-500 hover:bg-yellow-600 text-white';
    } else if (score >= 50) {
        label = 'Fair';
        colorClass = 'bg-amber-500 hover:bg-amber-600 text-white';
    } else {
        label = 'Poor';
        colorClass = 'bg-red-500 hover:bg-red-600 text-white';
    }

    return (
        <Badge className={`${colorClass} ${className}`}>
            <Star className="w-3 h-3 mr-1 fill-current" />
            {label} ({score}%)
        </Badge>
    );
}
