// src/components/accounting/JournalEntryForm.jsx
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Paperclip, FileCheck, X } from "lucide-react";

export default function JournalEntryForm({ onEntryPosted }) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [companyId, setCompanyId] = useState(null);
    const [isFetchingWorkspace, setIsFetchingWorkspace] = useState(true);
    const [accounts, setAccounts] = useState([]);
    const [file, setFile] = useState(null);

    const [formData, setFormData] = useState({
        date: "",
        description: "",
        debitAccount: "", 
        debitAmount: "",
        creditAccount: "", 
        creditAmount: "",
    });

    useEffect(() => {
        async function fetchWorkspaceData() {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                const { data: workspaceData, error: workspaceError } = await supabase
                    .from('company_users')
                    .select('company_id')
                    .eq('user_id', user.id)
                    .limit(1);

                if (workspaceError) throw workspaceError;
                
                if (workspaceData && workspaceData.length > 0) {
                    const currentCompanyId = workspaceData[0].company_id;
                    setCompanyId(currentCompanyId);

                    const { data: accountsData, error: accountsError } = await supabase
                        .from('chart_of_accounts')
                        .select('id, account_code, account_name')
                        .eq('company_id', currentCompanyId)
                        .order('account_code', { ascending: true });

                    if (accountsError) throw accountsError;
                    setAccounts(accountsData || []);
                    
                } else {
                    throw new Error("No secure workspace found.");
                }
            } catch (error) {
                console.error("Workspace Error:", error.message);
            } finally {
                setIsFetchingWorkspace(false);
            }
        }
        fetchWorkspaceData();
    }, []);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!companyId) {
            alert("Error: No secure workspace found. Please log in again.");
            return;
        }

        setIsSubmitting(true);

        const debitVal = parseFloat(formData.debitAmount);
        const creditVal = parseFloat(formData.creditAmount);

        if (debitVal !== creditVal) {
            alert(`Validation Error: Debits (Rs ${debitVal}) and Credits (Rs ${creditVal}) must balance perfectly.`);
            setIsSubmitting(false);
            return;
        }

        if (!formData.debitAccount || !formData.creditAccount) {
            alert("Validation Error: Please select both a Debit and Credit account.");
            setIsSubmitting(false);
            return;
        }

        try {
            // 1. Upload Document if present
            let receiptPath = null;
            if (file) {
                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}.${fileExt}`;
                const filePath = `${companyId}/${fileName}`; 

                const { error: uploadError } = await supabase.storage
                    .from('receipts')
                    .upload(filePath, file);

                if (uploadError) throw uploadError;
                receiptPath = filePath;
            }

            // 2. Insert the Journal Entry (now with receipt_url)
            const { data: journalEntry, error: jeError } = await supabase
                .from('journal_entries')
                .insert([{
                    company_id: companyId,
                    entry_date: formData.date,
                    description: formData.description,
                    status: 'Posted',
                    receipt_url: receiptPath
                }])
                .select()
                .single();

            if (jeError) throw jeError;

            // 3. Insert the Transaction Lines
            const { error: linesError } = await supabase
                .from('transaction_lines')
                .insert([
                    {
                        company_id: companyId,
                        entry_id: journalEntry.id,
                        account_id: formData.debitAccount, 
                        debit_amount: debitVal,
                        credit_amount: 0.00
                    },
                    {
                        company_id: companyId,
                        entry_id: journalEntry.id,
                        account_id: formData.creditAccount, 
                        debit_amount: 0.00,
                        credit_amount: creditVal
                    }
                ]);

            if (linesError) throw linesError;

            alert("Success! Journal Entry securely posted to your workspace.");
            setFormData({
                date: "", description: "", debitAccount: "", debitAmount: "", creditAccount: "", creditAmount: ""
            });
            setFile(null);

            if (onEntryPosted) onEntryPosted();

        } catch (error) {
            console.error("Transaction Error:", error);
            alert(error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const selectStyles = "flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

    return (
        <Card className="w-full max-w-2xl shadow-sm border-slate-200">
            <CardHeader>
                <CardTitle className="text-2xl text-slate-900">New Journal Entry</CardTitle>
                <CardDescription>
                    {isFetchingWorkspace ? "Connecting to secure workspace..." : "Manually record a financial transaction into your general ledger."}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="date">Transaction Date</Label>
                            <Input type="date" id="date" name="date" value={formData.date} onChange={handleChange} required disabled={isFetchingWorkspace} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Input type="text" id="description" name="description" value={formData.description} placeholder="e.g., Monthly Rent" onChange={handleChange} required disabled={isFetchingWorkspace} />
                        </div>
                    </div>

                    <div className="border-t border-slate-100 pt-4 grid grid-cols-2 gap-4">
                        <div className="space-y-4 bg-slate-50 p-4 rounded-md">
                            <h3 className="font-semibold text-sm text-slate-700">Debit</h3>
                            <div className="space-y-2">
                                <Label htmlFor="debitAccount">Account</Label>
                                <select id="debitAccount" name="debitAccount" value={formData.debitAccount} onChange={handleChange} required disabled={isFetchingWorkspace} className={selectStyles}>
                                    <option value="" disabled>Select an account...</option>
                                    {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.account_code} - {acc.account_name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="debitAmount">Amount (Rs)</Label>
                                <Input type="number" id="debitAmount" name="debitAmount" value={formData.debitAmount} placeholder="0.00" step="0.01" min="0" onChange={handleChange} required disabled={isFetchingWorkspace} />
                            </div>
                        </div>

                        <div className="space-y-4 bg-slate-50 p-4 rounded-md">
                            <h3 className="font-semibold text-sm text-slate-700">Credit</h3>
                            <div className="space-y-2">
                                <Label htmlFor="creditAccount">Account</Label>
                                <select id="creditAccount" name="creditAccount" value={formData.creditAccount} onChange={handleChange} required disabled={isFetchingWorkspace} className={selectStyles}>
                                    <option value="" disabled>Select an account...</option>
                                    {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.account_code} - {acc.account_name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="creditAmount">Amount (Rs)</Label>
                                <Input type="number" id="creditAmount" name="creditAmount" value={formData.creditAmount} placeholder="0.00" step="0.01" min="0" onChange={handleChange} required disabled={isFetchingWorkspace} />
                            </div>
                        </div>
                    </div>

                    {/* SOURCE DOCUMENT UPLOAD SECTION */}
                    <div className="space-y-3 pt-2">
                        <Label className="text-slate-700 flex items-center gap-2">
                            <Paperclip className="h-4 w-4" /> Source Document (Receipt/Invoice)
                        </Label>
                        <div className="relative">
                            <Input 
                                type="file" 
                                accept=".pdf,.jpg,.jpeg,.png" 
                                onChange={handleFileChange} 
                                className="cursor-pointer file:bg-slate-100 file:border-0 file:rounded-md file:px-2 file:py-1 file:mr-4 file:text-xs file:font-bold hover:file:bg-slate-200"
                            />
                            {file && (
                                <div className="mt-2 flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 p-2 rounded border border-emerald-100">
                                    <FileCheck className="h-3.5 w-3.5" />
                                    <span className="truncate">{file.name} ready for secure upload</span>
                                    <button type="button" onClick={() => setFile(null)} className="ml-auto text-slate-400 hover:text-red-500">
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <Button type="submit" disabled={isSubmitting || isFetchingWorkspace || !companyId} className="w-full bg-slate-900 hover:bg-slate-800 text-white disabled:bg-slate-400">
                        {isSubmitting ? "Processing Transaction..." : "Post Journal Entry"}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}