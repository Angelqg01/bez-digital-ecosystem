import React, { useState } from 'react';
import { Send, User } from 'lucide-react';
import AdComment from './AdComment';

const CommentsSection = ({ postId, authorName, onRevenueGenerated }) => {
    const [commentText, setCommentText] = useState('');

    // Mock de comentarios iniciales
    const [comments, setComments] = useState([
        { id: 1, user: 'crypto_fan', text: '¡Excelente análisis! Totalmente de acuerdo.', time: '2m' },
        { id: 2, user: 'blockchain_dev', text: '¿Has verificado el contrato inteligente?', time: '5m' },
        { id: 3, user: 'investor_01', text: 'To the moon! 🚀', time: '10m' },
        { id: 4, user: 'web3_user', text: 'Gracias por compartir esta info.', time: '15m' },
        { id: 5, user: 'trader_x', text: 'Interesante perspectiva.', time: '20m' },
    ]);

    const handleSend = (e) => {
        e.preventDefault();
        if (!commentText.trim()) return;

        const newComment = {
            id: Date.now(),
            user: 'Tú', // Usuario actual
            text: commentText,
            time: 'Ahora'
        };

        setComments([newComment, ...comments]);
        setCommentText('');
    };

    // Función para intercalar anuncios cada 3 comentarios
    const renderCommentsWithAds = () => {
        const result = [];
        comments.forEach((comment, index) => {
            result.push(
                <div key={comment.id} className="flex gap-3 mb-4 animate-in fade-in slide-in-from-bottom-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {comment.user.charAt(0).toUpperCase()}
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl rounded-tl-none px-4 py-2 flex-1">
                        <div className="flex justify-between items-baseline">
                            <span className="text-xs font-bold text-gray-900 dark:text-white">{comment.user}</span>
                            <span className="text-[10px] text-gray-500">{comment.time}</span>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{comment.text}</p>
                    </div>
                </div>
            );

            // Inyectar anuncio después del comentario 3, 6, 9...
            if ((index + 1) % 3 === 0) {
                result.push(
                    <AdComment
                        key={`ad-${index}`}
                        onAdClick={(amount) => onRevenueGenerated(amount)}
                    />
                );
            }
        });
        return result;
    };

    return (
        <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50/30 dark:bg-black/20 p-4">
            {/* Input de Comentario */}
            <form onSubmit={handleSend} className="flex gap-2 mb-6">
                <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
                    <User size={16} className="text-gray-500" />
                </div>
                <div className="flex-1 relative">
                    <input
                        type="text"
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder={`Comenta como ${authorName}...`}
                        className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full py-2 pl-4 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                    <button
                        type="submit"
                        disabled={!commentText.trim()}
                        className="absolute right-1.5 top-1.5 p-1 bg-purple-600 text-white rounded-full disabled:opacity-50 disabled:bg-gray-400 hover:bg-purple-700 transition-colors"
                    >
                        <Send size={14} />
                    </button>
                </div>
            </form>

            {/* Lista de Comentarios + Anuncios */}
            <div className="space-y-2">
                {renderCommentsWithAds()}
            </div>
        </div>
    );
};

export default CommentsSection;
