/** Extrae un mensaje legible de un error de axios del backend BeZhas. */
export function apiError(e: unknown, fallback: string): string {
    const d = (e as { response?: { data?: { error?: string; message?: string; errors?: { msg: string }[] } } })?.response?.data;
    return d?.error || d?.message || d?.errors?.[0]?.msg || fallback;
}
