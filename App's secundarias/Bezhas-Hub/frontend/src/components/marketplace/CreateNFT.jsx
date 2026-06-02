import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { FaImage, FaCoins } from 'react-icons/fa';
import { useNFTContract } from '../../hooks/useNFTContract';
import { useWeb3 } from '../../context/Web3Context';
import { Spinner } from '../ui/Spinner';

const CreateNFT = () => {
    const { address } = useWeb3();
    const { mintNFT, isLoading, isContractDeployed } = useNFTContract();

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        imageUrl: '',
        attributes: ''
    });

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!address) {
            toast.error('Por favor conecta tu wallet primero');
            return;
        }

        if (!isContractDeployed) {
            toast.error('El contrato de NFT no está desplegado aún');
            return;
        }

        if (!formData.name || !formData.imageUrl) {
            toast.error('El nombre y la URL de la imagen son requeridos');
            return;
        }

        try {
            // Create metadata JSON
            const metadata = {
                name: formData.name,
                description: formData.description,
                image: formData.imageUrl,
                attributes: formData.attributes ? JSON.parse(formData.attributes) : []
            };

            // In production, you'd upload this to IPFS
            // For now, we'll use a data URI or external URL
            const tokenURI = formData.imageUrl;

            toast.loading('Creando tu NFT...', { id: 'mint-nft' });

            await mintNFT(address, tokenURI);

            toast.success('¡NFT creado exitosamente! 🎉', { id: 'mint-nft' });

            // Reset form
            setFormData({
                name: '',
                description: '',
                imageUrl: '',
                attributes: ''
            });
        } catch (error) {
            console.error('Error creating NFT:', error);
            toast.error('Error al crear el NFT. ' + (error.reason || error.message), { id: 'mint-nft' });
        }
    };

    if (!isContractDeployed) {
        return (
            <div className="max-w-2xl mx-auto p-6">
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 text-center">
                    <FaImage className="mx-auto text-yellow-500 text-5xl mb-4" />
                    <h3 className="text-xl font-bold text-yellow-800 dark:text-yellow-300 mb-2">
                        Contrato NFT No Desplegado
                    </h3>
                    <p className="text-yellow-700 dark:text-yellow-400">
                        El contrato de BezhasNFT aún no está desplegado en la red. Por favor despliega los contratos primero.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto p-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
                <div className="mb-6">
                    <h2 className="text-3xl font-bold mb-2 flex items-center gap-3">
                        <FaImage className="text-purple-500" />
                        Crear Nuevo NFT
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">
                        Mintea tu propio NFT en la blockchain de Bezhas
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Name */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Nombre del NFT *
                        </label>
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            placeholder="Ej: Bezhas Genesis #1"
                            className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            required
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Descripción
                        </label>
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            placeholder="Describe tu NFT..."
                            rows="4"
                            className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                        />
                    </div>

                    {/* Image URL */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            URL de la Imagen *
                        </label>
                        <input
                            type="url"
                            name="imageUrl"
                            value={formData.imageUrl}
                            onChange={handleChange}
                            placeholder="https://ejemplo.com/imagen.jpg"
                            className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            required
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Ingresa la URL de tu imagen (se recomienda usar IPFS en producción)
                        </p>
                    </div>

                    {/* Image Preview */}
                    {formData.imageUrl && (
                        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4">
                            <p className="text-sm font-medium mb-2">Vista Previa:</p>
                            <img
                                src={formData.imageUrl}
                                alt="Preview"
                                className="w-full h-64 object-cover rounded-lg"
                                onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.nextSibling.style.display = 'flex';
                                }}
                            />
                            <div className="hidden w-full h-64 bg-gray-100 dark:bg-gray-700 rounded-lg items-center justify-center">
                                <p className="text-gray-500">No se pudo cargar la imagen</p>
                            </div>
                        </div>
                    )}

                    {/* Attributes (Optional) */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Atributos (JSON opcional)
                        </label>
                        <textarea
                            name="attributes"
                            value={formData.attributes}
                            onChange={handleChange}
                            placeholder='[{"trait_type": "Rareza", "value": "Legendario"}]'
                            rows="3"
                            className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none font-mono text-sm"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Formato JSON array de objetos con trait_type y value
                        </p>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={isLoading || !address}
                        className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-4 rounded-lg transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <Spinner size="sm" />
                                Creando NFT...
                            </>
                        ) : (
                            <>
                                <FaCoins />
                                Crear NFT
                            </>
                        )}
                    </button>

                    {!address && (
                        <p className="text-center text-sm text-red-500">
                            Conecta tu wallet para crear NFTs
                        </p>
                    )}
                </form>
            </div>
        </div>
    );
};

export default CreateNFT;
