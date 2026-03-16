// src/hooks/useUserRole.js
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export function useUserRole() {
    const [role, setRole] = useState(null);
    const [isLoadingRole, setIsLoadingRole] = useState(true);

    useEffect(() => {
        async function fetchRole() {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                const { data, error } = await supabase
                    .from('company_users')
                    .select('role')
                    .eq('user_id', user.id)
                    .single();

                if (error) throw error;
                if (data) setRole(data.role);

            } catch (error) {
                console.error("Error fetching role:", error.message);
            } finally {
                setIsLoadingRole(false);
            }
        }
        fetchRole();
    }, []);

    return {
        role,
        isLoadingRole,
        isAdmin: role === 'Admin',
        isDataEntry: role === 'Data Entry',
        isAuditor: role === 'Auditor'
    };
}