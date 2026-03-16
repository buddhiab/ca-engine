// src/app/dashboard/record-sale/page.jsx
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShoppingCart, Loader2, CheckCircle2 } from "lucide-react";

export default function RecordSale() {
    const [companyId, setCompanyId] = useState(null);
    const [inventory, setInventory] = useState([]);
    const [assetAccounts, setAssetAccounts] = useState([]); // E.g., Cash or Accounts Receivable
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMsg, setSuccessMsg] = useState("");

    const [saleData, setSaleData] = useState({
        date: new Date().toISOString().split('T')[0],
        item_id: "",
        quantity: 1,
        receiving_account_id: "",
        customer_name: ""
    });

    useEffect(() => {
        async function fetchData() {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                const { data: workspaceData } = await supabase
                    .from('company_users')
                    .select('company_id')
                    .eq('user_id', user.id)
                    .limit(1);

                if (!workspaceData || workspaceData.length === 0) return;
                const currentCompanyId = workspaceData[0].company_id;
                setCompanyId(currentCompanyId);

                // Fetch Inventory (Only items that are actually in stock!)
                const { data: invData } = await supabase
                    .from('inventory_items')
                    .select('*')
                    .eq('company_id', currentCompanyId)
                    .gt('quantity_on_hand', 0)
                    .order('name');
                if (invData) setInventory(invData);

                // Fetch Accounts where the money can be deposited (Cash, Bank, AR)
                const { data: accData } = await supabase
                    .from('chart_of_accounts')
                    .select('*')
                    .eq('company_id', currentCompanyId)
                    .eq('category', 'Asset')
                    .order('account_name');
                if (accData) setAssetAccounts(accData);

            } catch (error) {
                console.error("Fetch error:", error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, []);

    const handleChange = (e) => {
        setSaleData({ ...saleData, [e.target.name]: e.target.value });
    };

    const handleSale = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setSuccessMsg("");

        try {
            // Find the selected item to dynamically create a great description
            const selectedItem = inventory.find(i => i.id === saleData.item_id);
            const description = `Sale: ${saleData.quantity}x ${selectedItem.name} ${saleData.customer_name ? `to ${saleData.customer_name}` : ''}`;

            // Call the SQL "Robot" we just created
            const { data, error } = await supabase.rpc('record_inventory_sale', {
                p_company_id: companyId,
                p_item_id: saleData.item_id,
                p_quantity: parseInt(saleData.quantity),
                p_date: saleData.date,
                p_description: description,
                p_receiving_account_id: saleData.receiving_account_id
            });

            if (error) throw error;

            setSuccessMsg(`Success! Sold ${saleData.quantity} unit(s) of ${selectedItem.name}. The ledger has been updated automatically.`);
            setSaleData({ ...saleData, quantity: 1, customer_name: "" });

            // Refresh inventory to show new stock levels
            const { data: refreshedInv } = await supabase
                .from('inventory_items')
                .select('*')
                .eq('company_id', companyId)
                .gt('quantity_on_hand', 0);
            if (refreshedInv) setInventory(refreshedInv);

        } catch (error) {
            alert("Transaction Failed: " + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const selectStyles = "flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 disabled:opacity-50";

    if (isLoading) return <div className="p-8">Loading Sales Terminal...</div>;

    return (
        <div className="max-w-3xl space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">Record a Sale</h2>
                <p className="text-slate-500">Log a transaction. The engine will handle the COGS and inventory reduction automatically.</p>
            </div>

            {successMsg && (
                <div className="p-4 mb-4 text-sm text-emerald-800 bg-emerald-50 rounded-lg flex items-center gap-2 border border-emerald-200">
                    <CheckCircle2 className="h-5 w-5" />
                    {successMsg}
                </div>
            )}

            <Card className="shadow-sm border-slate-200">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                    <CardTitle className="text-lg text-slate-900 flex items-center gap-2">
                        <ShoppingCart className="h-5 w-5" /> Sales Terminal
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <form onSubmit={handleSale} className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Transaction Date</Label>
                                <Input type="date" name="date" value={saleData.date} onChange={handleChange} required />
                            </div>
                            <div className="space-y-2">
                                <Label>Customer Name (Optional)</Label>
                                <Input type="text" name="customer_name" placeholder="e.g., John Doe" value={saleData.customer_name} onChange={handleChange} />
                            </div>
                        </div>

                        <div className="p-5 border border-slate-200 rounded-lg bg-slate-50 space-y-4">
                            <div className="space-y-2">
                                <Label className="font-bold text-slate-700">Select Product to Sell</Label>
                                <select name="item_id" value={saleData.item_id} onChange={handleChange} required className={selectStyles}>
                                    <option value="" disabled>Choose an item from inventory...</option>
                                    {inventory.map(item => (
                                        <option key={item.id} value={item.id}>
                                            {item.sku} - {item.name} ({item.quantity_on_hand} in stock at Rs {item.selling_price})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Quantity Sold</Label>
                                    <Input type="number" name="quantity" min="1" max={inventory.find(i => i.id === saleData.item_id)?.quantity_on_hand || 1} value={saleData.quantity} onChange={handleChange} required />
                                </div>
                                <div className="space-y-2">
                                    <Label>Deposit To (Receiving Account)</Label>
                                    <select name="receiving_account_id" value={saleData.receiving_account_id} onChange={handleChange} required className={selectStyles}>
                                        <option value="" disabled>Where is the money going?</option>
                                        {assetAccounts.map(acc => (
                                            <option key={acc.id} value={acc.id}>{acc.account_code} - {acc.account_name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <Button type="submit" disabled={isSubmitting || !saleData.item_id} className="w-full bg-slate-900 text-white hover:bg-slate-800 text-base py-6">
                            {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : "Process Transaction"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}