import Link from 'next/link';

export const metadata = { title: 'Recuperar acceso · BeZhas Admin' };

export default function AdminRecoverPage() {
    return (
        <main className="min-h-screen bg-[#05060a] text-white flex items-center justify-center p-6">
            <div className="w-full max-w-lg bg-white/5 border border-white/10 p-8 space-y-6">
                <h1 className="text-lg font-bold tracking-widest uppercase">Recuperar acceso</h1>

                <section className="space-y-2">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-gray-300">1. Tienes un código de respaldo</h2>
                    <p className="text-sm text-gray-400">
                        Inicia sesión y, en el paso del 2FA, escribe un código de respaldo (formato
                        <span className="font-mono"> XXXXX-XXXXX</span>) en lugar del código del autenticador. Cada código vale una sola vez.
                    </p>
                </section>

                <section className="space-y-2">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-gray-300">2. No tienes ni autenticador ni códigos</h2>
                    <p className="text-sm text-gray-400">
                        El restablecimiento se hace desde el servidor, no desde la web, para que robar la contraseña no baste para
                        enrolar un autenticador ajeno. Con acceso a la base de datos de producción:
                    </p>
                    <pre className="bg-[#05060a] border border-white/10 p-3 text-xs font-mono text-gray-300 overflow-x-auto">node api/scripts/reset-admin-2fa.js --yes</pre>
                    <p className="text-sm text-gray-400">
                        Después inicia sesión de nuevo: se te pedirá escanear un QR nuevo y guardar los códigos de respaldo.
                    </p>
                </section>

                <Link href="/admin/login" className="inline-block text-[10px] text-gray-500 hover:text-white uppercase tracking-widest font-bold underline underline-offset-4">
                    Volver al login
                </Link>
            </div>
        </main>
    );
}
