// src/app/dashboard/balance-sheet/page.jsx
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function BalanceSheet() {
    const [reportData, setReportData] = useState({
        assets: [],
        liabilities: [],
        equity: [],
        totalAssets: 0,
        totalLiabilities: 0,
        totalEquity: 0,
        totalLiabilitiesAndEquity: 0,
        isBalanced: true
    });
    const [isLoading, setIsLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState(null);

    useEffect(() => {
        async function generateReport() {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error("Authentication required.");

                const { data: workspaceData, error: workspaceError } = await supabase
                    .from('company_users')
                    .select('company_id')
                    .eq('user_id', user.id)
                    .limit(1);

                if (workspaceError) throw workspaceError;
                if (!workspaceData || workspaceData.length === 0) {
                    throw new Error("No secure workspace found.");
                }
                const companyId = workspaceData[0].company_id;

                const { data: transactions, error: txError } = await supabase
                    .from('transaction_lines')
                    .select(`
                        debit_amount,
                        credit_amount,
                        chart_of_accounts!inner(account_code, account_name, category),
                        journal_entries!inner(status)
                    `)
                    .eq('company_id', companyId)
                    .eq('journal_entries.status', 'Posted');

                if (txError) throw txError;

                const astMap = {};
                const liabMap = {};
                const eqMap = {};

                let tAst = 0, tLiab = 0, tEq = 0, tRev = 0, tExp = 0;

                transactions.forEach(tx => {
                    const acc = tx.chart_of_accounts;
                    const codeName = `${acc.account_code} - ${acc.account_name}`;
                    const debit = Number(tx.debit_amount);
                    const credit = Number(tx.credit_amount);

                    if (acc.category === 'Asset') {
                        const netAmount = debit - credit;
                        astMap[codeName] = (astMap[codeName] || 0) + netAmount;
                        tAst += netAmount;
                    } else if (acc.category === 'Liability') {
                        const netAmount = credit - debit;
                        liabMap[codeName] = (liabMap[codeName] || 0) + netAmount;
                        tLiab += netAmount;
                    } else if (acc.category === 'Equity') {
                        const netAmount = credit - debit;
                        eqMap[codeName] = (eqMap[codeName] || 0) + netAmount;
                        tEq += netAmount;
                    } else if (acc.category === 'Revenue') {
                        tRev += (credit - debit);
                    } else if (acc.category === 'Expense') {
                        tExp += (debit - credit);
                    }
                });

                // Magic Step: Calculate Net Income and roll it into Equity
                const netIncome = tRev - tExp;
                if (netIncome !== 0) {
                    eqMap['Current Year Earnings (Net Income)'] = netIncome;
                    tEq += netIncome;
                }

                const formatArray = (mapObj) => {
                    return Object.entries(mapObj)
                        .map(([name, amount]) => ({ name, amount }))
                        .filter(item => item.amount !== 0) // Hide empty accounts
                        .sort((a, b) => a.name.localeCompare(b.name));
                };

                const totalLAndE = tLiab + tEq;

                setReportData({
                    assets: formatArray(astMap),
                    liabilities: formatArray(liabMap),
                    equity: formatArray(eqMap),
                    totalAssets: tAst,
                    totalLiabilities: tLiab,
                    totalEquity: tEq,
                    totalLiabilitiesAndEquity: totalLAndE,
                    isBalanced: Math.round(tAst * 100) === Math.round(totalLAndE * 100)
                });

            } catch (error) {
                console.error("Report Generation Error:", error.message);
                setErrorMsg(error.message);
            } finally {
                setIsLoading(false);
            }
        }

        generateReport();
    }, []);

    // Helper: Generate PDF Export securely
    const exportToPDF = () => {
        const doc = new jsPDF();
        const dateStr = new Date().toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric'
        });

        // Document Title & Branding
        doc.setFontSize(22);
        doc.setTextColor(15, 23, 42); // Slate-900
        doc.text("Balance Sheet", 14, 20);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`As of: ${dateStr}`, 14, 28);
        doc.text("Statement of Financial Position - Confidential", 14, 33);

        // 1. Assets Table
        const assetRows = reportData.assets.map(item => [item.name, `Rs ${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`]);
        assetRows.push([
            { content: 'Total Assets', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
            { content: `Rs ${reportData.totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } }
        ]);

        autoTable(doc, {
            startY: 45,
            head: [['Assets', 'Balance']],
            body: assetRows,
            theme: 'grid',
            headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
            styles: { fontSize: 9 },
            columnStyles: { 1: { halign: 'right' } }
        });

        // 2. Liabilities Table
        const liabRows = reportData.liabilities.map(item => [item.name, `Rs ${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`]);
        liabRows.push([
            { content: 'Total Liabilities', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
            { content: `Rs ${reportData.totalLiabilities.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } }
        ]);

        autoTable(doc, {
            startY: doc.lastAutoTable.finalY + 10,
            head: [['Liabilities', 'Balance']],
            body: liabRows,
            theme: 'grid',
            headStyles: { fillColor: [71, 85, 105], textColor: 255, fontStyle: 'bold' },
            styles: { fontSize: 9 },
            columnStyles: { 1: { halign: 'right' } }
        });

        // 3. Equity Table
        const equityRows = reportData.equity.map(item => [item.name, `Rs ${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`]);
        equityRows.push([
            { content: 'Total Equity', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
            { content: `Rs ${reportData.totalEquity.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } }
        ]);

        autoTable(doc, {
            startY: doc.lastAutoTable.finalY + 10,
            head: [['Equity', 'Balance']],
            body: equityRows,
            theme: 'grid',
            headStyles: { fillColor: [100, 116, 139], textColor: 255, fontStyle: 'bold' }, // Slate-500
            styles: { fontSize: 9 },
            columnStyles: { 1: { halign: 'right' } }
        });

        // Final Audit Summary Box (Assets = Liab + Equity check)
        const finalY = doc.lastAutoTable.finalY + 15;
        const balanceColor = reportData.isBalanced ? [16, 185, 129] : [239, 68, 68]; // Emerald vs Red

        doc.setDrawColor(226, 232, 240);
        doc.setFillColor(248, 250, 252);
        doc.rect(14, finalY, 182, 20, 'F'); // Made box slightly taller

        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(15, 23, 42);

        doc.text("Total Assets:", 20, finalY + 8);
        doc.text(`Rs ${reportData.totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 190, finalY + 8, { align: 'right' });

        doc.text("Total Liabilities & Equity:", 20, finalY + 16);
        doc.text(`Rs ${reportData.totalLiabilitiesAndEquity.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 190, finalY + 16, { align: 'right' });

        // Print Balance Status next to the title
        doc.setFontSize(10);
        doc.setTextColor(balanceColor[0], balanceColor[1], balanceColor[2]);
        doc.text(reportData.isBalanced ? "✓ Books are Balanced" : "⚠ Out of Balance", 196, 20, { align: 'right' });

        doc.save(`Balance_Sheet_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-LK', {
            style: 'currency',
            currency: 'LKR'
        }).format(amount).replace('LKR', 'Rs');
    };

    if (errorMsg) {
        return <div className="p-4 text-red-600 bg-red-50 rounded-md font-medium">Error: {errorMsg}</div>;
    }

    return (
        <div className="space-y-6 max-w-4xl">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">Balance Sheet</h2>
                    <p className="text-slate-500">Statement of Financial Position</p>
                </div>
                <div className="flex flex-col items-end gap-3">
                    {!isLoading && (
                        <div className={`px-3 py-1 rounded-full text-xs font-semibold ${reportData.isBalanced ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                            {reportData.isBalanced ? "✓ Books are Balanced" : "⚠ Out of Balance"}
                        </div>
                    )}
                    <Button
                        onClick={exportToPDF}
                        disabled={isLoading || (reportData.assets.length === 0 && reportData.liabilities.length === 0 && reportData.equity.length === 0)}
                        className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white shadow-sm"
                    >
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        Export to PDF
                    </Button>
                </div>
            </div>

            <Card className="shadow-sm border-slate-200">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
                    <CardTitle className="text-slate-800 text-center uppercase tracking-widest text-sm">
                        {isLoading ? "Compiling Ledger..." : `As of ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`}
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-8">

                    {/* LEFT COLUMN: ASSETS */}
                    <div className="space-y-6 border-r-0 md:border-r border-slate-200 md:pr-8">
                        <div className="space-y-3">
                            <h3 className="font-semibold text-slate-900 border-b border-slate-200 pb-2">Assets</h3>
                            {reportData.assets.length === 0 ? (
                                <p className="text-sm text-slate-500 italic px-2">No assets recorded.</p>
                            ) : (
                                <div className="space-y-2 px-2 text-sm text-slate-700">
                                    {reportData.assets.map((item, idx) => (
                                        <div key={idx} className="flex justify-between">
                                            <span>{item.name}</span>
                                            <span>{formatCurrency(item.amount)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="flex justify-between font-bold text-slate-900 px-2 pt-4 mt-4 border-t-2 border-slate-800 border-double pb-1">
                                <span>Total Assets</span>
                                <span>{formatCurrency(reportData.totalAssets)}</span>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: LIABILITIES & EQUITY */}
                    <div className="space-y-8">

                        {/* LIABILITIES */}
                        <div className="space-y-3">
                            <h3 className="font-semibold text-slate-900 border-b border-slate-200 pb-2">Liabilities</h3>
                            {reportData.liabilities.length === 0 ? (
                                <p className="text-sm text-slate-500 italic px-2">No liabilities recorded.</p>
                            ) : (
                                <div className="space-y-2 px-2 text-sm text-slate-700">
                                    {reportData.liabilities.map((item, idx) => (
                                        <div key={idx} className="flex justify-between">
                                            <span>{item.name}</span>
                                            <span>{formatCurrency(item.amount)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="flex justify-between font-semibold text-slate-900 px-2 pt-2 border-t border-slate-200">
                                <span>Total Liabilities</span>
                                <span>{formatCurrency(reportData.totalLiabilities)}</span>
                            </div>
                        </div>

                        {/* EQUITY */}
                        <div className="space-y-3">
                            <h3 className="font-semibold text-slate-900 border-b border-slate-200 pb-2">Equity</h3>
                            {reportData.equity.length === 0 ? (
                                <p className="text-sm text-slate-500 italic px-2">No equity recorded.</p>
                            ) : (
                                <div className="space-y-2 px-2 text-sm text-slate-700">
                                    {reportData.equity.map((item, idx) => (
                                        <div key={idx} className={`flex justify-between ${item.name.includes('Earnings') ? 'text-slate-500 italic' : ''}`}>
                                            <span>{item.name}</span>
                                            <span>{formatCurrency(item.amount)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="flex justify-between font-semibold text-slate-900 px-2 pt-2 border-t border-slate-200">
                                <span>Total Equity</span>
                                <span>{formatCurrency(reportData.totalEquity)}</span>
                            </div>
                        </div>

                        {/* TOTAL L & E */}
                        <div className="flex justify-between font-bold text-slate-900 px-2 pt-4 mt-4 border-t-2 border-slate-800 border-double pb-1">
                            <span>Total Liab. & Equity</span>
                            <span>{formatCurrency(reportData.totalLiabilitiesAndEquity)}</span>
                        </div>
                    </div>

                </CardContent>
            </Card>
        </div>
    );
}