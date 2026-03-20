"use client";

import { useState, useEffect } from 'react';
import { UserRole } from '@/types/roles';
import { useUser, useFirestore, setDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';

export function useRole() {
  const [role, setRole] = useState<UserRole | null>(null);
  const { user } = useUser();
  const firestore = useFirestore();

  useEffect(() => {
    const savedRole = localStorage.getItem('fleet_command_role') as UserRole;
    if (savedRole) {
      setRole(savedRole);
    } else {
      setRole('CEO'); // Default for demo
    }
  }, []);

  useEffect(() => {
    // Sync the local role to Firestore for the authenticated user
    // This allows Security Rules (Authorization Independence) to verify the role via exists() checks.
    if (user && role && firestore) {
      const roleCollection = `roles_${role.toLowerCase()}`;
      const roleDocRef = doc(firestore, roleCollection, user.uid);
      
      setDocumentNonBlocking(roleDocRef, { 
        id: user.uid,
        name: user.displayName || 'Demo User',
        email: user.email || 'anonymous@calvary.com',
        role: role,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }
  }, [user, role, firestore]);

  const changeRole = (newRole: UserRole) => {
    setRole(newRole);
    localStorage.setItem('fleet_command_role', newRole);
  };

  return { role, changeRole };
}
