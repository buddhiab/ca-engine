// src/app/dashboard/income-statement/page.jsx
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable"; // Imported to be used directly

export default function IncomeStatement() {
    const [reportData, setReportData] = useState({
        revenues: [],
        expenses: [],
        totalRevenue: 0,
        totalExpenses: 0,
        netIncome: 0
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
                    .in('chart_of_accounts.category', ['Revenue', 'Expense'])
                    .eq('journal_entries.status', 'Posted');

                if (txError) throw txError;

                const revMap = {};
                const expMap = {};
                let tRev = 0;
                let tExp = 0;

                transactions.forEach(tx => {
                    const acc = tx.chart_of_accounts;
                    const codeName = `${acc.account_code} - ${acc.account_name}`;
                    const debit = Number(tx.debit_amount);
                    const credit = Number(tx.credit_amount);

                    if (acc.category === 'Revenue') {
                        const netAmount = credit - debit;
                        revMap[codeName] = (revMap[codeName] || 0) + netAmount;
                        tRev += netAmount;
                    } else if (acc.category === 'Expense') {
                        const netAmount = debit - credit;
                        expMap[codeName] = (expMap[codeName] || 0) + netAmount;
                        tExp += netAmount;
                    }
                });

                const formatArray = (mapObj) => {
                    return Object.entries(mapObj)
                        .map(([name, amount]) => ({ name, amount }))
                        .sort((a, b) => a.name.localeCompare(b.name));
                };

                setReportData({
                    revenues: formatArray(revMap),
                    expenses: formatArray(expMap),
                    totalRevenue: tRev,
                    totalExpenses: tExp,
                    netIncome: tRev - tExp
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
        doc.text("Income Statement", 14, 20);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`As of: ${dateStr}`, 14, 28);
        doc.text("Confidential Financial Report", 14, 33);

        // Revenue Table
        const revenueRows = reportData.revenues.map(item => [item.name, `Rs ${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`]);
        revenueRows.push([
            { content: 'Total Revenue', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
            { content: `Rs ${reportData.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } }
        ]);

        // FIX: Pass 'doc' as the first argument directly to the imported function
        autoTable(doc, {
            startY: 45,
            head: [['Revenue Accounts', 'Balance']],
            body: revenueRows,
            theme: 'grid',
            headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
            styles: { fontSize: 9 },
            columnStyles: { 1: { halign: 'right' } }
        });

        // Expenses Table
        const expenseRows = reportData.expenses.map(item => [item.name, `Rs ${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`]);
        expenseRows.push([
            { content: 'Total Expenses', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
            { content: `Rs ${reportData.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } }
        ]);

        // FIX: Same direct call method here
        autoTable(doc, {
            startY: doc.lastAutoTable.finalY + 10,
            head: [['Operating Expenses', 'Balance']],
            body: expenseRows,
            theme: 'grid',
            headStyles: { fillColor: [71, 85, 105], textColor: 255, fontStyle: 'bold' },
            styles: { fontSize: 9 },
            columnStyles: { 1: { halign: 'right' } }
        });

        // Net Income Summary Box
        const finalY = doc.lastAutoTable.finalY + 15;
        const netColor = reportData.netIncome >= 0 ? [16, 185, 129] : [239, 68, 68]; // Emerald vs Red

        doc.setDrawColor(226, 232, 240);
        doc.setFillColor(248, 250, 252);
        doc.rect(14, finalY, 182, 15, 'F');

        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text("Net Income (Loss)", 20, finalY + 10);

        doc.setTextColor(netColor[0], netColor[1], netColor[2]);
        doc.text(`Rs ${reportData.netIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 190, finalY + 10, { align: 'right' });

        doc.save(`Income_Statement_${new Date().toISOString().split('T')[0]}.pdf`);
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
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">Income Statement</h2>
                    <p className="text-slate-500">Year-to-Date Profit and Loss</p>
                </div>
                <Button
                    onClick={exportToPDF}
                    disabled={isLoading || (reportData.revenues.length === 0 && reportData.expenses.length === 0)}
                    className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white shadow-sm"
                >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    Export to PDF
                </Button>
            </div>

            <Card className="shadow-sm border-slate-200">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
                    <CardTitle className="text-slate-800 text-center uppercase tracking-widest text-sm">
                        {isLoading ? "Compiling Ledger..." : "Statement of Financial Performance"}
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-8">
                    {/* REVENUE SECTION */}
                    <div className="space-y-3">
                        <h3 className="font-semibold text-slate-900 border-b border-slate-200 pb-2">Revenue</h3>
                        {reportData.revenues.length === 0 ? (
                            <p className="text-sm text-slate-500 italic px-2">No revenue recorded.</p>
                        ) : (
                            <div className="space-y-2 px-2 text-sm text-slate-700">
                                {reportData.revenues.map((item, idx) => (
                                    <div key={idx} className="flex justify-between">
                                        <span>{item.name}</span>
                                        <span>{formatCurrency(item.amount)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="flex justify-between font-semibold text-slate-900 px-2 pt-2">
                            <span>Total Revenue</span>
                            <span>{formatCurrency(reportData.totalRevenue)}</span>
                        </div>
                    </div>

                    {/* EXPENSES SECTION */}
                    <div className="space-y-3">
                        <h3 className="font-semibold text-slate-900 border-b border-slate-200 pb-2">Operating Expenses</h3>
                        {reportData.expenses.length === 0 ? (
                            <p className="text-sm text-slate-500 italic px-2">No expenses recorded.</p>
                        ) : (
                            <div className="space-y-2 px-2 text-sm text-slate-700">
                                {reportData.expenses.map((item, idx) => (
                                    <div key={idx} className="flex justify-between">
                                        <span>{item.name}</span>
                                        <span>{formatCurrency(item.amount)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="flex justify-between font-semibold text-slate-900 px-2 pt-2 border-b border-slate-200 pb-4">
                            <span>Total Expenses</span>
                            <span>{formatCurrency(reportData.totalExpenses)}</span>
                        </div>
                    </div>

                    {/* NET INCOME SECTION */}
                    <div className={`flex justify-between text-lg font-bold p-4 rounded-md ${reportData.netIncome >= 0 ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-900'}`}>
                        <span>Net Income</span>
                        <span className="border-b-[3px] border-current pb-0.5">
                            {formatCurrency(reportData.netIncome)}
                        </span>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}