// src/app/page.jsx
import Link from "next/link";
import { ArrowRight, BarChart3, ShieldCheck, Zap, RefreshCcw, TrendingUp, Layers } from "lucide-react";

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-emerald-100 selection:text-emerald-900">

            {/* NAVIGATION BAR */}
            <nav className="border-b border-slate-200 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Layers className="h-6 w-6 text-slate-900" />
                        <span className="text-xl font-bold tracking-tight">CA Engine</span>
                    </div>
                    <div>
                        <Link
                            href="/dashboard"
                            className="text-sm font-semibold bg-slate-900 text-white px-5 py-2.5 rounded-full hover:bg-slate-800 transition-colors"
                        >
                            Enter Dashboard
                        </Link>
                    </div>
                </div>
            </nav>

            {/* HERO SECTION */}
            <main>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 text-center lg:pt-32">
                    <h1 className="mx-auto max-w-4xl font-display text-5xl font-extrabold tracking-tight text-slate-900 sm:text-7xl">
                        The Next-Generation ERP for <span className="text-emerald-600">Chartered Accountants.</span>
                    </h1>
                    <p className="mx-auto mt-6 max-w-2xl text-lg tracking-tight text-slate-600">
                        Move beyond manual spreadsheets. CA Engine automates double-entry ledgers, instantly reconciles bank statements, and predicts 6-month cash flow runways in real-time.
                    </p>
                    <div className="mt-10 flex justify-center gap-4">
                        <Link
                            href="/dashboard"
                            className="flex items-center gap-2 text-base font-semibold bg-slate-900 text-white px-8 py-4 rounded-full hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                        >
                            Launch Platform <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                </div>

                {/* FEATURES GRID */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">

                        <FeatureCard
                            icon={<Zap className="h-6 w-6 text-emerald-600" />}
                            title="Automated COGS Engine"
                            description="Record a sale and let the engine automatically calculate Cost of Goods Sold, reduce inventory assets, and balance the ledger."
                        />

                        <FeatureCard
                            icon={<RefreshCcw className="h-6 w-6 text-emerald-600" />}
                            title="Algorithmic Reconciliation"
                            description="Upload standard bank CSVs. Our matching algorithm automatically pairs real-world bank data with digital ledger entries."
                        />

                        <FeatureCard
                            icon={<TrendingUp className="h-6 w-6 text-emerald-600" />}
                            title="Predictive Forecasting"
                            description="Model business scenarios interactively. The system calculates future cash flow baselines using historical transaction data."
                        />

                        <FeatureCard
                            icon={<ShieldCheck className="h-6 w-6 text-emerald-600" />}
                            title="Role-Based Security"
                            description="Strict separation of duties. Admins, Data Entry clerks, and Auditors have mathematically enforced access restrictions."
                        />

                        <FeatureCard
                            icon={<BarChart3 className="h-6 w-6 text-emerald-600" />}
                            title="Dynamic PDF Reporting"
                            description="Export mathematically verified Income Statements, Balance Sheets, and Trial Balances directly to timestamped PDFs."
                        />

                        <FeatureCard
                            icon={<Layers className="h-6 w-6 text-emerald-600" />}
                            title="Immutable Audit Trails"
                            description="A background SQL trigger records every INSERT, UPDATE, or DELETE, ensuring total corporate governance and compliance."
                        />

                    </div>
                </div>
            </main>

            {/* FOOTER */}
            <footer className="border-t border-slate-200 bg-white py-10 mt-12">
                <div className="max-w-7xl mx-auto px-4 text-center text-sm text-slate-500">
                    <p>Built for enterprise-grade financial integrity.</p>
                </div>
            </footer>
        </div>
    );
}

// Helper component for the feature grid
function FeatureCard({ icon, title, description }) {
    return (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mb-6 border border-emerald-100">
                {icon}
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
            <p className="text-slate-600 leading-relaxed">{description}</p>
        </div>
    );
}