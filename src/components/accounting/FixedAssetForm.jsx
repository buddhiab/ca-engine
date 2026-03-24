// src/components/accounting/FixedAssetForm.jsx
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Server, Settings } from "lucide-react";
import { toast } from "sonner";

export default function FixedAssetForm({ onAssetRegistered }) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [companyId, setCompanyId] = useState(null);
    const [accounts, setAccounts] = useState([]);

    const [formData, setFormData] = useState({
        assetName: "",
        purchaseCost: "",
        lifespanYears: "3", // Default to 3 years
        expenseAccount: "",
        accumulatedAccount: "",
    });

    useEffect(() => {
        async function fetchData() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data: workspace } = await supabase.from('company_users').select('company_id').eq('user_id', user.id).limit(1);
            if (workspace?.[0]) {
                setCompanyId(workspace[0].company_id);
                const { data: accData } = await supabase.from('chart_of_accounts').select('*').eq('company_id', workspace[0].company_id);
                setAccounts(accData || []);
            }
        }
        fetchData();
    }, []);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    // Math Engine
    const cost = parseFloat(formData.purchaseCost) || 0;
    const months = parseInt(formData.lifespanYears) * 12;
    const monthlyDepreciation = cost > 0 ? (cost / months).toFixed(2) : 0;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const { error } = await supabase.from('fixed_assets').insert([{
                company_id: companyId,
                asset_name: formData.assetName,
                purchase_cost: cost,
                lifespan_months: months,
                monthly_depreciation: monthlyDepreciation,
                expense_account_id: formData.expenseAccount,
                accumulated_account_id: formData.accumulatedAccount
            }]);

            if (error) throw error;

            toast.success("Asset Registered!", { description: `Automated depreciation of Rs ${monthlyDepreciation}/mo activated.` });
            setFormData({ ...formData, assetName: "", purchaseCost: "" });
            if (onAssetRegistered) onAssetRegistered();

        } catch (error) {
            toast.error("Registration Failed", { description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const selectStyles = "flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950";

    return (
        <Card className="w-full max-w-2xl shadow-sm border-slate-200">
            <CardHeader>
                <CardTitle className="text-2xl text-slate-900 flex items-center gap-2">
                    <Server className="h-5 w-5 text-blue-600" />
                    Register Fixed Asset
                </CardTitle>
                <CardDescription>Log large purchases to automatically expense them over several years.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Asset Name</Label>
                            <Input name="assetName" value={formData.assetName} onChange={handleChange} placeholder="e.g., Warehouse Racking" required />
                        </div>
                        <div className="space-y-2">
                            <Label>Purchase Cost (Rs)</Label>
                            <Input type="number" name="purchaseCost" value={formData.purchaseCost} onChange={handleChange} placeholder="300000" required />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 bg-slate-50 p-4 rounded-md border border-slate-100">
                        <div className="space-y-2">
                            <Label>Lifespan</Label>
                            <select name="lifespanYears" value={formData.lifespanYears} onChange={handleChange} className={selectStyles}>
                                <option value="3">3 Years (Computers/Tech)</option>
                                <option value="5">5 Years (Furniture/Vehicles)</option>
                                <option value="10">10 Years (Heavy Equipment)</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label>Depreciation Expense Acct</Label>
                            <select name="expenseAccount" value={formData.expenseAccount} onChange={handleChange} required className={selectStyles}>
                                <option value="" disabled>Select Expense...</option>
                                {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.account_name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label>Accumulated Dep Acct</Label>
                            <select name="accumulatedAccount" value={formData.accumulatedAccount} onChange={handleChange} required className={selectStyles}>
                                <option value="" disabled>Select Liability/Contra...</option>
                                {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.account_name}</option>)}
                            </select>
                        </div>
                    </div>

                    {cost > 0 && (
                        <div className="bg-blue-50 border border-blue-100 p-4 rounded-md flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 text-blue-800"><Settings className="h-4 w-4 animate-spin-slow" /> Background Automation Scheduled</div>
                            <div className="font-semibold text-slate-900">Rs {monthlyDepreciation} / month</div>
                        </div>
                    )}

                    <Button type="submit" disabled={isSubmitting || !companyId} className="w-full bg-slate-900 hover:bg-slate-800 text-white">
                        {isSubmitting ? "Registering..." : "Activate Automated Depreciation"}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}