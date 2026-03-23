// src/app/dashboard/settings/page.jsx
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Trash2, History, ShieldCheck, ShieldAlert, AlertTriangle } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";

export default function SettingsPage() {
    const { isAdmin, isLoadingRole } = useUserRole();
    const [companyId, setCompanyId] = useState(null);
    const [accounts, setAccounts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const [logs, setLogs] = useState([]);

    const [newAccount, setNewAccount] = useState({
        account_code: "",
        account_name: "",
        category: "Asset"
    });

    const fetchData = async () => {
        setIsLoading(true);
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
                    .select('*')
                    .eq('company_id', currentCompanyId)
                    .order('account_code', { ascending: true });

                if (accountsError) throw accountsError;
                setAccounts(accountsData || []);

                fetchLogs();
            }
        } catch (error) {
            console.error("Data Fetch Error:", error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchLogs = async () => {
        const { data, error } = await supabase
            .from('audit_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10);

        if (!error) setLogs(data);
    };

    useEffect(() => {
        if (isAdmin) {
            fetchData();
        }
    }, [isAdmin]);

    const handleAddAccount = async (e) => {
        e.preventDefault();
        if (!companyId) return;
        setIsSubmitting(true);

        try {
            const normalBalance = (newAccount.category === "Asset" || newAccount.category === "Expense")
                ? "Debit" : "Credit";

            const { error } = await supabase
                .from('chart_of_accounts')
                .insert([{
                    company_id: companyId,
                    account_code: newAccount.account_code,
                    account_name: newAccount.account_name,
                    category: newAccount.category,
                    normal_balance: normalBalance
                }]);

            if (error) throw error;
            setNewAccount({ account_code: "", account_name: "", category: "Asset" });
            fetchData();
        } catch (error) {
            alert(error.code === '23505' ? "Error: Code already exists." : error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (accountId) => {
        if (!confirm("Are you sure? This action will be recorded in the audit log.")) return;
        try {
            const { error } = await supabase.from('chart_of_accounts').delete().eq('id', accountId);
            if (error) {
                if (error.code === '23503') alert("Cannot delete: This account is being used in existing transactions.");
                else throw error;
            } else {
                fetchData();
            }
        } catch (error) {
            alert("Error deleting account: " + error.message);
        }
    };

    // THE FACTORY RESET HANDLER
    const handleFactoryReset = async () => {
        const confirmText = prompt("WARNING: This will permanently delete ALL transactions, inventory, accounts, and history. Type 'RESET' to confirm:");

        if (confirmText !== "RESET") {
            alert("Factory reset cancelled.");
            return;
        }

        setIsResetting(true);
        try {
            const { error } = await supabase.rpc('factory_reset_company', {
                p_company_id: companyId
            });

            if (error) throw error;

            alert("System successfully wiped. You now have a blank slate.");
            fetchData(); // Refresh the page data (it will now be empty)

        } catch (error) {
            alert("Reset Failed: " + error.message);
        } finally {
            setIsResetting(false);
        }
    };

    // SECURITY BOUNCER
    if (isLoadingRole) return <div className="p-8 font-medium text-slate-500 animate-pulse">Checking security clearance...</div>;

    if (!isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
                <ShieldAlert className="h-16 w-16 text-red-500" />
                <h2 className="text-2xl font-bold text-slate-900">Access Denied</h2>
                <p className="text-slate-500 max-w-md">You must be a System Administrator to view or alter Chart of Account settings.</p>
            </div>
        );
    }

    const selectStyles = "flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

    return (
        <div className="space-y-8 max-w-4xl pb-12">
            <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">Workspace Settings</h2>
                <p className="text-slate-500">Manage your Chart of Accounts and track system changes.</p>
            </div>

            <Card className="shadow-sm border-slate-200">
                <CardHeader>
                    <CardTitle className="text-lg text-slate-900">Add New Account</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleAddAccount} className="flex gap-4 items-end">
                        <div className="space-y-2 flex-1">
                            <Label>Code</Label>
                            <Input name="account_code" value={newAccount.account_code} onChange={(e) => setNewAccount({ ...newAccount, account_code: e.target.value })} required />
                        </div>
                        <div className="space-y-2 flex-2">
                            <Label>Account Name</Label>
                            <Input name="account_name" value={newAccount.account_name} onChange={(e) => setNewAccount({ ...newAccount, account_name: e.target.value })} required />
                        </div>
                        <div className="space-y-2 flex-[1.5]">
                            <Label>Category</Label>
                            <select name="category" value={newAccount.category} onChange={(e) => setNewAccount({ ...newAccount, category: e.target.value })} className={selectStyles}>
                                <option value="Asset">Asset</option>
                                <option value="Liability">Liability</option>
                                <option value="Equity">Equity</option>
                                <option value="Revenue">Revenue</option>
                                <option value="Expense">Expense</option>
                            </select>
                        </div>
                        <Button type="submit" disabled={isSubmitting} className="bg-slate-900 text-white hover:bg-slate-800">Add Account</Button>
                    </form>
                </CardContent>
            </Card>

            <Card className="shadow-sm border-slate-200">
                <CardHeader><CardTitle className="text-lg text-slate-900">Active Accounts</CardTitle></CardHeader>
                <CardContent>
                    <div className="border rounded-md overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 border-b text-slate-700">
                                <tr>
                                    <th className="px-4 py-3">Code</th>
                                    <th className="px-4 py-3">Name</th>
                                    <th className="px-4 py-3">Category</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {accounts.length === 0 ? (
                                    <tr><td colSpan="4" className="px-4 py-6 text-center text-slate-400 italic">No accounts found.</td></tr>
                                ) : (
                                    accounts.map((acc) => (
                                        <tr key={acc.id} className="hover:bg-slate-50/50">
                                            <td className="px-4 py-3 font-medium">{acc.account_code}</td>
                                            <td className="px-4 py-3">{acc.account_name}</td>
                                            <td className="px-4 py-3 text-xs uppercase tracking-wider text-slate-500">{acc.category}</td>
                                            <td className="px-4 py-3 text-right">
                                                <button onClick={() => handleDelete(acc.id)} className="text-slate-400 hover:text-red-600 transition-colors">
                                                    <Trash2 size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            <Card className="shadow-sm border-slate-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <div className="space-y-1">
                        <CardTitle className="text-lg text-slate-900 flex items-center gap-2">
                            <History className="h-5 w-5 text-slate-400" /> System Activity Audit
                        </CardTitle>
                        <CardDescription>A permanent, tamper-proof record of ledger changes.</CardDescription>
                    </div>
                    <ShieldCheck className="h-8 w-8 text-emerald-500/20" />
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {logs.length === 0 ? (
                            <p className="text-sm text-slate-400 italic text-center py-4">No activity recorded yet.</p>
                        ) : (
                            logs.map((log) => (
                                <div key={log.id} className="flex items-center justify-between text-sm border-b border-slate-50 pb-3 last:border-0">
                                    <div className="flex items-center gap-3">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${log.action_type === 'INSERT' ? 'bg-emerald-100 text-emerald-700' :
                                                log.action_type === 'DELETE' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                                            }`}>
                                            {log.action_type}
                                        </span>
                                        <span className="text-slate-700">Modified <span className="font-mono font-medium">{log.table_name}</span></span>
                                    </div>
                                    <div className="text-slate-400 text-xs">{new Date(log.created_at).toLocaleString()}</div>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* DANGER ZONE - FACTORY RESET */}
            <Card className="shadow-sm border-red-200 bg-red-50/50 mt-12">
                <CardHeader>
                    <CardTitle className="text-lg text-red-900 flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-red-600" /> Danger Zone
                    </CardTitle>
                    <CardDescription className="text-red-700">
                        Permanently delete all transactions, inventory, accounts, and audit logs. This cannot be undone.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button
                        onClick={handleFactoryReset}
                        disabled={isResetting}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold"
                    >
                        {isResetting ? "Wiping Database..." : "Factory Reset System"}
                    </Button>
                </CardContent>
            </Card>

        </div>
    );
}