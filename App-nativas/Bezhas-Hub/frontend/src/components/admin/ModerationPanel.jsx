import React from 'react';
import { AlertTriangle, Check, Trash2, UserX } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import './AdminComponents.css';

const ModerationPanel = () => {
  // Mock data from ModerationSystem.sol
  const reports = [
    {
      id: 1,
      content: 'Contenido inapropiado en un post sobre DeFi...',
      reportedBy: 'amiyoe',
      reason: 'Spam',
      timestamp: 'hace 15 minutos'
    },
    {
      id: 2,
      content: 'Usuario @OffensiveUser publicando comentarios de odio...',
      reportedBy: 'CryptoExplorer',
      reason: 'Acoso',
      timestamp: 'hace 2 horas'
    }
  ];

  return (
    <div className="moderation-panel">
      <h2><AlertTriangle /> Panel de Moderación</h2>
      <div className="reports-queue">
        {reports.map(report => (
          <Card key={report.id} className="report-card">
            <div className="report-info">
              <p><strong>Contenido:</strong> {report.content}</p>
              <p><strong>Reportado por:</strong> @{report.reportedBy}</p>
              <p><strong>Motivo:</strong> {report.reason}</p>
              <span className="report-timestamp">{report.timestamp}</span>
            </div>
            <div className="report-actions">
              <Button variant="secondary"><Check size={16} /> Descartar</Button>
              <Button variant="danger"><Trash2 size={16} /> Eliminar Contenido</Button>
              <Button variant="danger"><UserX size={16} /> Suspender Usuario</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ModerationPanel; 
