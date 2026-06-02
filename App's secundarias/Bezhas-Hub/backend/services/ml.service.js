// TensorFlow temporalmente deshabilitado - Modo Ligero con Natural NLP
const natural = require('natural');
const fs = require('fs').promises;
const path = require('path');

/**
 * MLService - Servicio de Machine Learning Local (MODO LIGERO)
 * Usa Natural NLP para análisis básico sin TensorFlow
 */
class MLService {
    constructor() {
        this.tfAvailable = false;
        console.log('⚠️ ML Service en MODO LIGERO (sin TensorFlow)');

        this.models = {
            sentiment: null,
            recommendations: null,
            contentClassifier: null,
            userPreferences: null
        };

        this.tokenizer = new natural.WordTokenizer();
        this.tfidf = new natural.TfIdf();
        this.analyzer = new natural.SentimentAnalyzer('Spanish', natural.PorterStemmerEs, 'afinn');

        // Directorio para almacenar modelos
        this.modelsDir = path.join(__dirname, '../ml-models');

        this.initializeService();
    }

    async initializeService() {
        try {
            // Crear directorio de modelos si no existe
            await fs.mkdir(this.modelsDir, { recursive: true });

            console.log('✅ ML Service initialized (Modo Ligero - Natural NLP)');
        } catch (error) {
            console.error('❌ Error initializing ML Service:', error);
        }
    }

    /**
     * NO SE CARGAN MODELOS DE TENSORFLOW (Modo Ligero)
     */
    async loadOrCreateModels() {
        console.log('⚠️ Modelos TensorFlow deshabilitados - Usando Natural NLP');
    }

    /**
     * Análisis de sentimientos con Natural NLP (sin TensorFlow)
     */
    async analyzeSentiment(text) {
        try {
            // Tokenizar texto
            const tokens = this.tokenizer.tokenize(text.toLowerCase());

            // Análisis de sentimientos con Natural
            const score = this.analyzer.getSentiment(tokens);

            // Convertir score (-5 a 5) a categorías
            let sentiment, negative, neutral, positive;
            if (score > 1) {
                sentiment = 'positive';
                positive = Math.min(1, (score + 5) / 10);
                neutral = 0.3;
                negative = 0.1;
            } else if (score < -1) {
                sentiment = 'negative';
                negative = Math.min(1, Math.abs(score + 5) / 10);
                neutral = 0.3;
                positive = 0.1;
            } else {
                sentiment = 'neutral';
                neutral = 0.6;
                positive = 0.2;
                negative = 0.2;
            }

            return {
                sentiment,
                scores: { negative, neutral, positive },
                confidence: Math.max(negative, neutral, positive),
                rawScore: score
            };
        } catch (error) {
            console.error('Error analyzing sentiment:', error);
            return {
                sentiment: 'neutral',
                scores: { negative: 0, neutral: 1, positive: 0 },
                confidence: 0,
                rawScore: 0
            };
        }
    }

    /**
     * Generar recomendaciones simplificadas (sin TensorFlow)
     */
    async generateRecommendations(userFeatures, contentPool) {
        try {
            const recommendations = [];

            for (const content of contentPool) {
                // Score básico basado en coincidencias
                let score = 0;

                // Comparar intereses
                if (userFeatures.interests && content.tags) {
                    const matches = content.tags.filter(tag =>
                        userFeatures.interests.includes(tag)
                    ).length;
                    score += matches * 0.3;
                }

                // Factor de popularidad
                if (content.likes) score += Math.log(content.likes + 1) * 0.1;
                if (content.views) score += Math.log(content.views + 1) * 0.05;

                recommendations.push({
                    ...content,
                    recommendationScore: Math.min(1, score)
                });
            }

            // Ordenar por score descendente
            recommendations.sort((a, b) => b.recommendationScore - a.recommendationScore);

            return recommendations.slice(0, 10);
        } catch (error) {
            console.error('Error generating recommendations:', error);
            return contentPool.slice(0, 10);
        }
    }

    /**
     * Clasificar contenido simplificado (sin TensorFlow)
     */
    async classifyContent(text) {
        try {
            const tokens = this.tokenizer.tokenize(text.toLowerCase());

            // Palabras clave por categoría
            const categories = {
                technology: ['blockchain', 'crypto', 'web3', 'ai', 'tech', 'code', 'software'],
                finance: ['token', 'price', 'trade', 'invest', 'market', 'economy'],
                art: ['art', 'design', 'creative', 'music', 'photo', 'video'],
                social: ['community', 'friend', 'connect', 'share', 'social'],
                education: ['learn', 'tutorial', 'guide', 'teach', 'course'],
                entertainment: ['game', 'fun', 'play', 'entertainment', 'movie'],
                health: ['health', 'fitness', 'wellness', 'medical'],
                science: ['science', 'research', 'study', 'experiment'],
                news: ['news', 'update', 'announcement', 'breaking'],
                other: []
            };

            const scores = {};
            for (const [category, keywords] of Object.entries(categories)) {
                const matches = tokens.filter(token =>
                    keywords.some(keyword => token.includes(keyword))
                ).length;
                scores[category] = matches;
            }

            // Encontrar categoría con más matches
            const maxCategory = Object.keys(scores).reduce((a, b) =>
                scores[a] > scores[b] ? a : b
            );

            return {
                category: scores[maxCategory] > 0 ? maxCategory : 'other',
                scores,
                confidence: scores[maxCategory] / Math.max(tokens.length, 1)
            };
        } catch (error) {
            console.error('Error classifying content:', error);
            return { category: 'other', scores: {}, confidence: 0 };
        }
    }

    /**
     * Entrenar modelo (deshabilitado sin TensorFlow)
     */
    async trainModel(modelName, trainingData, labels) {
        console.log(`⚠️ Training disabled in lightweight mode`);
        return { success: false, error: 'TensorFlow not available' };
    }

    /**
     * Generar embedding de texto
     */
    generateTextEmbedding(text) {
        // TF-IDF para embedding simple
        this.tfidf.addDocument(text);
        const terms = {};

        this.tfidf.listTerms(0).forEach(item => {
            terms[item.term] = item.tfidf;
        });

        // Convertir a vector de tamaño fijo (128 dimensiones)
        const embedding = new Array(128).fill(0);
        const termsList = Object.keys(terms).slice(0, 128);

        termsList.forEach((term, i) => {
            embedding[i] = terms[term];
        });

        return embedding;
    }

    /**
     * Obtener estadísticas del servicio
     */
    getStats() {
        return {
            tfAvailable: this.tfAvailable,
            mode: 'lightweight',
            features: ['sentiment_analysis', 'recommendations', 'content_classification'],
            modelsLoaded: false
        };
    }
}

module.exports = new MLService();
