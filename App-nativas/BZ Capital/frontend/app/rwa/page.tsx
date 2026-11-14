import { redirect } from 'next/navigation';

/**
 * El Hub redirige aquí `/rwa` («RWA migrado a BZ Capital»). El marketplace de
 * fracciones todavía no está en BZ Capital; lo que sí hay es la pantalla de rentas.
 */
export default function RwaPage() {
    redirect('/rwa/rentas');
}
