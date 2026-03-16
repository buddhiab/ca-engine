// src/app/dashboard/data-entry/page.jsx
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, Calendar as CalendarIcon, FileText, ExternalLink, Download, Loader2 } from "lucide-react";
import JournalEntryForm from "@/components/accounting/JournalEntryForm";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable"; // Import the function directly

export default function JournalEntryPage() {
    const [entries, setEntries] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterDate, setFilterDate] = useState("");
    const [isLoading, setIsLoading] = useState(true);

    const fetchEntries = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('journal_entries')
                .select(`
                    id, entry_date, description, status, receipt_url,
                    transaction_lines (
                        debit_amount, credit_amount,
                        chart_of_accounts (account_name)
                    )
                `)
                .order('entry_date', { ascending: false });

            if (error) throw error;
            setEntries(data || []);
        } catch (error) {
            console.error("Fetch Error:", error.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchEntries(); }, []);

    const filteredEntries = entries.filter(entry => {
        const matchesSearch = entry.description.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesDate = filterDate ? entry.entry_date === filterDate : true;
        return matchesSearch && matchesDate;
    });

    const handleViewReceipt = async (path) => {
        const { data, error } = await supabase.storage.from('receipts').createSignedUrl(path, 60);
        if (!error) window.open(data.signedUrl, '_blank');
    };

    // FIX: Manual Registration of autoTable
    const exportToPDF = () => {
        const doc = new jsPDF();
        
        // Manual registration logic to prevent "autoTable is not a function"
        if (typeof doc.autoTable !== 'function') {
            autoTable(doc);
        }

        doc.setFontSize(20);
        doc.text("Transaction Audit Report", 14, 20);
        
        const tableRows = filteredEntries.map(entry => [
            new Date(entry.entry_date).toLocaleDateString(),
            entry.description,
            `Rs ${entry.transaction_lines.reduce((acc, curr) => acc + Number(curr.debit_amount), 0).toFixed(2)}`
        ]);

        doc.autoTable({
            startY: 30,
            head: [['Date', 'Description', 'Total Amount']],
            body: tableRows,
            theme: 'grid',
            headStyles: { fillColor: [15, 23, 42] }
        });

        doc.save(`Transactions_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    return (
        <div className="space-y-10">
            <section>
                <JournalEntryForm onEntryPosted={fetchEntries} />
            </section>

            <section className="space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h3 className="text-xl font-bold text-slate-900">Recent Transactions</h3>
                    </div>

                    <div className="flex gap-2 w-full md:w-auto">
                        <Button onClick={exportToPDF} variant="outline" className="flex items-center gap-2">
                            <Download className="h-4 w-4" /> Export PDF
                        </Button>
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                            <Input placeholder="Search..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        </div>
                    </div>
                </div>

                <Card className="shadow-sm border-slate-200">
                    <CardContent className="p-0">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 border-b text-slate-700">
                                <tr>
                                    <th className="px-6 py-3">Date</th>
                                    <th className="px-6 py-3">Description</th>
                                    <th className="px-6 py-3">Receipt</th>
                                    <th className="px-6 py-3 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredEntries.map((entry) => (
                                    <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4">{new Date(entry.entry_date).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 font-medium">{entry.description}</td>
                                        <td className="px-6 py-4">
                                            {entry.receipt_url && (
                                                <button onClick={() => handleViewReceipt(entry.receipt_url)} className="text-blue-600 flex items-center gap-1">
                                                    <FileText className="h-3 w-3" /> View
                                                </button>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right font-semibold">
                                            Rs {entry.transaction_lines.reduce((acc, curr) => acc + Number(curr.debit_amount), 0).toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>
            </section>
        </div>
    );
}