// src/app/dashboard/reconciliation/page.jsx
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UploadCloud, CheckCircle2, ArrowRightLeft, Loader2, AlertCircle } from "lucide-react";
import Papa from "papaparse";

export default function BankReconciliation() {
    const [companyId, setCompanyId] = useState(null);
    const [ledgerItems, setLedgerItems] = useState([]);
    const [bankItems, setBankItems] = useState([]);
    const [matches, setMatches] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);

    // Fetch Unreconciled Asset Transactions (e.g., Cash / Bank Accounts)
    const fetchLedger = async () => {
        setIsLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: workspaceData } = await supabase
                .from('company_users')
                .select('company_id')
                .eq('user_id', user.id)
                .limit(1);

            if (!workspaceData || workspaceData.length === 0) return;
            setCompanyId(workspaceData[0].company_id);

            const { data: txData } = await supabase
                .from('transaction_lines')
                .select(`
                    id, debit_amount, credit_amount, is_reconciled,
                    chart_of_accounts!inner(category, account_name),
                    journal_entries!inner(entry_date, description, status)
                `)
                .eq('company_id', workspaceData[0].company_id)
                .eq('chart_of_accounts.category', 'Asset')
                .eq('is_reconciled', false)
                .eq('journal_entries.status', 'Posted');

            if (txData) {
                // Normalize ledger data to a signed amount for easy matching (+ for debits, - for credits)
                const normalized = txData.map(tx => {
                    const amount = Number(tx.debit_amount) > 0 ? Number(tx.debit_amount) : -Number(tx.credit_amount);
                    return {
                        id: tx.id,
                        date: tx.journal_entries.entry_date,
                        description: tx.journal_entries.description,
                        account: tx.chart_of_accounts.account_name,
                        amount: amount
                    };
                });
                setLedgerItems(normalized);
            }
        } catch (error) {
            console.error("Ledger Fetch Error:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchLedger();
    }, []);

    // 🧠 THE ALGORITHM: Parse CSV and Auto-Match
    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: function (results) {
                // Assuming standard bank CSV headers: Date, Description, Amount
                const parsedBankData = results.data.map((row, index) => ({
                    id: `bank-${index}`,
                    date: row.Date || row.date,
                    description: row.Description || row.description,
                    amount: parseFloat(row.Amount || row.amount)
                })).filter(item => !isNaN(item.amount));

                setBankItems(parsedBankData);
                runMatchingAlgorithm(parsedBankData, ledgerItems);
            }
        });
    };

    const runMatchingAlgorithm = (bankData, ledgerData) => {
        const newMatches = [];
        const unmatchedBank = [...bankData];
        const unmatchedLedger = [...ledgerData];

        // First Pass: Exact Amount Match
        for (let i = unmatchedBank.length - 1; i >= 0; i--) {
            const bItem = unmatchedBank[i];

            // Find a ledger item with the exact same amount
            const lIndex = unmatchedLedger.findIndex(lItem => lItem.amount === bItem.amount);

            if (lIndex !== -1) {
                // We found a match! Pair them up and remove from the unmatched pools.
                const lItem = unmatchedLedger[lIndex];
                newMatches.push({ bank: bItem, ledger: lItem });
                unmatchedBank.splice(i, 1);
                unmatchedLedger.splice(lIndex, 1);
            }
        }

        setMatches(newMatches);
        setBankItems(unmatchedBank);
        setLedgerItems(unmatchedLedger);
    };

    const handleConfirmReconciliation = async () => {
        if (matches.length === 0) return;
        setIsProcessing(true);

        try {
            // Extract the IDs of the ledger transactions we are confirming
            const ledgerIdsToUpdate = matches.map(m => m.ledger.id);

            const { error } = await supabase
                .from('transaction_lines')
                .update({ is_reconciled: true })
                .in('id', ledgerIdsToUpdate);

            if (error) throw error;

            alert(`Successfully reconciled ${matches.length} transactions!`);
            setMatches([]);
            // Ledger items are already updated in state via the matching algorithm, 
            // but we could call fetchLedger() to be absolutely safe.
            fetchLedger();

        } catch (error) {
            alert("Reconciliation Failed: " + error.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    if (isLoading) return <div className="p-8 text-slate-500 font-medium">Loading Reconciliation Engine...</div>;

    return (
        <div className="space-y-8 max-w-6xl">
            <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">Bank Reconciliation</h2>
                <p className="text-slate-500">Upload your bank statement to automatically verify ledger accuracy.</p>
            </div>

            {/* UPLOAD SECTION */}
            <Card className="shadow-sm border-slate-200">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                    <CardTitle className="text-lg text-slate-900 flex items-center gap-2">
                        <UploadCloud className="h-5 w-5" /> Import Bank Statement
                    </CardTitle>
                    <CardDescription>Upload a CSV with headers: Date, Description, Amount.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                    <Input
                        type="file"
                        accept=".csv"
                        onChange={handleFileUpload}
                        className="cursor-pointer file:bg-slate-900 file:text-white file:border-0 file:rounded-md file:px-4 file:py-1 file:mr-4 file:text-xs file:font-semibold hover:file:bg-slate-800"
                    />
                </CardContent>
            </Card>

            {/* THE MATCHING STUDIO */}
            {matches.length > 0 && (
                <Card className="shadow-sm border-emerald-200 bg-emerald-50/30">
                    <CardHeader className="border-b border-emerald-100 pb-4 flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-lg text-emerald-900 flex items-center gap-2">
                                <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Auto-Matched Transactions
                            </CardTitle>
                            <CardDescription className="text-emerald-700">The algorithm found {matches.length} perfect matches.</CardDescription>
                        </div>
                        <Button
                            onClick={handleConfirmReconciliation}
                            disabled={isProcessing}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Confirm & Reconcile All"}
                        </Button>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-3">
                        {matches.map((match, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-white p-3 rounded-md border border-emerald-100 shadow-sm">
                                <div className="flex-1 space-y-1">
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Bank Record</p>
                                    <p className="text-sm font-medium text-slate-900">{match.bank.description}</p>
                                    <p className="text-xs text-slate-500">{match.bank.date}</p>
                                </div>
                                <div className="px-4 text-emerald-500">
                                    <ArrowRightLeft className="h-5 w-5" />
                                </div>
                                <div className="flex-1 space-y-1 text-right">
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ledger Entry</p>
                                    <p className="text-sm font-medium text-slate-900">{match.ledger.description}</p>
                                    <p className="text-xs text-slate-500">{match.ledger.account}</p>
                                </div>
                                <div className="w-32 text-right">
                                    <span className={`text-base font-bold ${match.bank.amount > 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                                        {formatCurrency(match.bank.amount)}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* UNMATCHED DATA STREAMS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* LEFT: UNMATCHED BANK */}
                <Card className="shadow-sm border-slate-200">
                    <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                        <CardTitle className="text-sm text-slate-700 flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-amber-500" /> Unmatched Bank Records
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
                            {bankItems.length === 0 ? (
                                <p className="text-xs text-slate-400 text-center py-6 italic">No pending bank transactions.</p>
                            ) : (
                                bankItems.map((item, idx) => (
                                    <div key={idx} className="p-3 flex justify-between items-center hover:bg-slate-50 transition-colors">
                                        <div>
                                            <p className="text-sm font-medium text-slate-900">{item.description}</p>
                                            <p className="text-xs text-slate-500">{item.date}</p>
                                        </div>
                                        <p className={`text-sm font-mono font-bold ${item.amount > 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                                            {formatCurrency(item.amount)}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* RIGHT: UNMATCHED LEDGER */}
                <Card className="shadow-sm border-slate-200">
                    <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                        <CardTitle className="text-sm text-slate-700 flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-amber-500" /> Unmatched Ledger Entries
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
                            {ledgerItems.length === 0 ? (
                                <p className="text-xs text-slate-400 text-center py-6 italic">All ledger assets reconciled.</p>
                            ) : (
                                ledgerItems.map((item, idx) => (
                                    <div key={idx} className="p-3 flex justify-between items-center hover:bg-slate-50 transition-colors">
                                        <div>
                                            <p className="text-sm font-medium text-slate-900">{item.description}</p>
                                            <p className="text-xs text-slate-500">{item.account} • {item.date}</p>
                                        </div>
                                        <p className={`text-sm font-mono font-bold ${item.amount > 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                                            {formatCurrency(item.amount)}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}