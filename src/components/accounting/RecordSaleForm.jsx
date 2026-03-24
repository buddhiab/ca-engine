// src/components/accounting/RecordSaleForm.jsx
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ShoppingCart, Calculator, Receipt } from "lucide-react";
import { toast } from "sonner";

export default function RecordSaleForm({ onSalePosted }) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [companyId, setCompanyId] = useState(null);
    const [accounts, setAccounts] = useState([]);

    const [formData, setFormData] = useState({
        date: "",
        description: "Sale of Goods (e.g., Smartwatch)",
        bankAccount: "",     // Asset: Where the money goes
        revenueAccount: "",  // Income: Sales Revenue
        taxAccount: "",      // Liability: VAT Payable
        grossAmount: "",
        taxRate: "0.18",     // Default to 18% VAT
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

    // --- THE TAX MATH ENGINE ---
    const grossTotal = parseFloat(formData.grossAmount) || 0;
    const rate = parseFloat(formData.taxRate) || 0;

    // Calculate exact Revenue and Tax (Rounded to 2 decimals for accounting accuracy)
    const netRevenue = Number((grossTotal / (1 + rate)).toFixed(2));
    const taxLiability = Number((grossTotal - netRevenue).toFixed(2));

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.bankAccount || !formData.revenueAccount || (!formData.taxAccount && rate > 0)) {
            toast.error("Missing Accounts", { description: "Please select all required ledger accounts." });
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
                    description: formData.description,
                    status: 'Posted'
                }])
                .select()
                .single();

            if (jeError) throw jeError;

            // 2. Prepare the perfectly balanced 3-line entry
            const lines = [
                // Line 1: Debit Bank/Cash (Total Amount Received)
                { company_id: companyId, entry_id: journalEntry.id, account_id: formData.bankAccount, debit_amount: grossTotal, credit_amount: 0.00 },

                // Line 2: Credit Sales Revenue (The actual money you keep)
                { company_id: companyId, entry_id: journalEntry.id, account_id: formData.revenueAccount, debit_amount: 0.00, credit_amount: netRevenue }
            ];

            // Line 3: Credit Tax Liability (The money you owe the government)
            if (taxLiability > 0) {
                lines.push({ company_id: companyId, entry_id: journalEntry.id, account_id: formData.taxAccount, debit_amount: 0.00, credit_amount: taxLiability });
            }

            // 3. Post to Supabase
            const { error: linesError } = await supabase.from('transaction_lines').insert(lines);
            if (linesError) throw linesError;

            toast.success("Sale Recorded", { description: "Revenue and Tax Liability have been automatically split and posted." });

            setFormData({ ...formData, grossAmount: "", description: "Sale of Goods" });
            if (onSalePosted) onSalePosted();

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
                    <ShoppingCart className="h-5 w-5 text-emerald-600" />
                    Record a Sale
                </CardTitle>
                <CardDescription>Enter the total sale amount. The engine will automatically extract the taxes.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* TOP ROW: Date & Description */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Sale Date</Label>
                            <Input type="date" name="date" value={formData.date} onChange={handleChange} required />
                        </div>
                        <div className="space-y-2">
                            <Label>Description / Customer</Label>
                            <Input type="text" name="description" value={formData.description} onChange={handleChange} required />
                        </div>
                    </div>

                    {/* MIDDLE ROW: Account Mapping */}
                    <div className="grid grid-cols-3 gap-4 bg-slate-50 p-4 rounded-md border border-slate-100">
                        <div className="space-y-2">
                            <Label>Deposit To (Bank)</Label>
                            <select name="bankAccount" value={formData.bankAccount} onChange={handleChange} required className={selectStyles}>
                                <option value="" disabled>Select Bank...</option>
                                {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.account_name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label>Sales Revenue Account</Label>
                            <select name="revenueAccount" value={formData.revenueAccount} onChange={handleChange} required className={selectStyles}>
                                <option value="" disabled>Select Revenue...</option>
                                {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.account_name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label>Tax Liability Account</Label>
                            <select name="taxAccount" value={formData.taxAccount} onChange={handleChange} className={selectStyles}>
                                <option value="" disabled>Select Tax Payable...</option>
                                {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.account_name}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* BOTTOM ROW: The Financials */}
                    <div className="grid grid-cols-2 gap-4 items-start">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Gross Sale Amount (Customer Pays)</Label>
                                <Input type="number" name="grossAmount" value={formData.grossAmount} onChange={handleChange} placeholder="e.g., 25000" step="0.01" required className="text-lg font-medium" />
                            </div>
                            <div className="space-y-2">
                                <Label>Included Tax Rate</Label>
                                <select name="taxRate" value={formData.taxRate} onChange={handleChange} className={selectStyles}>
                                    <option value="0">0% - No Tax</option>
                                    <option value="0.025">2.5% - SSCL Only</option>
                                    <option value="0.18">18% - VAT</option>
                                </select>
                            </div>
                        </div>

                        {/* LIVE CALCULATION WIDGET */}
                        <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-md h-full flex flex-col justify-center space-y-3">
                            <div className="flex items-center gap-2 text-emerald-800 font-medium mb-2 border-b border-emerald-200 pb-2">
                                <Calculator className="h-4 w-4" /> Tax Breakdown
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-600">Net Revenue (You Keep):</span>
                                <span className="font-semibold text-slate-900">Rs {netRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-600">Tax Liability (You Owe):</span>
                                <span className="font-semibold text-red-600">Rs {taxLiability.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between text-sm pt-2 border-t border-emerald-200 font-bold">
                                <span className="text-slate-900">Total Collected:</span>
                                <span className="text-emerald-700">Rs {grossTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                    </div>

                    <Button type="submit" disabled={isSubmitting || !companyId || grossTotal <= 0} className="w-full bg-slate-900 hover:bg-slate-800 text-white transition-all">
                        {isSubmitting ? "Recording Sale..." : "Record Sale & Calculate Taxes"}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}