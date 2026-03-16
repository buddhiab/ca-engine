// src/app/dashboard/page.jsx
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { DollarSign, TrendingUp, CreditCard, Activity, ShieldCheck } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

export default function DashboardOverview() {
  const [metrics, setMetrics] = useState({
    revenue: 0,
    expenses: 0,
    netIncome: 0,
    assets: 0
  });
  const [chartData, setChartData] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        // 1. Authenticate & Get Workspace
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: workspaceData } = await supabase
          .from('company_users')
          .select('company_id')
          .eq('user_id', user.id)
          .limit(1);

        if (!workspaceData || workspaceData.length === 0) return;
        const companyId = workspaceData[0].company_id;

        // 2. Fetch Ledger Transactions for KPIs and Chart
        const { data: transactions } = await supabase
          .from('transaction_lines')
          .select(`
                        debit_amount,
                        credit_amount,
                        chart_of_accounts!inner(category),
                        journal_entries!inner(entry_date, status)
                    `)
          .eq('company_id', companyId)
          .eq('journal_entries.status', 'Posted');

        let tRev = 0, tExp = 0, tAst = 0;
        const monthlyAgg = {};

        if (transactions) {
          transactions.forEach(tx => {
            const category = tx.chart_of_accounts.category;
            const debit = Number(tx.debit_amount);
            const credit = Number(tx.credit_amount);
            const date = new Date(tx.journal_entries.entry_date);

            // Format as "Mon YYYY" (e.g., "Mar 2026")
            const monthKey = date.toLocaleString('en-US', { month: 'short', year: 'numeric' });

            if (!monthlyAgg[monthKey]) {
              monthlyAgg[monthKey] = { name: monthKey, Income: 0, Expense: 0 };
            }

            if (category === 'Revenue') {
              const amount = credit - debit;
              tRev += amount;
              monthlyAgg[monthKey].Income += amount;
            } else if (category === 'Expense') {
              const amount = debit - credit;
              tExp += amount;
              monthlyAgg[monthKey].Expense += amount;
            } else if (category === 'Asset') {
              tAst += (debit - credit);
            }
          });
        }

        // Convert monthly object to array and sort chronologically (basic sort)
        const chartArray = Object.values(monthlyAgg).sort((a, b) => new Date(a.name) - new Date(b.name));

        setMetrics({
          revenue: tRev,
          expenses: tExp,
          netIncome: tRev - tExp,
          assets: tAst
        });
        setChartData(chartArray);

        // 3. Fetch Recent Audit Logs
        const { data: logs } = await supabase
          .from('audit_logs')
          .select('*')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false })
          .limit(5);

        if (logs) setRecentLogs(logs);

      } catch (error) {
        console.error("Dashboard Error:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', maximumFractionDigits: 0 }).format(amount).replace('LKR', 'Rs');
  };

  if (isLoading) {
    return <div className="p-8 text-slate-500 animate-pulse font-medium">Loading command center...</div>;
  }

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard Overview</h2>
        <p className="text-slate-500">Your company's financial health at a glance.</p>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{formatCurrency(metrics.revenue)}</div>
            <p className="text-xs text-slate-500 mt-1">Year to Date</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total Expenses</CardTitle>
            <CreditCard className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{formatCurrency(metrics.expenses)}</div>
            <p className="text-xs text-slate-500 mt-1">Year to Date</p>
          </CardContent>
        </Card>

        <Card className={`shadow-sm border-slate-200 ${metrics.netIncome >= 0 ? 'bg-emerald-50/50' : 'bg-red-50/50'}`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className={`text-sm font-medium ${metrics.netIncome >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>Net Income</CardTitle>
            <Activity className={`h-4 w-4 ${metrics.netIncome >= 0 ? 'text-emerald-500' : 'text-red-500'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${metrics.netIncome >= 0 ? 'text-emerald-900' : 'text-red-900'}`}>
              {formatCurrency(metrics.netIncome)}
            </div>
            <p className={`text-xs mt-1 ${metrics.netIncome >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {metrics.netIncome >= 0 ? "Profitable" : "Operating at a Loss"}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total Assets</CardTitle>
            <DollarSign className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{formatCurrency(metrics.assets)}</div>
            <p className="text-xs text-slate-500 mt-1">Current Balance</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* CHART SECTION */}
        <Card className="shadow-sm border-slate-200 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg text-slate-900">Cash Flow Trends</CardTitle>
            <CardDescription>Income vs Expenses over time</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-slate-400 text-sm italic">
                Post a journal entry to generate chart data.
              </div>
            ) : (
              <div className="h-[300px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => `Rs ${val}`} />
                    <Tooltip
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />
                    <Bar dataKey="Income" fill="#0f172a" radius={[4, 4, 0, 0]} maxBarSize={50} />
                    <Bar dataKey="Expense" fill="#94a3b8" radius={[4, 4, 0, 0]} maxBarSize={50} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* RECENT ACTIVITY SECTION */}
        <Card className="shadow-sm border-slate-200 lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg text-slate-900 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-slate-400" />
              Recent Activity
            </CardTitle>
            <CardDescription>Latest system changes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              {recentLogs.length === 0 ? (
                <p className="text-sm text-slate-400 italic text-center py-4">No recent activity.</p>
              ) : (
                recentLogs.map((log) => (
                  <div key={log.id} className="flex gap-3">
                    <div className={`mt-0.5 w-2 h-2 rounded-full ${log.action_type === 'INSERT' ? 'bg-emerald-500' :
                        log.action_type === 'DELETE' ? 'bg-red-500' : 'bg-blue-500'
                      }`} />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-slate-900 leading-none">
                        {log.action_type === 'INSERT' ? 'Created new' : log.action_type === 'DELETE' ? 'Deleted' : 'Updated'} record
                      </p>
                      <p className="text-xs text-slate-500">
                        in <span className="font-mono">{log.table_name.replace('_', ' ')}</span>
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {new Date(log.created_at).toLocaleString()}
                      </p>
                    </div>
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