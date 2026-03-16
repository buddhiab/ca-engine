// src/app/dashboard/forecasting/page.jsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from "recharts";
import { TrendingUp, TrendingDown, Calculator, AlertTriangle, Loader2 } from "lucide-react";

export default function ForecastingDashboard() {
    const [isLoading, setIsLoading] = useState(true);
    const [baseline, setBaseline] = useState({ currentCash: 0, avgMonthlyRevenue: 0, avgMonthlyExpenses: 0 });

    // Scenario Toggles (Interactive Variables)
    const [scenarios, setScenarios] = useState({
        revenueGrowthPercent: 5, // Default 5% month-over-month growth
        extraMonthlyExpenses: 0  // e.g., Hiring a new employee
    });

    useEffect(() => {
        async function fetchHistoricalData() {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                const { data: workspaceData } = await supabase
                    .from('company_users')
                    .select('company_id')
                    .eq('user_id', user.id)
                    .limit(1);

                if (!workspaceData || workspaceData.length === 0) return;
                const companyId = workspaceData[0].company_id;

                // Fetch all posted transactions to calculate baselines
                const { data: transactions } = await supabase
                    .from('transaction_lines')
                    .select(`
                        debit_amount, credit_amount,
                        chart_of_accounts!inner(category),
                        journal_entries!inner(entry_date, status)
                    `)
                    .eq('company_id', companyId)
                    .eq('journal_entries.status', 'Posted');

                let totalAssets = 0;
                let totalRev = 0;
                let totalExp = 0;

                // Track unique months to calculate accurate averages
                const uniqueMonths = new Set();

                if (transactions) {
                    transactions.forEach(tx => {
                        const cat = tx.chart_of_accounts.category;
                        const debit = Number(tx.debit_amount);
                        const credit = Number(tx.credit_amount);
                        const dateStr = tx.journal_entries.entry_date.substring(0, 7); // YYYY-MM
                        uniqueMonths.add(dateStr);

                        if (cat === 'Asset') totalAssets += (debit - credit);
                        else if (cat === 'Revenue') totalRev += (credit - debit);
                        else if (cat === 'Expense') totalExp += (debit - credit);
                    });
                }

                // If brand new account, assume at least 1 month to avoid dividing by zero
                const monthsActive = Math.max(uniqueMonths.size, 1);

                setBaseline({
                    currentCash: totalAssets,
                    avgMonthlyRevenue: totalRev / monthsActive,
                    avgMonthlyExpenses: totalExp / monthsActive
                });

            } catch (error) {
                console.error("Forecasting Error:", error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchHistoricalData();
    }, []);

    // 🧠 THE PREDICTION ENGINE: Recalculates instantly when user tweaks inputs
    const chartData = useMemo(() => {
        if (isLoading) return [];

        const data = [];
        let runningCash = baseline.currentCash;
        let runningRev = baseline.avgMonthlyRevenue;

        const currentMonth = new Date();

        // Data Point 0: Today (Actuals)
        data.push({
            month: "Today",
            ProjectedCash: runningCash,
            BaselineCash: runningCash
        });

        // Project out 6 months into the future
        for (let i = 1; i <= 6; i++) {
            const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + i, 1);
            const monthLabel = nextMonth.toLocaleString('en-US', { month: 'short', year: '2-digit' });

            // Apply User Scenarios for Projection
            const growthMultiplier = 1 + (Number(scenarios.revenueGrowthPercent) / 100);
            runningRev = runningRev * growthMultiplier;

            const projectedExpenses = baseline.avgMonthlyExpenses + Number(scenarios.extraMonthlyExpenses);
            const netCashFlow = runningRev - projectedExpenses;

            runningCash += netCashFlow;

            // Apply flat baseline (What happens if we change nothing?)
            const flatNetFlow = baseline.avgMonthlyRevenue - baseline.avgMonthlyExpenses;
            const flatCash = data[i - 1].BaselineCash + flatNetFlow;

            data.push({
                month: monthLabel,
                ProjectedCash: Math.round(runningCash),
                BaselineCash: Math.round(flatCash)
            });
        }
        return data;
    }, [baseline, scenarios, isLoading]);

    const handleScenarioChange = (e) => {
        setScenarios({ ...scenarios, [e.target.name]: e.target.value });
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', maximumFractionDigits: 0 }).format(amount).replace('LKR', 'Rs');
    };

    if (isLoading) return <div className="p-8 text-slate-500 animate-pulse font-medium">Booting Prediction Engine...</div>;

    const sixMonthCash = chartData.length > 0 ? chartData[6].ProjectedCash : 0;
    const isDying = sixMonthCash < 0;

    return (
        <div className="space-y-8 max-w-6xl">
            <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">Predictive Cash Flow</h2>
                <p className="text-slate-500">Model future scenarios based on your historical ledger data.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* INTERACTIVE SCENARIO CONTROLS */}
                <Card className="shadow-sm border-slate-200 lg:col-span-1 h-fit">
                    <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                        <CardTitle className="text-lg text-slate-900 flex items-center gap-2">
                            <Calculator className="h-5 w-5" /> Scenario Toggles
                        </CardTitle>
                        <CardDescription>Adjust variables to see how it impacts your 6-month runway.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                        <div className="space-y-3">
                            <Label className="font-bold text-slate-700 flex justify-between">
                                <span>Revenue Growth (%)</span>
                                <span className={scenarios.revenueGrowthPercent >= 0 ? "text-emerald-600" : "text-red-600"}>
                                    {scenarios.revenueGrowthPercent}% / mo
                                </span>
                            </Label>
                            <Input
                                type="number"
                                name="revenueGrowthPercent"
                                value={scenarios.revenueGrowthPercent}
                                onChange={handleScenarioChange}
                                className="text-lg"
                            />
                            <p className="text-xs text-slate-500">Projected month-over-month increase in sales.</p>
                        </div>

                        <div className="space-y-3 pt-4 border-t border-slate-100">
                            <Label className="font-bold text-slate-700 flex justify-between">
                                <span>Extra Monthly Expenses (Rs)</span>
                                <span className="text-red-600">-{formatCurrency(scenarios.extraMonthlyExpenses)}</span>
                            </Label>
                            <Input
                                type="number"
                                name="extraMonthlyExpenses"
                                value={scenarios.extraMonthlyExpenses}
                                onChange={handleScenarioChange}
                                min="0"
                                className="text-lg"
                            />
                            <p className="text-xs text-slate-500">E.g., Simulating the cost of hiring a new employee or renting an office.</p>
                        </div>

                        {/* Baseline Summary Widget */}
                        <div className="p-4 bg-slate-900 rounded-lg text-white space-y-2 mt-4 shadow-inner">
                            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">System Baselines</h4>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-300">Current Cash:</span>
                                <span className="font-mono">{formatCurrency(baseline.currentCash)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-300">Avg. Rev/Mo:</span>
                                <span className="font-mono text-emerald-400">{formatCurrency(baseline.avgMonthlyRevenue)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-300">Avg. Exp/Mo:</span>
                                <span className="font-mono text-red-400">{formatCurrency(baseline.avgMonthlyExpenses)}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* VISUALIZATION CHART */}
                <Card className="shadow-sm border-slate-200 lg:col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div>
                            <CardTitle className="text-lg text-slate-900">6-Month Runway Projection</CardTitle>
                            <CardDescription>Forecasted total assets over time.</CardDescription>
                        </div>
                        {isDying ? (
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold animate-pulse">
                                <AlertTriangle className="h-3.5 w-3.5" /> Bankruptcy Risk
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold">
                                <TrendingUp className="h-3.5 w-3.5" /> Healthy Runway
                            </div>
                        )}
                    </CardHeader>
                    <CardContent>
                        <div className="h-[400px] w-full mt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => `Rs ${val}`} />

                                    <Tooltip
                                        formatter={(value) => formatCurrency(value)}
                                        contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend wrapperStyle={{ paddingTop: '20px' }} />

                                    {/* Line at Zero Cash (Danger Zone) */}
                                    <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'insideBottomRight', value: 'Zero Cash', fill: '#ef4444', fontSize: 12 }} />

                                    <Line
                                        type="monotone"
                                        dataKey="ProjectedCash"
                                        name="Scenario Projection"
                                        stroke="#0f172a"
                                        strokeWidth={3}
                                        dot={{ r: 4, strokeWidth: 2 }}
                                        activeDot={{ r: 6 }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="BaselineCash"
                                        name="Do Nothing (Baseline)"
                                        stroke="#94a3b8"
                                        strokeWidth={2}
                                        strokeDasharray="5 5"
                                        dot={false}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}