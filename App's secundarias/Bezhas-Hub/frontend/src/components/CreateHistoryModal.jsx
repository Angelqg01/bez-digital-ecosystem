import React, { useState, useRef } from 'react';
import { X, Upload, Link as LinkIcon, Play, Film, Check } from 'lucide-react';

const CreateHistoryModal = ({ onClose }) => {
    const [uploadMethod, setUploadMethod] = useState('upload'); // 'upload' o 'link'
    const [selectedFile, setSelectedFile] = useState(null);
    const [videoUrl, setVideoUrl] = useState('');
    const [videoPreview, setVideoPreview] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const fileInputRef = useRef(null);

    const handleFileSelect = (file) => {
        if (file && file.type.startsWith('video/')) {
            setSelectedFile(file);
            const previewUrl = URL.createObjectURL(file);
            setVideoPreview(previewUrl);
        } else {
            alert('Por favor selecciona un archivo de video válido');
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        handleFileSelect(file);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleFileInputChange = (e) => {
        const file = e.target.files[0];
        handleFileSelect(file);
    };

    const handleImportFromLink = () => {
        if (videoUrl.trim()) {
            setIsProcessing(true);
            // Simular procesamiento del enlace
            setTimeout(() => {
                setVideoPreview(videoUrl);
                setIsProcessing(false);
            }, 1500);
        } else {
            alert('Por favor ingresa un enlace válido');
        }
    };

    const handlePublish = () => {
        // Aquí iría la lógica para publicar la historia
        console.log('Publicando historia...', { selectedFile, videoUrl, videoPreview });
        alert('¡Historia publicada exitosamente! 🎉');
        onClose();
    };

    return (
        <div className="create-history-modal-overlay" onClick={onClose}>
            <div className="create-history-modal" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="modal-header">
                    <h2 className="modal-title">
                        <Film size={28} />
                        Crear History
                    </h2>
                    <button
                        onClick={onClose}
                        className="modal-close-btn"
                        aria-label="Cerrar"
                    >
                        <X size={28} />
                    </button>
                </div>

                {/* Content */}
                <div className="modal-content">
                    {/* Tabs de método de subida */}
                    <div className="upload-tabs">
                        <button
                            onClick={() => setUploadMethod('upload')}
                            className={`upload-tab ${uploadMethod === 'upload' ? 'tab-active' : ''}`}
                        >
                            <Upload size={20} />
                            Subir Video
                        </button>
                        <button
                            onClick={() => setUploadMethod('link')}
                            className={`upload-tab ${uploadMethod === 'link' ? 'tab-active' : ''}`}
                        >
                            <LinkIcon size={20} />
                            Importar desde Link
                        </button>
                    </div>

                    {/* Área de subida */}
                    {uploadMethod === 'upload' ? (
                        <div
                            className={`upload-area ${isDragging ? 'dragging' : ''}`}
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="video/*"
                                onChange={handleFileInputChange}
                                className="file-input-hidden"
                            />

                            {!selectedFile ? (
                                <>
                                    <Upload size={64} className="upload-icon" />
                                    <p className="upload-text-primary">
                                        Arrastra tu video aquí
                                    </p>
                                    <p className="upload-text-secondary">
                                        o haz clic para seleccionar
                                    </p>
                                    <p className="upload-text-hint">
                                        Formatos: MP4, MOV, AVI • Máx: 100MB
                                    </p>
                                </>
                            ) : (
                                <div className="file-selected">
                                    <Check size={64} className="check-icon" />
                                    <p className="file-name">{selectedFile.name}</p>
                                    <p className="file-size">
                                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="link-import-area">
                            <LinkIcon size={48} className="link-icon" />
                            <p className="link-text">
                                Pega el enlace de tu video
                            </p>
                            <p className="link-hint">
                                Soportado: YouTube, Instagram, TikTok, etc.
                            </p>
                            <div className="link-input-group">
                                <input
                                    type="url"
                                    value={videoUrl}
                                    onChange={(e) => setVideoUrl(e.target.value)}
                                    placeholder="https://..."
                                    className="link-input"
                                />
                                <button
                                    onClick={handleImportFromLink}
                                    disabled={isProcessing || !videoUrl.trim()}
                                    className="import-btn"
                                >
                                    {isProcessing ? (
                                        <span className="processing">Importando...</span>
                                    ) : (
                                        'Importar'
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Vista previa del video */}
                    {videoPreview && (
                        <div className="video-preview-section">
                            <h3 className="preview-title">Vista Previa</h3>
                            <div className="video-preview-container">
                                <div className="video-container-9-16 preview-video">
                                    {uploadMethod === 'upload' ? (
                                        <video
                                            src={videoPreview}
                                            controls
                                            className="behistory-video"
                                        />
                                    ) : (
                                        <div className="preview-placeholder">
                                            <Play size={64} className="play-icon" />
                                            <p className="preview-text">Video importado desde enlace</p>
                                            <p className="preview-url">{videoUrl}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="modal-footer">
                    <button
                        onClick={onClose}
                        className="modal-btn btn-cancel"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handlePublish}
                        disabled={!videoPreview}
                        className="modal-btn btn-publish"
                    >
                        Publicar History
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateHistoryModal;
