import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const DocViewer = () => {
    const { docId } = useParams();
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(true);

    // Mapeo de rutas a archivos reales en public/docs/
    const docMap = {
        'whitepaper': '/docs/ANTEPROYECTO.md',
        'devs': '/docs/QUALITY_ORACLE_DOCS.md',
        'guides': '/docs/QUICK_START.md',
        'academy': '/docs/UI_UX_IMPROVEMENTS.md',
        'security': '/docs/SECURITY.md',
        'ai-engine': '/docs/AI_ENGINE_IMPLEMENTATION.md',
        'api': '/docs/API_DOCS_IMPLEMENTATION.md',
        'sdk': '/docs/BEZ_COIN_INTEGRATION.md'
    };

    useEffect(() => {
        const fetchDoc = async () => {
            try {
                const filePath = docMap[docId] || `/docs/${docId}.md`;
                const response = await fetch(filePath);
                if (!response.ok) throw new Error('Documento no encontrado');
                const text = await response.text();
                setContent(text);
            } catch (error) {
                setContent('# Error 404\nDocumento no encontrado.');
            } finally {
                setLoading(false);
            }
        };

        fetchDoc();
    }, [docId]);

    if (loading) return <div className="p-10 text-center">Cargando documentación...</div>;

    return (
        <div className="max-w-4xl mx-auto p-6 bg-gray-900 min-h-screen text-gray-300">
            <article className="prose prose-invert prose-lg max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {content}
                </ReactMarkdown>
            </article>
        </div>
    );
};

export default DocViewer;
