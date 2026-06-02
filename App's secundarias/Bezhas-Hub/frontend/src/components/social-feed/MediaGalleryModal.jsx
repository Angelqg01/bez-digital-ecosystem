import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * MediaGalleryModal Component
 * Modal para visualizar imágenes y videos en pantalla completa
 * Navegación entre múltiples medios con flechas
 * 
 * @param {Array} media - Array de objetos con {url, type}
 * @param {Number} initialIndex - Índice inicial del medio a mostrar
 * @param {Function} onClose - Callback para cerrar el modal
 */
const MediaGalleryModal = ({ media = [], initialIndex = 0, onClose }) => {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);

    // Cerrar con tecla ESC
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft') handlePrevious();
            if (e.key === 'ArrowRight') handleNext();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentIndex]);

    // Prevenir scroll del body cuando el modal está abierto
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, []);

    const handlePrevious = () => {
        setCurrentIndex((prev) => (prev > 0 ? prev - 1 : media.length - 1));
    };

    const handleNext = () => {
        setCurrentIndex((prev) => (prev < media.length - 1 ? prev + 1 : 0));
    };

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const currentMedia = media[currentIndex];

    return (
        <div
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
            onClick={handleBackdropClick}
        >
            {/* Botón de cerrar */}
            <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-50"
                aria-label="Cerrar galería"
            >
                <X size={24} className="text-white" />
            </button>

            {/* Contador de imágenes */}
            {media.length > 1 && (
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black/50 text-white px-4 py-2 rounded-full text-sm font-medium z-50">
                    {currentIndex + 1} / {media.length}
                </div>
            )}

            {/* Contenido del medio */}
            <div className="relative w-full h-full flex items-center justify-center p-4 sm:p-8">
                {currentMedia?.type === 'video' ? (
                    <video
                        src={currentMedia.url}
                        controls
                        autoPlay
                        className="max-w-full max-h-full rounded-lg"
                        onClick={(e) => e.stopPropagation()}
                    />
                ) : (
                    <img
                        src={currentMedia?.url}
                        alt={`Media ${currentIndex + 1}`}
                        className="max-w-full max-h-full object-contain rounded-lg"
                        onClick={(e) => e.stopPropagation()}
                    />
                )}
            </div>

            {/* Navegación (solo si hay más de 1 medio) */}
            {media.length > 1 && (
                <>
                    {/* Botón anterior */}
                    <button
                        onClick={handlePrevious}
                        className="absolute left-4 top-1/2 transform -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-50"
                        aria-label="Anterior"
                    >
                        <ChevronLeft size={32} className="text-white" />
                    </button>

                    {/* Botón siguiente */}
                    <button
                        onClick={handleNext}
                        className="absolute right-4 top-1/2 transform -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-50"
                        aria-label="Siguiente"
                    >
                        <ChevronRight size={32} className="text-white" />
                    </button>

                    {/* Indicadores de puntos */}
                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 z-50">
                        {media.map((_, index) => (
                            <button
                                key={index}
                                onClick={() => setCurrentIndex(index)}
                                className={`w-2 h-2 rounded-full transition-all ${index === currentIndex
                                        ? 'bg-white w-8'
                                        : 'bg-white/50 hover:bg-white/75'
                                    }`}
                                aria-label={`Ver imagen ${index + 1}`}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default MediaGalleryModal;
