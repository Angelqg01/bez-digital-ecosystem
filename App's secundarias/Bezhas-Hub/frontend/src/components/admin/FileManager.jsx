import React from 'react';
import { File, FileJson, FileImage, MoreVertical, Upload, Download, Trash2, Eye } from 'lucide-react';

const mockFiles = [
  { name: 'nft-metadata.json', type: 'json', size: '15 KB', lastModified: '2024-09-25' },
  { name: 'profile-avatars.zip', type: 'zip', size: '2.3 MB', lastModified: '2024-09-24' },
  { name: 'banner_ad_campaign.png', type: 'image', size: '450 KB', lastModified: '2024-09-23' },
  { name: 'terms_of_service.pdf', type: 'pdf', size: '128 KB', lastModified: '2024-09-22' },
];

const getFileIcon = (type) => {
  switch (type) {
    case 'json': return <FileJson className="text-yellow-500" />;
    case 'image': return <FileImage className="text-blue-500" />;
    default: return <File className="text-gray-500" />;
  }
};

const FileManager = () => {
  return (
    <div className="bg-dark-surface dark:bg-light-surface p-6 rounded-2xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Gestión de Archivos (IPFS)</h3>
        <button className="bg-dark-primary dark:bg-light-primary text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 hover:opacity-90 transition-opacity">
          <Upload size={16} />
          <span>Subir Archivo</span>
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-dark-background dark:border-light-background">
              <th className="p-3">Nombre</th>
              <th className="p-3">Tamaño</th>
              <th className="p-3">Última Modificación</th>
              <th className="p-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {mockFiles.map(file => (
              <tr key={file.name} className="border-b border-dark-background dark:border-light-background last:border-b-0">
                <td className="p-3 flex items-center gap-3">
                  {getFileIcon(file.type)}
                  <span className="font-medium">{file.name}</span>
                </td>
                <td className="p-3 text-dark-text-muted dark:text-light-text-muted">{file.size}</td>
                <td className="p-3 text-dark-text-muted dark:text-light-text-muted">{file.lastModified}</td>
                <td className="p-3 text-right">
                  <div className="flex justify-end gap-2">
                     <button className="p-2 rounded-md hover:bg-dark-background dark:hover:bg-light-background transition-colors" title="Ver"><Eye size={16} /></button>
                     <button className="p-2 rounded-md hover:bg-dark-background dark:hover:bg-light-background transition-colors" title="Descargar"><Download size={16} /></button>
                     <button className="p-2 rounded-md hover:bg-dark-background dark:hover:bg-light-background text-red-500 transition-colors" title="Eliminar"><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FileManager;
