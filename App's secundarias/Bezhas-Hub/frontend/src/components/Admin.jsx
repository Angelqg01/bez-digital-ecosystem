import { useState, useEffect } from 'react';
import http from '../services/http';

const Admin = () => {
    const [config, setConfig] = useState({
        contractAddresses: {},
        apiKeys: {},
        privateKey: ''
    });
    const [message, setMessage] = useState('');

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const { data } = await http.get('/api/config');
                if (data) {
                    setConfig(prev => ({ ...prev, ...data }));
                }
            } catch (error) {
                setMessage('Error fetching configuration');
                console.error('Error fetching configuration:', error);
            }
        };
        fetchConfig();
    }, []);

    const handleAddressChange = (e) => {
        const { name, value } = e.target;
        setConfig(prev => ({
            ...prev,
            contractAddresses: { ...prev.contractAddresses, [name]: value }
        }));
    };

    const handleApiKeyChange = (e) => {
        const { name, value } = e.target;
        setConfig(prev => ({
            ...prev,
            apiKeys: { ...prev.apiKeys, [name]: value }
        }));
    };

    const handlePrivateKeyChange = (e) => {
        setConfig(prev => ({ ...prev, privateKey: e.target.value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('Saving configuration...');
        try {
            const response = await http.post('/api/config', config, {
                headers: { 'Content-Type': 'application/json' }
            });
            if (response.status === 200) {
                setMessage('Configuration saved successfully!');
            } else {
                setMessage('Failed to save configuration.');
            }
        } catch (error) {
            setMessage('Error saving configuration');
            console.error('Error saving configuration:', error);
        }
    };

    return (
        <div className="admin-panel card mt-4">
            <h2 className="card-title">Admin Configuration Panel</h2>
            <form onSubmit={handleSubmit}>
                <h4>Contract Addresses</h4>
                {config.contractAddresses && Object.keys(config.contractAddresses).map(key => (
                    <div className="form-group" key={key}>
                        <label htmlFor={key}>{key}</label>
                        <input
                            type="text"
                            id={key}
                            name={key}
                            className="form-control"
                            value={config.contractAddresses[key] || ''}
                            onChange={handleAddressChange}
                        />
                    </div>
                ))}

                <h4 className="mt-4">API Keys</h4>
                {config.apiKeys && Object.keys(config.apiKeys).map(key => (
                     <div className="form-group" key={key}>
                        <label htmlFor={key}>{key}</label>
                        <input
                            type="text"
                            id={key}
                            name={key}
                            className="form-control"
                            value={config.apiKeys[key] || ''}
                            onChange={handleApiKeyChange}
                        />
                    </div>
                ))}

                <h4 className="mt-4">Private Key</h4>
                 <div className="form-group">
                    <label htmlFor="privateKey">Deployer Private Key</label>
                    <input
                        type="password"
                        id="privateKey"
                        name="privateKey"
                        className="form-control"
                        value={config.privateKey || ''}
                        onChange={handlePrivateKeyChange}
                    />
                </div>

                <button type="submit" className="btn btn-primary w-100 mt-3">Save Configuration</button>
            </form>
            {message && <div className="alert alert-info mt-3">{message}</div>}
        </div>
    );
};

export default Admin;
