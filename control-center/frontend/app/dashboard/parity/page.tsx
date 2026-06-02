'use client';

import { useParityReport } from '@/lib/runtime-hooks';
import StatCard from '@/components/StatCard';
import {
    FileCheck, AlertTriangle, CheckCircle2,
    XCircle, RefreshCw, Loader2, ShieldCheck,
} from 'lucide-react';

export default function ParityReportPage() {
    const { report, loading, error, runAudit } = useParityReport();

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Parity Audit</h1>
                    <p className="text-sm text-gray-500">
                        Validacion de integridad: Deployments ↔ SDK ABIs ↔ contracts.js ↔ Plugins
                    </p>
                </div>
                <button
                    onClick={runAudit}
                    disabled={loading}
                    className="flex items-center gap-2 rounded-lg bg-bezhas-accent text-white px-4 py-2.5 text-sm font-medium hover:bg-bezhas-accent/90 disabled:opacity-50 transition-colors"
                >
                    {loading ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Auditing...</>
                    ) : (
                        <><RefreshCw className="w-4 h-4" /> Run Audit</>
                    )}
                </button>
            </div>

            {/* Error */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> {error}
                </div>
            )}

            {/* No report yet */}
            {!report && !loading && !error && (
                <div className="bg-white rounded-xl border border-gray-100 p-12 text-center shadow-sm">
                    <ShieldCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">Click &ldquo;Run Audit&rdquo; to verify deployment parity</p>
                </div>
            )}

            {/* Report */}
            {report && (
                <>
                    {/* Summary stat cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard
                            label="Total Checks"
                            value={report.summary.total}
                            icon={<FileCheck className="w-5 h-5" />}
                        />
                        <StatCard
                            label="Passed"
                            value={report.summary.pass}
                            sub={`${report.summary.total ? Math.round((report.summary.pass / report.summary.total) * 100) : 0}%`}
                            icon={<CheckCircle2 className="w-5 h-5" />}
                        />
                        <StatCard
                            label="Warnings"
                            value={report.summary.warn}
                            icon={<AlertTriangle className="w-5 h-5" />}
                        />
                        <StatCard
                            label="Failures"
                            value={report.summary.fail}
                            icon={<XCircle className="w-5 h-5" />}
                        />
                    </div>

                    {/* Overall status badge */}
                    <div className={`p-4 rounded-xl border text-center font-medium ${report.passed
                        ? 'bg-green-50 border-green-200 text-green-700'
                        : 'bg-red-50 border-red-200 text-red-700'
                        }`}>
                        {report.passed ? '✓ Parity Check PASSED' : '✗ Parity Check FAILED — inconsistencies detected'}
                    </div>

                    {/* Checks table */}
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 text-left text-gray-500">
                                    <th className="px-5 py-3 font-medium">Status</th>
                                    <th className="px-5 py-3 font-medium">Category</th>
                                    <th className="px-5 py-3 font-medium">Check</th>
                                    <th className="px-5 py-3 font-medium">Message</th>
                                </tr>
                            </thead>
                            <tbody>
                                {report.checks.map((check, i) => (
                                    <tr key={i} className="border-t border-gray-50 hover:bg-gray-50/50">
                                        <td className="px-5 py-3">
                                            <StatusBadge status={check.status} />
                                        </td>
                                        <td className="px-5 py-3 text-gray-600 font-mono text-xs">{check.category}</td>
                                        <td className="px-5 py-3 text-gray-800 font-medium">{check.name}</td>
                                        <td className="px-5 py-3 text-gray-500 max-w-md truncate">{check.message}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Timestamp */}
                    <p className="text-xs text-gray-400 text-right">
                        Last audit: {new Date(report.timestamp).toLocaleString()}
                    </p>
                </>
            )}
        </div>
    );
}

function StatusBadge({ status }: { status: 'pass' | 'warn' | 'fail' }) {
    const styles = {
        pass: 'bg-green-100 text-green-700',
        warn: 'bg-yellow-100 text-yellow-700',
        fail: 'bg-red-100 text-red-700',
    };
    const icons = {
        pass: <CheckCircle2 className="w-3.5 h-3.5" />,
        warn: <AlertTriangle className="w-3.5 h-3.5" />,
        fail: <XCircle className="w-3.5 h-3.5" />,
    };
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${styles[status]}`}>
            {icons[status]} {status.toUpperCase()}
        </span>
    );
}
