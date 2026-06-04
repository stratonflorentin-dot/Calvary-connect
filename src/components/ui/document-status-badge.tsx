import React from 'react';
import { Badge } from './badge';

type DocumentStatus = 'expired' | 'expiring' | 'valid' | 'no_expiry';

interface DocumentStatusBadgeProps {
    status: DocumentStatus;
    expiryDate?: Date | string;
    className?: string;
}

export function DocumentStatusBadge({
    status,
    expiryDate,
    className = ''
}: DocumentStatusBadgeProps) {
    let variant: 'destructive' | 'default' | 'secondary' | 'outline' = 'default';
    let label = '';

    if (status === 'expired') {
        variant = 'destructive';
        label = 'EXPIRED';
    } else if (status === 'expiring') {
        variant = 'secondary';
        const date = new Date(expiryDate || '');
        const now = new Date();
        const diffTime = date.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        label = `${diffDays} days from now`;
    } else if (status === 'valid') {
        variant = 'outline';
        const date = new Date(expiryDate || '');
        const now = new Date();
        const diffTime = date.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const months = Math.floor(diffDays / 30);
        label = months > 0 ? `${months} months from now` : `${diffDays} days from now`;
    } else if (status === 'no_expiry') {
        variant = 'outline';
        label = 'No Expiry';
    }

    return (
        <Badge variant={variant} className={className}>
            {label}
        </Badge>
    );
}
