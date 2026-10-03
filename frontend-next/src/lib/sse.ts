/**
 * Parser incremental de Server-Sent Events (formato `event:` / `data:` separado por línea en blanco).
 * Tolera trozos que cortan un evento por la mitad y saltos de línea \r\n.
 */
export type SseEvent = { event: string; data: any };

export function createSseParser(onEvent: (e: SseEvent) => void) {
    let buffer = "";
    return (chunk: string) => {
        buffer += chunk.replace(/\r\n/g, "\n");
        let end: number;
        while ((end = buffer.indexOf("\n\n")) >= 0) {
            const block = buffer.slice(0, end);
            buffer = buffer.slice(end + 2);
            if (!block.trim()) continue;

            let event = "message";
            const data: string[] = [];
            for (const line of block.split("\n")) {
                if (line.startsWith("event:")) event = line.slice(6).trim();
                else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
            }
            if (!data.length) continue;
            try { onEvent({ event, data: JSON.parse(data.join("\n")) }); } catch { /* evento mal formado: se ignora */ }
        }
    };
}
