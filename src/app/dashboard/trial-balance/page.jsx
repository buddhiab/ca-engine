// src/app/dashboard/trial-balance/page.jsx
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function TrialBalance() {
    const [reportData, setReportData] = useState({
        accounts: [],
        totalDebits: 0,
        totalCredits: 0,
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

                // Fetch ALL posted transaction lines across every account category
                const { data: transactions, error: txError } = await supabase
                    .from('transaction_lines')
                    .select(`
                        debit_amount,
                        credit_amount,
                        chart_of_accounts!inner(account_code, account_name),
                        journal_entries!inner(status)
                    `)
                    .eq('company_id', companyId)
                    .eq('journal_entries.status', 'Posted');

                if (txError) throw txError;

                const accountMap = {};

                // Aggregate total debits and credits per account
                transactions.forEach(tx => {
                    const acc = tx.chart_of_accounts;
                    const code = acc.account_code;
                    const name = acc.account_name;
                    const key = `${code} - ${name}`;

                    if (!accountMap[key]) {
                        accountMap[key] = { code, name, debit: 0, credit: 0 };
                    }

                    accountMap[key].debit += Number(tx.debit_amount);
                    accountMap[key].credit += Number(tx.credit_amount);
                });

                const processedAccounts = [];
                let grandTotalDebit = 0;
                let grandTotalCredit = 0;

                // Calculate the NET balance for each account
                Object.values(accountMap).forEach(acc => {
                    const netBalance = acc.debit - acc.credit;

                    // Only include accounts that have a non-zero balance
                    if (netBalance !== 0) {
                        let finalDebit = 0;
                        let finalCredit = 0;

                        if (netBalance > 0) {
                            finalDebit = netBalance;
                            grandTotalDebit += netBalance;
                        } else {
                            finalCredit = Math.abs(netBalance);
                            grandTotalCredit += Math.abs(netBalance);
                        }

                        processedAccounts.push({
                            code: acc.code,
                            name: acc.name,
                            debitBalance: finalDebit,
                            creditBalance: finalCredit
                        });
                    }
                });

                // Sort numerically by account code
                processedAccounts.sort((a, b) => a.code.localeCompare(b.code));

                setReportData({
                    accounts: processedAccounts,
                    totalDebits: grandTotalDebit,
                    totalCredits: grandTotalCredit,
                    isBalanced: Math.round(grandTotalDebit * 100) === Math.round(grandTotalCredit * 100)
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

        // Branding
        doc.setFontSize(22);
        doc.setTextColor(15, 23, 42);
        doc.text("Trial Balance", 14, 20);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`As of: ${dateStr}`, 14, 28);
        doc.text("Internal Audit Report", 14, 33);

        // Map data for AutoTable
        const tableRows = reportData.accounts.map(acc => [
            acc.code,
            acc.name,
            acc.debitBalance > 0 ? `Rs ${acc.debitBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "-",
            acc.creditBalance > 0 ? `Rs ${acc.creditBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "-"
        ]);

        // Add Grand Totals Row
        tableRows.push([
            { content: '', styles: { fillColor: [248, 250, 252] } },
            { content: 'Grand Totals', styles: { fontStyle: 'bold', fillColor: [248, 250, 252], halign: 'right' } },
            { content: `Rs ${reportData.totalDebits.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
            { content: `Rs ${reportData.totalCredits.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } }
        ]);

        autoTable(doc, {
            startY: 45,
            head: [['Code', 'Account Name', 'Debit', 'Credit']],
            body: tableRows,
            theme: 'grid',
            headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
            styles: { fontSize: 9 },
            columnStyles: {
                0: { cellWidth: 25 },
                2: { halign: 'right', cellWidth: 40 },
                3: { halign: 'right', cellWidth: 40 }
            }
        });

        // Audit Badge
        const finalY = doc.lastAutoTable.finalY + 15;
        const balanceColor = reportData.isBalanced ? [16, 185, 129] : [239, 68, 68];

        doc.setFontSize(12);
        doc.setTextColor(balanceColor[0], balanceColor[1], balanceColor[2]);
        doc.text(reportData.isBalanced ? "STATUS: BALANCED" : "STATUS: OUT OF BALANCE", 14, finalY);

        doc.save(`Trial_Balance_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const formatCurrency = (amount) => {
        if (amount === 0) return "-";
        return new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' }).format(amount).replace('LKR', 'Rs');
    };

    if (errorMsg) {
        return <div className="p-4 text-red-600 bg-red-50 rounded-md font-medium">Error: {errorMsg}</div>;
    }

    return (
        <div className="space-y-6 max-w-5xl">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">Trial Balance</h2>
                    <p className="text-slate-500">Unadjusted ledger balances for internal review.</p>
                </div>
                <div className="flex flex-col items-end gap-3">
                    {!isLoading && (
                        <div className={`px-3 py-1 rounded-full text-xs font-semibold ${reportData.isBalanced ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                            {reportData.isBalanced ? "✓ Ledgers are Balanced" : "⚠ Out of Balance"}
                        </div>
                    )}
                    <Button
                        onClick={exportToPDF}
                        disabled={isLoading || reportData.accounts.length === 0}
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
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-medium">
                                <tr>
                                    <th className="px-6 py-4 w-24">Code</th>
                                    <th className="px-6 py-4">Account Name</th>
                                    <th className="px-6 py-4 text-right w-40">Debit</th>
                                    <th className="px-6 py-4 text-right w-40">Credit</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {isLoading ? (
                                    <tr><td colSpan="4" className="px-6 py-10 text-center text-slate-400">Loading balances...</td></tr>
                                ) : reportData.accounts.length === 0 ? (
                                    <tr><td colSpan="4" className="px-6 py-10 text-center text-slate-400">No transactions recorded.</td></tr>
                                ) : (
                                    reportData.accounts.map((acc, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-3 font-medium text-slate-900">{acc.code}</td>
                                            <td className="px-6 py-3 text-slate-700">{acc.name}</td>
                                            <td className="px-6 py-3 text-right font-mono text-slate-600">
                                                {formatCurrency(acc.debitBalance)}
                                            </td>
                                            <td className="px-6 py-3 text-right font-mono text-slate-600">
                                                {formatCurrency(acc.creditBalance)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            {/* GRAND TOTALS FOOTER */}
                            {!isLoading && reportData.accounts.length > 0 && (
                                <tfoot className="bg-slate-50 border-t-2 border-slate-800 font-bold text-slate-900">
                                    <tr>
                                        <td colSpan="2" className="px-6 py-4 text-right uppercase tracking-wider text-xs">
                                            Grand Totals
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono border-b-[3px] border-double border-slate-800">
                                            {formatCurrency(reportData.totalDebits)}
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono border-b-[3px] border-double border-slate-800">
                                            {formatCurrency(reportData.totalCredits)}
                                        </td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}