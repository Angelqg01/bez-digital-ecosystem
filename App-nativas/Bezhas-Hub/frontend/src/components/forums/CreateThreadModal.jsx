import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { X } from 'lucide-react';
import Button from '../ui/Button';
import Card from '../ui/Card';
import './ForumsComponents.css';

const CreateThreadModal = ({ forumsContract, onClose, onThreadCreated }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateThread = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error('El título y el contenido no pueden estar vacíos.');
      return;
    }
    if (!forumsContract) {
      toast.error('El contrato de foros no está disponible.');
      return;
    }

    setIsLoading(true);
    toast.loading('Creando nuevo hilo...');

    try {
      const tx = await forumsContract.createThread(title, content);
      await tx.wait();
      toast.dismiss();
      toast.success('¡Hilo creado con éxito!');
      onThreadCreated();
      onClose();
    } catch (error) {
      toast.dismiss();
      console.error('Error creating thread:', error);
      toast.error(error.reason || 'No se pudo crear el hilo.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <Card className="create-thread-modal">
          <div className="modal-header">
            <h2>Iniciar un Nuevo Hilo de Discusión</h2>
            <Button variant="secondary" onClick={onClose} className="close-button">
              <X size={20} />
            </Button>
          </div>
          <div className="modal-body">
            <div className="form-group">
              <label htmlFor="thread-title">Título</label>
              <input
                id="thread-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Un título claro y conciso"
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label htmlFor="thread-content">Contenido</label>
              <textarea
                id="thread-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows="8"
                placeholder="Describe el tema que quieres discutir..."
                className="form-textarea"
              />
            </div>
            <div className="form-actions">
              <Button variant="secondary" onClick={onClose} disabled={isLoading}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={handleCreateThread} disabled={isLoading}>
                {isLoading ? 'Creando...' : 'Crear Hilo'}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default CreateThreadModal;
