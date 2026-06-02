export default function StatCard({ label, value, sub, icon }: {
    label: string; value: string | number; sub?: string; icon?: React.ReactNode;
}) {
    return (
        <div className="bg-white rounded-xl border border-gray-100 p-5 flex items-start gap-4 shadow-sm">
            {icon && (
                <div className="w-10 h-10 rounded-lg bg-bezhas-accent/10 flex items-center justify-center text-bezhas-accent shrink-0">
                    {icon}
                </div>
            )}
            <div>
                <p className="text-sm text-gray-500">{label}</p>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
            </div>
        </div>
    );
}
