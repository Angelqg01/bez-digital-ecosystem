import http from './http';

export const postsService = {
    /**
     * Obtener posts con paginación y filtros
     * @param {Object} params { limit, offset, author, validated, privacy }
     */
    getPosts: async (params = {}) => {
        const response = await http.get('/api/posts', { params });
        return response.data;
    },

    /**
     * Crear un nuevo post
     * @param {FormData} formData Datos del post (content, media, etc.)
     */
    createPost: async (formData) => {
        const response = await http.post('/api/posts', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        return response.data;
    },

    /**
     * Dar like/reacción a un post
     * @param {string} postId ID del post
     * @param {string} reaction Tipo de reacción (emoji)
     */
    likePost: async (postId, reaction = '❤️') => {
        const response = await http.post(`/api/posts/${postId}/like`, { reaction });
        return response.data;
    },

    /**
     * Comentar en un post
     * @param {string} postId ID del post
     * @param {string} content Contenido del comentario
     */
    commentPost: async (postId, content) => {
        const response = await http.post(`/api/posts/${postId}/comments`, { content });
        return response.data;
    },

    /**
     * Compartir un post
     * @param {string} postId ID del post
     */
    sharePost: async (postId) => {
        const response = await http.post(`/api/posts/${postId}/share`);
        return response.data;
    },

    /**
     * Validar post en blockchain (simulado o real)
     * @param {string} postId ID del post
     */
    validatePost: async (postId) => {
        const response = await http.post(`/api/posts/${postId}/validate`);
        return response.data;
    }
};
