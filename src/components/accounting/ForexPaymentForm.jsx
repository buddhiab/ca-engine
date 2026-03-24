// src/components/accounting/ForexPaymentForm.jsx
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Calculator, RefreshCw, DollarSign, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";

export default function ForexPaymentForm({ onPaymentPosted }) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isFetchingRate, setIsFetchingRate] = useState(false);
    const [companyId, setCompanyId] = useState(null);
    const [accounts, setAccounts] = useState([]);
    const [liveRate, setLiveRate] = useState(null);

    const [formData, setFormData] = useState({
        date: "",
        currency: "USD",
        foreignAmount: "",
        originalRate: "",
        apAccount: "",     // Accounts Payable
        bankAccount: "",   // Cash/Bank
        fxAccount: "",     // FX Gain/Loss Expense Account
    });

    useEffect(() => {
        async function fetchWorkspaceData() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: workspaceData } = await supabase
                .from('company_users')
                .select('company_id')
                .eq('user_id', user.id)
                .limit(1);

            if (workspaceData?.[0]) {
                const currentCompanyId = workspaceData[0].company_id;
                setCompanyId(currentCompanyId);

                const { data: accountsData } = await supabase
                    .from('chart_of_accounts')
                    .select('id, account_code, account_name')
                    .eq('company_id', currentCompanyId)
                    .order('account_code');

                setAccounts(accountsData || []);
            }
        }
        fetchWorkspaceData();
    }, []);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const fetchLiveRate = async () => {
        setIsFetchingRate(true);
        try {
            const response = await fetch(`/api/forex?base=${formData.currency}`);
            const data = await response.json();

            if (!response.ok) throw new Error(data.error);

            setLiveRate(data.rate);
            toast.success("Live Rate Fetched", {
                description: `Current rate: 1 ${formData.currency} = ${data.rate.toFixed(2)} LKR`
            });
        } catch (error) {
            toast.error("Failed to fetch live rate", { description: error.message });
        } finally {
            setIsFetchingRate(false);
        }
    };

    // --- THE FX MATH ENGINE ---
    const foreignAmt = parseFloat(formData.foreignAmount) || 0;
    const origRate = parseFloat(formData.originalRate) || 0;
    const currentRate = liveRate || 0;

    const originalLkrLiability = foreignAmt * origRate;
    const actualLkrPayment = foreignAmt * currentRate;
    const fxDifference = actualLkrPayment - originalLkrLiability; // Positive = Loss (Paid more), Negative = Gain (Paid less)

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!liveRate) {
            toast.error("Missing Data", { description: "Please fetch the live exchange rate first." });
            return;
        }

        setIsSubmitting(true);

        try {
            // 1. Create the Journal Entry Header
            const { data: journalEntry, error: jeError } = await supabase
                .from('journal_entries')
                .insert([{
                    company_id: companyId,
                    entry_date: formData.date,
                    description: `FX Payment: ${foreignAmt} ${formData.currency} at ${currentRate} LKR`,
                    status: 'Posted'
                }])
                .select()
                .single();

            if (jeError) throw jeError;

            // 2. Prepare the perfectly balanced lines
            const lines = [
                // Line 1: Clear the original Accounts Payable liability (Debit)
                { company_id: companyId, entry_id: journalEntry.id, account_id: formData.apAccount, debit_amount: originalLkrLiability, credit_amount: 0.00 },
                // Line 2: Deduct the actual cash leaving the bank (Credit)
                { company_id: companyId, entry_id: journalEntry.id, account_id: formData.bankAccount, debit_amount: 0.00, credit_amount: actualLkrPayment }
            ];

            // Line 3: The FX Gain or Loss balancing entry
            if (fxDifference > 0) {
                // We paid MORE than expected. It's an FX Loss (Debit Expense)
                lines.push({ company_id: companyId, entry_id: journalEntry.id, account_id: formData.fxAccount, debit_amount: fxDifference, credit_amount: 0.00 });
            } else if (fxDifference < 0) {
                // We paid LESS than expected. It's an FX Gain (Credit Income)
                lines.push({ company_id: companyId, entry_id: journalEntry.id, account_id: formData.fxAccount, debit_amount: 0.00, credit_amount: Math.abs(fxDifference) });
            }

            // 3. Post all lines to Supabase
            const { error: linesError } = await supabase.from('transaction_lines').insert(lines);
            if (linesError) throw linesError;

            toast.success("Multi-Currency Payment Posted", { description: "FX differences calculated and perfectly balanced." });
            setFormData({ ...formData, foreignAmount: "", originalRate: "" });
            setLiveRate(null);
            if (onPaymentPosted) onPaymentPosted();

        } catch (error) {
            toast.error("Transaction Error", { description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const selectStyles = "flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950";

    return (
        <Card className="w-full max-w-2xl shadow-sm border-slate-200">
            <CardHeader>
                <CardTitle className="text-2xl text-slate-900 flex items-center gap-2">
                    <ArrowRightLeft className="h-5 w-5 text-indigo-600" />
                    Foreign Vendor Payment
                </CardTitle>
                <CardDescription>Pay overseas suppliers and automatically calculate LKR currency fluctuations.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* TOP ROW: Date & Accounts */}
                    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-md border border-slate-100">
                        <div className="space-y-2">
                            <Label>Payment Date</Label>
                            <Input type="date" name="date" value={formData.date} onChange={handleChange} required />
                        </div>
                        <div className="space-y-2">
                            <Label>Accounts Payable (Vendor Account)</Label>
                            <select name="apAccount" value={formData.apAccount} onChange={handleChange} required className={selectStyles}>
                                <option value="" disabled>Select AP Account...</option>
                                {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.account_code} - {acc.account_name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label>Paying From (Bank/Cash)</Label>
                            <select name="bankAccount" value={formData.bankAccount} onChange={handleChange} required className={selectStyles}>
                                <option value="" disabled>Select Bank Account...</option>
                                {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.account_code} - {acc.account_name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label>FX Gain/Loss Account</Label>
                            <select name="fxAccount" value={formData.fxAccount} onChange={handleChange} required className={selectStyles}>
                                <option value="" disabled>Select FX Account...</option>
                                {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.account_code} - {acc.account_name}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* MIDDLE ROW: The Currency Math */}
                    <div className="grid grid-cols-3 gap-4 items-end">
                        <div className="space-y-2">
                            <Label>Currency</Label>
                            <select name="currency" value={formData.currency} onChange={handleChange} className={selectStyles}>
                                <option value="USD">USD - US Dollar</option>
                                <option value="CNY">CNY - Chinese Yuan</option>
                                <option value="EUR">EUR - Euro</option>
                                <option value="GBP">GBP - British Pound</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label>Bill Amount ({formData.currency})</Label>
                            <Input type="number" name="foreignAmount" value={formData.foreignAmount} onChange={handleChange} placeholder="0.00" step="0.01" required />
                        </div>
                        <div className="space-y-2">
                            <Label>Original Rate (LKR)</Label>
                            <Input type="number" name="originalRate" value={formData.originalRate} onChange={handleChange} placeholder="e.g., 300.50" step="0.01" required />
                        </div>
                    </div>

                    {/* LIVE RATE FETCH & SUMMARY */}
                    <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-md space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-indigo-900 font-medium">Live Market Rate</div>
                            <Button type="button" onClick={fetchLiveRate} disabled={isFetchingRate} variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 h-8 text-xs">
                                {isFetchingRate ? <RefreshCw className="h-3 w-3 mr-2 animate-spin" /> : <DollarSign className="h-3 w-3 mr-2" />}
                                Fetch Live LKR Rate
                            </Button>
                        </div>

                        {liveRate && (
                            <div className="grid grid-cols-3 gap-4 text-sm border-t border-indigo-100 pt-3">
                                <div>
                                    <span className="text-slate-500 block text-xs">Original Liability</span>
                                    <span className="font-medium text-slate-700">Rs {originalLkrLiability.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block text-xs">Today's Payment</span>
                                    <span className="font-medium text-slate-900">Rs {actualLkrPayment.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block text-xs">FX Impact</span>
                                    {fxDifference > 0 ? (
                                        <span className="font-bold text-red-600">Loss: Rs {Math.abs(fxDifference).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    ) : fxDifference < 0 ? (
                                        <span className="font-bold text-emerald-600">Gain: Rs {Math.abs(fxDifference).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    ) : (
                                        <span className="font-medium text-slate-500">Perfect Match</span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <Button type="submit" disabled={isSubmitting || !companyId || !liveRate} className="w-full bg-slate-900 hover:bg-slate-800 text-white transition-all">
                        {isSubmitting ? "Executing Transaction..." : "Post Multi-Currency Payment"}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}