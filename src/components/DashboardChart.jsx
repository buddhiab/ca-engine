// src/components/DashboardChart.jsx
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function DashboardChart() {
    const [chartData, setChartData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchChartData() {
            try {
                // 1. Get the current user
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                // 2. Get their secure Company ID safely
                const { data: companyUsers, error: cuError } = await supabase
                    .from('company_users')
                    .select('company_id')
                    .eq('user_id', user.id)
                    .limit(1);

                if (cuError) throw cuError;

                // Exit silently if this is an old test user without a workspace
                if (!companyUsers || companyUsers.length === 0) {
                    console.warn("No workspace found for this user.");
                    setIsLoading(false);
                    return;
                }

                const companyId = companyUsers[0].company_id;

                // 3. Fetch all transaction lines, joining accounts (for category) and entries (for date/status)
                const { data: transactions, error: txError } = await supabase
                    .from('transaction_lines')
                    .select(`
                        debit_amount,
                        credit_amount,
                        chart_of_accounts!inner(category),
                        journal_entries!inner(entry_date, status)
                    `)
                    .eq('company_id', companyId)
                    .in('chart_of_accounts.category', ['Revenue', 'Expense'])
                    .eq('journal_entries.status', 'Posted');

                if (txError) throw txError;

                // 4. Set up an empty 12-month calendar template
                const monthlyTotals = {
                    '01': { month: 'Jan', revenue: 0, expenses: 0 },
                    '02': { month: 'Feb', revenue: 0, expenses: 0 },
                    '03': { month: 'Mar', revenue: 0, expenses: 0 },
                    '04': { month: 'Apr', revenue: 0, expenses: 0 },
                    '05': { month: 'May', revenue: 0, expenses: 0 },
                    '06': { month: 'Jun', revenue: 0, expenses: 0 },
                    '07': { month: 'Jul', revenue: 0, expenses: 0 },
                    '08': { month: 'Aug', revenue: 0, expenses: 0 },
                    '09': { month: 'Sep', revenue: 0, expenses: 0 },
                    '10': { month: 'Oct', revenue: 0, expenses: 0 },
                    '11': { month: 'Nov', revenue: 0, expenses: 0 },
                    '12': { month: 'Dec', revenue: 0, expenses: 0 },
                };

                // 5. Calculate the real totals
                transactions.forEach((tx) => {
                    // Extract the month (e.g., "2026-03-16" -> "03")
                    const monthNum = tx.journal_entries.entry_date.split('-')[1];
                    const category = tx.chart_of_accounts.category;

                    if (category === 'Revenue') {
                        // Revenue normally carries a Credit balance
                        monthlyTotals[monthNum].revenue += Number(tx.credit_amount);
                    } else if (category === 'Expense') {
                        // Expenses normally carry a Debit balance
                        monthlyTotals[monthNum].expenses += Number(tx.debit_amount);
                    }
                });

                // Convert the object back into an array for Recharts
                setChartData(Object.values(monthlyTotals));

            } catch (error) {
                console.error("Error fetching chart data:", error.message);
            } finally {
                setIsLoading(false);
            }
        }

        fetchChartData();
    }, []);

    return (
        <Card className="col-span-full shadow-sm border-slate-200 mt-6">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-slate-700">Revenue vs Expenses (YTD)</CardTitle>
                {isLoading && <span className="text-xs text-slate-400">Syncing live data...</span>}
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `Rs ${value}`} />
                            <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                            <Bar dataKey="revenue" fill="#0f172a" radius={[4, 4, 0, 0]} name="Revenue" />
                            <Bar dataKey="expenses" fill="#94a3b8" radius={[4, 4, 0, 0]} name="Expenses" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}