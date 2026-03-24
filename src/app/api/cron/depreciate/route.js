// src/app/api/cron/depreciate/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request) {
    // 🚨 THE FIX: Initialize Supabase INSIDE the function to bypass the build-time crash
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log("🤖 Waking up Depreciation Engine...");

    try {
        const { data: assets, error: fetchError } = await supabaseAdmin
            .from('fixed_assets')
            .select('*')
            .eq('status', 'Active');

        if (fetchError) throw fetchError;
        if (!assets || assets.length === 0) return NextResponse.json({ message: "No active assets to depreciate." });

        let processedCount = 0;

        for (const asset of assets) {
            const remainingValue = asset.purchase_cost - asset.accumulated_depreciation;
            const depreciationAmount = Math.min(asset.monthly_depreciation, remainingValue);

            if (depreciationAmount <= 0) continue;

            const { data: je, error: jeError } = await supabaseAdmin
                .from('journal_entries')
                .insert([{
                    company_id: asset.company_id,
                    entry_date: new Date().toISOString().split('T')[0],
                    description: `Automated Monthly Depreciation: ${asset.asset_name}`,
                    status: 'Posted'
                }])
                .select().single();

            if (jeError) throw jeError;

            await supabaseAdmin.from('transaction_lines').insert([
                { company_id: asset.company_id, entry_id: je.id, account_id: asset.expense_account_id, debit_amount: depreciationAmount, credit_amount: 0 },
                { company_id: asset.company_id, entry_id: je.id, account_id: asset.accumulated_account_id, debit_amount: 0, credit_amount: depreciationAmount }
            ]);

            const newAccumulated = Number(asset.accumulated_depreciation) + Number(depreciationAmount);
            const newStatus = newAccumulated >= asset.purchase_cost ? 'Fully Depreciated' : 'Active';

            await supabaseAdmin
                .from('fixed_assets')
                .update({ accumulated_depreciation: newAccumulated, status: newStatus })
                .eq('id', asset.id);

            processedCount++;
        }

        return NextResponse.json({ message: `Successfully depreciated ${processedCount} assets.` });

    } catch (error) {
        console.error("Cron Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}