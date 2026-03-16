// src/components/accounting/BalanceSheetTable.jsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function BalanceSheetTable() {
    const [reportData, setReportData] = useState({
        assets: [], liabilities: [], equity: [],
        totalAssets: 0, totalLiabilities: 0, totalEquity: 0, netIncome: 0, isBalanced: true
    });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchBalanceSheet() {
            try {
                const { data, error } = await supabase
                    .from('transaction_lines')
                    .select(`
            debit_amount,
            credit_amount,
            chart_of_accounts!inner(account_name, category, normal_balance)
          `);

                if (error) throw error;

                const assetTotals = {};
                const liabilityTotals = {};
                const equityTotals = {};
                let currentNetIncome = 0;

                data.forEach(line => {
                    const { account_name, category, normal_balance } = line.chart_of_accounts;
                    const debit = parseFloat(line.debit_amount) || 0;
                    const credit = parseFloat(line.credit_amount) || 0;

                    // Calculate Net Amount based on Normal Balance rules
                    let netAmount = 0;
                    if (normal_balance === 'Debit') {
                        netAmount = debit - credit;
                    } else {
                        netAmount = credit - debit;
                    }

                    // Route to the correct bucket
                    if (category === 'Asset') {
                        assetTotals[account_name] = (assetTotals[account_name] || 0) + netAmount;
                    } else if (category === 'Liability') {
                        liabilityTotals[account_name] = (liabilityTotals[account_name] || 0) + netAmount;
                    } else if (category === 'Equity') {
                        equityTotals[account_name] = (equityTotals[account_name] || 0) + netAmount;
                    } else if (category === 'Revenue') {
                        currentNetIncome += netAmount; // Revenue is Credit normal
                    } else if (category === 'Expense') {
                        currentNetIncome -= netAmount; // Expense is Debit normal
                    }
                });

                // Format arrays for UI mapping
                const assets = Object.keys(assetTotals).map(name => ({ name, amount: assetTotals[name] }));
                const liabilities = Object.keys(liabilityTotals).map(name => ({ name, amount: liabilityTotals[name] }));
                const equity = Object.keys(equityTotals).map(name => ({ name, amount: equityTotals[name] }));

                const totalAssets = assets.reduce((sum, item) => sum + item.amount, 0);
                const totalLiabilities = liabilities.reduce((sum, item) => sum + item.amount, 0);
                const baseEquity = equity.reduce((sum, item) => sum + item.amount, 0);

                // Final Equity includes the Net Income from operations
                const totalEquity = baseEquity + currentNetIncome;

                // The Golden Rule Check
                const isBalanced = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01; // Account for JS float quirks

                setReportData({
                    assets, liabilities, equity,
                    totalAssets, totalLiabilities, totalEquity,
                    netIncome: currentNetIncome, isBalanced
                });

            } catch (error) {
                console.error("Failed to fetch balance sheet:", error);
            } finally {
                setIsLoading(false);
            }
        }

        fetchBalanceSheet();
    }, []);

    if (isLoading) return <div className="p-8 text-slate-500 animate-pulse">Auditing the ledger...</div>;

    return (
        <Card className="w-full max-w-4xl shadow-sm border-slate-200">
            <CardHeader>
                <CardTitle className="text-2xl text-slate-900">Balance Sheet</CardTitle>
                <CardDescription>A snapshot of the company's financial position at this exact moment.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50 hover:bg-slate-50">
                            <TableHead className="w-[60%] font-semibold text-slate-900">Account</TableHead>
                            <TableHead className="text-right font-semibold text-slate-900">Balance (Rs)</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {/* ASSETS */}
                        <TableRow className="bg-slate-50/50 hover:bg-transparent border-b-0">
                            <TableCell colSpan={2} className="font-semibold text-slate-700 pt-6">Assets</TableCell>
                        </TableRow>
                        {reportData.assets.map((item) => (
                            <TableRow key={item.name}>
                                <TableCell className="pl-8 text-slate-600">{item.name}</TableCell>
                                <TableCell className="text-right tabular-nums text-slate-700">{item.amount.toFixed(2)}</TableCell>
                            </TableRow>
                        ))}
                        <TableRow>
                            <TableCell className="font-medium text-slate-900 pl-8">Total Assets</TableCell>
                            <TableCell className="text-right font-bold tabular-nums text-slate-900 border-t border-slate-300">
                                Rs {reportData.totalAssets?.toFixed(2) || "0.00"}
                            </TableCell>
                        </TableRow>

                        {/* LIABILITIES */}
                        <TableRow className="bg-slate-50/50 hover:bg-transparent border-b-0">
                            <TableCell colSpan={2} className="font-semibold text-slate-700 pt-8">Liabilities</TableCell>
                        </TableRow>
                        {reportData.liabilities.map((item) => (
                            <TableRow key={item.name}>
                                <TableCell className="pl-8 text-slate-600">{item.name}</TableCell>
                                <TableCell className="text-right tabular-nums text-slate-700">{item.amount.toFixed(2)}</TableCell>
                            </TableRow>
                        ))}
                        <TableRow>
                            <TableCell className="font-medium text-slate-900 pl-8">Total Liabilities</TableCell>
                            <TableCell className="text-right font-medium tabular-nums text-slate-900 border-t border-slate-200">
                                {reportData.totalLiabilities?.toFixed(2) || "0.00"}
                            </TableCell>
                        </TableRow>

                        {/* EQUITY */}
                        <TableRow className="bg-slate-50/50 hover:bg-transparent border-b-0">
                            <TableCell colSpan={2} className="font-semibold text-slate-700 pt-8">Equity</TableCell>
                        </TableRow>
                        {reportData.equity.map((item) => (
                            <TableRow key={item.name}>
                                <TableCell className="pl-8 text-slate-600">{item.name}</TableCell>
                                <TableCell className="text-right tabular-nums text-slate-700">{item.amount.toFixed(2)}</TableCell>
                            </TableRow>
                        ))}
                        <TableRow>
                            <TableCell className="pl-8 text-slate-600">Retained Earnings (Net Income)</TableCell>
                            <TableCell className="text-right tabular-nums text-slate-700">{reportData.netIncome?.toFixed(2) || "0.00"}</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell className="font-medium text-slate-900 pl-8">Total Equity</TableCell>
                            <TableCell className="text-right font-medium tabular-nums text-slate-900 border-t border-slate-200">
                                {reportData.totalEquity?.toFixed(2) || "0.00"}
                            </TableCell>
                        </TableRow>

                        {/* THE FINAL CHECK */}
                        <TableRow className={`hover:bg-transparent border-t-2 ${reportData.isBalanced ? 'bg-emerald-50/50' : 'bg-red-50'}`}>
                            <TableCell className="font-bold text-slate-900 text-lg pt-6">Total Liabilities & Equity</TableCell>
                            <TableCell className="text-right font-bold tabular-nums text-lg pt-6 text-slate-900">
                                Rs {(reportData.totalLiabilities + reportData.totalEquity).toFixed(2)}
                            </TableCell>
                        </TableRow>

                        {!reportData.isBalanced && (
                            <TableRow>
                                <TableCell colSpan={2} className="text-center text-red-600 font-medium py-4">
                                    ⚠️ Error: The Balance Sheet is out of balance. Check your journal entries.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}