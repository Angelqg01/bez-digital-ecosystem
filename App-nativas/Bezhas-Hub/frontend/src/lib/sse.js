/**
 * Analizador incremental de Server-Sent Events (event:/data:). Solo emite cargas JSON que sean objetos.
 * Devuelve una función `push(chunk)` que acepta texto parcial.
 */
export function createSseParser(onEvent) {
    let buffer = '';
    return (chunk) => {
        buffer += chunk;
        let idx;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
            const block = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            let event = 'message';
            const dataLines = [];
            for (const line of block.split('\n')) {
                if (line.startsWith('event:')) event = line.slice(6).trim();
                else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
            }
            if (!dataLines.length) continue;
            let data;
            try { data = JSON.parse(dataLines.join('\n')); } catch { continue; }
            if (data && typeof data === 'object' && !Array.isArray(data)) onEvent({ event, data });
        }
    };
}
