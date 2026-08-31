import React, { useState } from 'react';
import { Settings, Save } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import './AdminComponents.css';

const GlobalConfigPanel = () => {
  // Mock data from GlobalConfigurationSystem.sol
  const [config, setConfig] = useState({
    marketplaceFee: 2.5,
    postExp: 10,
    rankRequirement: 1000
  });

  const handleSave = () => {
    console.log('Saving config:', config);
    // Call contract to update config
  };

  return (
    <div className="global-config-panel">
      <h2><Settings /> Configuración Global</h2>
      <Card>
        <div className="config-form">
          <div className="form-group-admin">
            <label>Comisión del Marketplace (%)</label>
            <input
              type="number"
              value={config.marketplaceFee}
              onChange={(e) => setConfig({ ...config, marketplaceFee: parseFloat(e.target.value) })}
              className="form-input-admin"
            />
          </div>
          <div className="form-group-admin">
            <label>Puntos de EXP por Post</label>
            <input
              type="number"
              value={config.postExp}
              onChange={(e) => setConfig({ ...config, postExp: parseInt(e.target.value) })}
              className="form-input-admin"
            />
          </div>
          <div className="form-group-admin">
            <label>Requisitos de EXP para Rango</label>
            <input
              type="number"
              value={config.rankRequirement}
              onChange={(e) => setConfig({ ...config, rankRequirement: parseInt(e.target.value) })}
              className="form-input-admin"
            />
          </div>
          <div className="form-actions-admin">
            <Button variant="primary" onClick={handleSave}>
              <Save size={16} /> Guardar Cambios
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default GlobalConfigPanel; 
