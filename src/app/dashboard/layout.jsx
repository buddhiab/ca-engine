// src/app/dashboard/layout.jsx
"use client";

import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import { useUserRole } from "@/hooks/useUserRole";
import { Loader2 } from "lucide-react";

export default function DashboardLayout({ children }) {
  const { role, isLoadingRole, isAdmin, isDataEntry, isAuditor } = useUserRole();

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">

        {/* Header */}
        <div className="p-6 border-b border-slate-200">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">CA Engine</h1>
          <p className="text-xs text-slate-500 mt-1 uppercase font-bold tracking-wider">
            {isLoadingRole ? "Loading..." : `${role} Portal`}
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {isLoadingRole ? (
            <div className="flex justify-center p-4"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
          ) : (
            <>
              {/* EVERYONE sees Overview */}
              <Link href="/dashboard" className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-md font-medium">
                Overview
              </Link>

              {/* ADMIN & DATA ENTRY ONLY (Operational Tools) */}
              {(isAdmin || isDataEntry) && (
                <>
                  <div className="pt-4 pb-2 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Operations</div>
                  <Link href="/dashboard/data-entry" className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-md font-medium">
                    Journal Entry
                  </Link>
                  <Link href="/dashboard/record-sale" className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-md font-medium">
                    Record Sale
                  </Link>
                  <Link href="/dashboard/inventory" className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-md font-medium">
                    Inventory
                  </Link>
                </>
              )}

              {/* ADMIN & AUDITOR ONLY (Financial Reports) */}
              {(isAdmin || isAuditor) && (
                <>
                  <div className="pt-4 pb-2 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Reports & Audit</div>
                  <Link href="/dashboard/income-statement" className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-md font-medium">
                    Income Statement
                  </Link>
                  <Link href="/dashboard/balance-sheet" className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-md font-medium">
                    Balance Sheet
                  </Link>
                  <Link href="/dashboard/trial-balance" className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-md font-medium">
                    Trial Balance
                  </Link>
                  <Link href="/dashboard/forecasting" className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-md font-medium">
                    Forecasting
                  </Link>
                  <Link href="/dashboard/reconciliation" className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-md font-medium">
                    Bank Reconciliation
                  </Link>
                </>
              )}

              {/* ADMIN ONLY (System Settings) */}
              {isAdmin && (
                <>
                  <div className="pt-4 pb-2 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">System</div>
                  <Link href="/dashboard/settings" className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-md font-medium">
                    Settings
                  </Link>
                </>
              )}
            </>
          )}
        </nav>

        {/* Footer / Logout Area */}
        <div className="p-4 border-t border-slate-200 mt-auto bg-slate-50/50">
          <LogoutButton />
        </div>

      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-5xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}