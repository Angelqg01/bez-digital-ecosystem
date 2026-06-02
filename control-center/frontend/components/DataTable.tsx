// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function DataTable<T extends Record<string, any>>({
    columns, data, emptyMessage,
}: {
    columns: { key: string; label: string; render?: (row: T) => React.ReactNode }[];
    data: T[];
    emptyMessage?: string;
}) {
    return (
        <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-gray-100">
                        {columns.map(col => (
                            <th key={col.key} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                {col.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.length === 0 ? (
                        <tr>
                            <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400">
                                {emptyMessage || 'No hay datos disponibles'}
                            </td>
                        </tr>
                    ) : (
                        data.map((row, i) => (
                            <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                {columns.map(col => (
                                    <td key={col.key} className="px-4 py-3 text-gray-700">
                                        {col.render ? col.render(row) : String(row[col.key] ?? '')}
                                    </td>
                                ))}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}
