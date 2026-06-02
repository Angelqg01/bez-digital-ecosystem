import Link from 'next/link';

export default function NotFound() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center">
                <h1 className="text-6xl font-bold text-gray-300">404</h1>
                <p className="text-gray-500 mt-2">Página no encontrada</p>
                <Link href="/dashboard" className="text-bezhas-accent hover:underline mt-4 inline-block">
                    Volver al Dashboard
                </Link>
            </div>
        </div>
    );
}
