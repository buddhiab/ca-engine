// src/app/dashboard/inventory/page.jsx
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Package, Plus, Loader2 } from "lucide-react";

export default function InventoryDashboard() {
    const [companyId, setCompanyId] = useState(null);
    const [inventory, setInventory] = useState([]);
    const [accounts, setAccounts] = useState({ assets: [], revenues: [], expenses: [] });
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [newItem, setNewItem] = useState({
        sku: "",
        name: "",
        description: "",
        quantity_on_hand: 0,
        purchase_price: 0.00,
        selling_price: 0.00,
        asset_account_id: "",
        income_account_id: "",
        cogs_account_id: ""
    });

    const fetchData = async () => {
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
            const currentCompanyId = workspaceData[0].company_id;
            setCompanyId(currentCompanyId);

            // Fetch Chart of Accounts to populate the accounting links
            const { data: accountsData } = await supabase
                .from('chart_of_accounts')
                .select('id, account_code, account_name, category')
                .eq('company_id', currentCompanyId)
                .order('account_code', { ascending: true });

            if (accountsData) {
                setAccounts({
                    assets: accountsData.filter(a => a.category === 'Asset'),
                    revenues: accountsData.filter(a => a.category === 'Revenue'),
                    expenses: accountsData.filter(a => a.category === 'Expense')
                });
            }

            // Fetch current inventory
            const { data: inventoryData } = await supabase
                .from('inventory_items')
                .select('*')
                .eq('company_id', currentCompanyId)
                .order('created_at', { ascending: false });

            if (inventoryData) setInventory(inventoryData);

        } catch (error) {
            console.error("Data Fetch Error:", error.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleChange = (e) => {
        setNewItem({ ...newItem, [e.target.name]: e.target.value });
    };

    const handleAddItem = async (e) => {
        e.preventDefault();
        if (!companyId) return;
        setIsSubmitting(true);

        try {
            const { error } = await supabase
                .from('inventory_items')
                .insert([{
                    company_id: companyId,
                    sku: newItem.sku.toUpperCase(),
                    name: newItem.name,
                    description: newItem.description,
                    quantity_on_hand: parseInt(newItem.quantity_on_hand),
                    purchase_price: parseFloat(newItem.purchase_price),
                    selling_price: parseFloat(newItem.selling_price),
                    asset_account_id: newItem.asset_account_id,
                    income_account_id: newItem.income_account_id,
                    cogs_account_id: newItem.cogs_account_id
                }]);

            if (error) throw error;

            setNewItem({
                sku: "", name: "", description: "", quantity_on_hand: 0,
                purchase_price: 0, selling_price: 0, asset_account_id: "",
                income_account_id: "", cogs_account_id: ""
            });
            fetchData();
            alert("Product successfully added to inventory catalog.");

        } catch (error) {
            alert("Error adding product: " + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' }).format(amount).replace('LKR', 'Rs');
    };

    const selectStyles = "flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 disabled:opacity-50";

    return (
        <div className="space-y-8 max-w-6xl">
            <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">Inventory Management</h2>
                <p className="text-slate-500">Manage your product catalog and accounting linkages.</p>
            </div>

            {/* ADD PRODUCT FORM */}
            <Card className="shadow-sm border-slate-200">
                <CardHeader>
                    <CardTitle className="text-lg text-slate-900 flex items-center gap-2">
                        <Plus className="h-5 w-5" /> Add New Product
                    </CardTitle>
                    <CardDescription>Define physical products and map them to your general ledger.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleAddItem} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>SKU (Stock Keeping Unit)</Label>
                                <Input name="sku" placeholder="e.g., EAR-BUD-01" value={newItem.sku} onChange={handleChange} required />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label>Product Name</Label>
                                <Input name="name" placeholder="e.g., Wireless Noise-Cancelling Earbuds" value={newItem.name} onChange={handleChange} required />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>Initial Stock Qty</Label>
                                <Input type="number" name="quantity_on_hand" min="0" value={newItem.quantity_on_hand} onChange={handleChange} required />
                            </div>
                            <div className="space-y-2">
                                <Label>Cost Price (Rs)</Label>
                                <Input type="number" step="0.01" min="0" name="purchase_price" value={newItem.purchase_price} onChange={handleChange} required />
                            </div>
                            <div className="space-y-2">
                                <Label>Selling Price (Rs)</Label>
                                <Input type="number" step="0.01" min="0" name="selling_price" value={newItem.selling_price} onChange={handleChange} required />
                            </div>
                        </div>

                        {/* ACCOUNTING LINK MAPPING */}
                        <div className="p-4 bg-slate-50 border border-slate-100 rounded-md space-y-4">
                            <h3 className="text-sm font-semibold text-slate-700 border-b border-slate-200 pb-2">Financial Ledger Mapping</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs">Inventory Asset Account</Label>
                                    <select name="asset_account_id" value={newItem.asset_account_id} onChange={handleChange} required className={selectStyles}>
                                        <option value="" disabled>Select Asset Account...</option>
                                        {accounts.assets.map(a => <option key={a.id} value={a.id}>{a.account_code} - {a.account_name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs">Sales Revenue Account</Label>
                                    <select name="income_account_id" value={newItem.income_account_id} onChange={handleChange} required className={selectStyles}>
                                        <option value="" disabled>Select Revenue Account...</option>
                                        {accounts.revenues.map(a => <option key={a.id} value={a.id}>{a.account_code} - {a.account_name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs">COGS (Expense) Account</Label>
                                    <select name="cogs_account_id" value={newItem.cogs_account_id} onChange={handleChange} required className={selectStyles}>
                                        <option value="" disabled>Select COGS Account...</option>
                                        {accounts.expenses.map(a => <option key={a.id} value={a.id}>{a.account_code} - {a.account_name}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <Button type="submit" disabled={isSubmitting || isLoading} className="bg-slate-900 hover:bg-slate-800 text-white w-full md:w-auto">
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Package className="h-4 w-4 mr-2" />}
                            Save Product to Catalog
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* ACTIVE INVENTORY TABLE */}
            <Card className="shadow-sm border-slate-200">
                <CardHeader>
                    <CardTitle className="text-lg text-slate-900">Current Stock Levels</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 border-y border-slate-200 text-slate-700">
                                <tr>
                                    <th className="px-6 py-3 font-medium">SKU</th>
                                    <th className="px-6 py-3 font-medium">Product Name</th>
                                    <th className="px-6 py-3 font-medium text-center">Stock</th>
                                    <th className="px-6 py-3 font-medium text-right">Unit Cost</th>
                                    <th className="px-6 py-3 font-medium text-right">Retail Price</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {isLoading ? (
                                    <tr><td colSpan="5" className="px-6 py-8 text-center text-slate-400">Loading catalog...</td></tr>
                                ) : inventory.length === 0 ? (
                                    <tr><td colSpan="5" className="px-6 py-8 text-center text-slate-400">No products found. Add your first item above.</td></tr>
                                ) : (
                                    inventory.map((item) => (
                                        <tr key={item.id} className="hover:bg-slate-50/50">
                                            <td className="px-6 py-3 font-mono text-xs font-bold text-slate-600">{item.sku}</td>
                                            <td className="px-6 py-3 text-slate-900 font-medium">{item.name}</td>
                                            <td className="px-6 py-3 text-center">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${item.quantity_on_hand <= 5 ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-800'}`}>
                                                    {item.quantity_on_hand}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3 text-right text-slate-600">{formatCurrency(item.purchase_price)}</td>
                                            <td className="px-6 py-3 text-right font-medium text-slate-900">{formatCurrency(item.selling_price)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}