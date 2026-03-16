// src/components/accounting/IncomeStatementTable.jsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function IncomeStatementTable() {
  const [reportData, setReportData] = useState({ revenues: [], expenses: [], netIncome: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchIncomeStatement() {
      try {
        // Fetch all transaction lines and join with the chart of accounts
        const { data, error } = await supabase
          .from('transaction_lines')
          .select(`
            debit_amount,
            credit_amount,
            chart_of_accounts!inner(account_name, category)
          `)
          .in('chart_of_accounts.category', ['Revenue', 'Expense']);

        if (error) throw error;

        // Process the data into aggregations
        const revenueTotals = {};
        const expenseTotals = {};

        data.forEach(line => {
          const accountName = line.chart_of_accounts.account_name;
          const category = line.chart_of_accounts.category;
          
          // Convert Decimal strings from DB to JS Floats
          const debit = parseFloat(line.debit_amount) || 0;
          const credit = parseFloat(line.credit_amount) || 0;

          if (category === 'Revenue') {
            // Revenue increases with Credits, decreases with Debits
            const netAmount = credit - debit;
            revenueTotals[accountName] = (revenueTotals[accountName] || 0) + netAmount;
          } else if (category === 'Expense') {
            // Expenses increase with Debits, decrease with Credits
            const netAmount = debit - credit;
            expenseTotals[accountName] = (expenseTotals[accountName] || 0) + netAmount;
          }
        });

        // Format for the UI
        const revenues = Object.keys(revenueTotals).map(name => ({ name, amount: revenueTotals[name] }));
        const expenses = Object.keys(expenseTotals).map(name => ({ name, amount: expenseTotals[name] }));

        const totalRevenue = revenues.reduce((sum, item) => sum + item.amount, 0);
        const totalExpense = expenses.reduce((sum, item) => sum + item.amount, 0);
        const netIncome = totalRevenue - totalExpense;

        setReportData({ revenues, expenses, totalRevenue, totalExpense, netIncome });
      } catch (error) {
        console.error("Failed to fetch income statement:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchIncomeStatement();
  }, []);

  if (isLoading) return <div className="p-8 text-slate-500 animate-pulse">Calculating financials...</div>;

  return (
    <Card className="w-full max-w-4xl shadow-sm border-slate-200">
      <CardHeader>
        <CardTitle className="text-2xl text-slate-900">Income Statement</CardTitle>
        <CardDescription>Consolidated statement of profit and loss for the current period.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              <TableHead className="w-[60%] font-semibold text-slate-900">Account</TableHead>
              <TableHead className="text-right font-semibold text-slate-900">Amount (Rs)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Revenue Section */}
            <TableRow className="bg-slate-50/50 hover:bg-transparent border-b-0">
              <TableCell colSpan={2} className="font-semibold text-slate-700 pt-6">Revenue</TableCell>
            </TableRow>
            {reportData.revenues.map((item) => (
              <TableRow key={item.name}>
                <TableCell className="pl-8 text-slate-600">{item.name}</TableCell>
                <TableCell className="text-right tabular-nums text-slate-700">{item.amount.toFixed(2)}</TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell className="font-medium text-slate-900 pl-8">Total Revenue</TableCell>
              <TableCell className="text-right font-medium tabular-nums text-slate-900 border-t border-slate-200">{reportData.totalRevenue?.toFixed(2) || "0.00"}</TableCell>
            </TableRow>

            {/* Expense Section */}
            <TableRow className="bg-slate-50/50 hover:bg-transparent border-b-0">
              <TableCell colSpan={2} className="font-semibold text-slate-700 pt-8">Operating Expenses</TableCell>
            </TableRow>
            {reportData.expenses.map((item) => (
              <TableRow key={item.name}>
                <TableCell className="pl-8 text-slate-600">{item.name}</TableCell>
                <TableCell className="text-right tabular-nums text-slate-700">{item.amount.toFixed(2)}</TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell className="font-medium text-slate-900 pl-8">Total Expenses</TableCell>
              <TableCell className="text-right font-medium tabular-nums text-slate-900 border-t border-slate-200">{reportData.totalExpense?.toFixed(2) || "0.00"}</TableCell>
            </TableRow>

            {/* Net Income */}
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              <TableCell className="font-bold text-slate-900 text-lg pt-6">Net Income</TableCell>
              <TableCell className={`text-right font-bold tabular-nums text-lg pt-6 ${reportData.netIncome < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                Rs {reportData.netIncome?.toFixed(2) || "0.00"}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}