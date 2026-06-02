import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { useAuth } from '../../context/AuthContext';
import IERC721 from '../../abis/IERC721.json';
import './ShopComponents.css';

const CreateItemForm = ({ marketplaceContract }) => {
  const { user, signer } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    nftContract: '',
    tokenId: '',
    title: '',
    description: '',
    price: '',
    categoryId: '1',
    duration: '86400', // 1 day in seconds
    tags: '',
  });
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchCategories = async () => {
      if (!marketplaceContract) return;
      try {
        const count = await marketplaceContract.categoryCounter();
        const fetchedCategories = [];
        for (let i = 1; i <= count; i++) {
          const category = await marketplaceContract.categories(i);
          if (category.isActive) {
            fetchedCategories.push({ id: Number(category.categoryId), name: category.name });
          }
        }
        setCategories(fetchedCategories);
      } catch (error) {
        console.error("Failed to fetch categories:", error);
        toast.error('No se pudieron cargar las categorías.');
      }
    };
    fetchCategories();
  }, [marketplaceContract]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user || !marketplaceContract || !signer) {
      toast.error('Por favor, conecta tu wallet.');
      return;
    }

    const { nftContract, tokenId, title, description, price, categoryId, duration, tags } = formData;
    if (!nftContract || !tokenId || !title || !price || !categoryId || !duration) {
      toast.error('Por favor, completa todos los campos requeridos.');
      return;
    }

    setIsLoading(true);
    toast.loading('Procesando listado...');

    try {
      // 1. Approve the marketplace to transfer the NFT
      toast.loading('Aprobando transferencia de NFT...');
      const nft = new ethers.Contract(nftContract, IERC721.abi, signer);
      const approveTx = await nft.approve(await marketplaceContract.getAddress(), tokenId);
      await approveTx.wait();
      toast.dismiss();
      toast.success('Aprobación exitosa.');

      // 2. List the item
      toast.loading('Listando el artículo en el marketplace...');
      const priceInWei = ethers.parseUnits(price, 18);
      const tagsArray = tags.split(',').map(t => t.trim()).filter(t => t);

      const tx = await marketplaceContract.listItem(
        nftContract,
        tokenId,
        priceInWei,
        categoryId,
        duration,
        title,
        description,
        tagsArray
      );
      await tx.wait();
      toast.dismiss();
      toast.success('¡Artículo listado con éxito!');
      navigate('/shop');

    } catch (error) {
      toast.dismiss();
      console.error("Failed to list item:", error);
      toast.error(error.reason || 'Falló la transacción.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="create-item-form">
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Dirección del Contrato del NFT</label>
          <input name="nftContract" value={formData.nftContract} onChange={handleChange} placeholder="0x..." required />
        </div>
        <div className="form-group">
          <label>ID del Token</label>
          <input name="tokenId" type="number" value={formData.tokenId} onChange={handleChange} placeholder="123" required />
        </div>
        <div className="form-group">
          <label>Título del Listado</label>
          <input name="title" value={formData.title} onChange={handleChange} placeholder="Ej: Mi Obra de Arte Digital #123" required />
        </div>
        <div className="form-group">
          <label>Descripción</label>
          <textarea name="description" value={formData.description} onChange={handleChange} placeholder="Describe tu artículo..." />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Precio (en BEZ)</label>
            <input name="price" type="number" value={formData.price} onChange={handleChange} placeholder="0.0" required />
          </div>
          <div className="form-group">
            <label>Categoría</label>
            <select name="categoryId" value={formData.categoryId} onChange={handleChange} required>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Duración del Listado</label>
            <select name="duration" value={formData.duration} onChange={handleChange} required>
              <option value="86400">1 Día</option>
              <option value="604800">7 Días</option>
              <option value="2592000">30 Días</option>
            </select>
          </div>
          <div className="form-group">
            <label>Etiquetas (separadas por comas)</label>
            <input name="tags" value={formData.tags} onChange={handleChange} placeholder="arte, coleccionable, pfp" />
          </div>
        </div>
        <Button type="submit" variant="primary" disabled={isLoading}>
          {isLoading ? 'Listando Artículo...' : 'Listar Artículo'}
        </Button>
      </form>
    </Card>
  );
};

export default CreateItemForm;
