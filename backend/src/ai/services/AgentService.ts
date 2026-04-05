import { Agent } from '../core/types'

// Temporal storage - mover a DB después
const agents: Map<string, Agent> = new Map()

// Agentes predefinidos
const defaultAgents: Agent[] = [
    {
        id: 'bezhas-assistant',
        name: 'BeZhas Assistant',
        description: 'Asistente oficial de BeZhas que ayuda con la plataforma y Web3',
        systemPrompt: `Eres el asistente oficial de BeZhas, una plataforma social Web3. 
Tu objetivo es ayudar a los usuarios con:
- Información sobre BEZ tokens y cómo usarlos
- Guía para comprar, vender y crear NFTs
- Explicación de funcionalidades de la plataforma
- Consejos sobre Web3 y blockchain
- Consultas sobre balances y transacciones

Usa las herramientas disponibles cuando necesites información en tiempo real.
Sé amigable, claro y educativo.`,
        model: 'gpt-4o-mini',
        temperature: 0.7,
        maxTokens: 1000,
        functions: ['get_bez_balance', 'get_user_profile', 'get_trending_topics', 'search_posts'],
        visibility: 'public',
        avatar: '🤖',
        personality: 'friendly',
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        id: 'web3-expert',
        name: 'Web3 Expert',
        description: 'Experto en blockchain, smart contracts y DeFi',
        systemPrompt: `Eres un experto en Web3, blockchain y tecnologías descentralizadas.
Ayudas a los usuarios a entender:
- Conceptos de blockchain y criptomonedas
- Smart contracts y su funcionamiento
- DeFi, NFTs y tokenomics
- Seguridad en Web3
- Mejores prácticas

Proporciona explicaciones técnicas precisas pero accesibles.`,
        model: 'gpt-4o',
        temperature: 0.6,
        maxTokens: 2000,
        functions: ['get_bez_balance', 'get_user_nfts', 'get_marketplace_listings', 'is_vip_user'],
        visibility: 'vip',
        avatar: '⚡',
        personality: 'technical',
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        id: 'nft-advisor',
        name: 'NFT Advisor',
        description: 'Especialista en NFTs y mercado digital',
        systemPrompt: `Eres un asesor especializado en NFTs y arte digital.
Ayudas a los usuarios con:
- Creación y minteo de NFTs
- Estrategias de precio y venta
- Tendencias del mercado NFT
- Evaluación de colecciones
- Marketing para creadores

Usa datos reales del marketplace cuando sea posible.`,
        model: 'gpt-4o-mini',
        temperature: 0.8,
        maxTokens: 1500,
        functions: ['get_user_nfts', 'get_marketplace_listings', 'search_posts', 'get_trending_topics'],
        visibility: 'public',
        avatar: '🎨',
        personality: 'creative',
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        id: 'analytics-bot',
        name: 'Analytics Bot',
        description: 'Bot de análisis de datos y estadísticas',
        systemPrompt: `Eres un analista de datos especializado en métricas de la plataforma BeZhas.
Proporcionas:
- Análisis de estadísticas de usuarios
- Insights sobre tendencias
- Reportes de performance
- Comparativas y benchmarks
- Recomendaciones basadas en datos

Presenta la información de forma clara y visual cuando sea posible.`,
        model: 'gpt-4o',
        temperature: 0.3,
        maxTokens: 2000,
        functions: ['get_user_stats', 'get_user_profile', 'get_trending_topics', 'search_posts'],
        visibility: 'vip',
        avatar: '📊',
        personality: 'analytical',
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        id: 'linkedin-sales-director',
        name: 'LinkedIn Sales Director',
        description: 'Director de Ventas de BeZhas para procesar leads de LinkedIn.',
        systemPrompt: `Actúa como el Director de Ventas y Emisor de Token de BeZhas. Analiza el perfil o post provisto.\nClasifica al lead en una de estas 3 categorías y genera la respuesta correspondiente:\n1. DESARROLLADOR/EMPRESA (Interés en API y SDK): Eficiencia técnica, ahorro de costos.\n2. TOKENIZADOR (RWA - Real World Assets): Seguridad del protocolo, Quality Oracle, auditoría inmutable.\n3. INVERSOR (BEZ-Coin y Gobernanza): ROI (incluyendo Real Yield), escasez del token, DAO.\nGenera un mensaje de conexión de LinkedIn personalizado de 3 párrafos. El tercer párrafo debe ser un CTA directo a BeZhas.`,
        model: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 1000,
        functions: [],
        visibility: 'admin',
        avatar: '👔',
        personality: 'professional',
        createdAt: new Date(),
        updatedAt: new Date()
    }
]

// Inicializar agentes por defecto
defaultAgents.forEach(agent => agents.set(agent.id, agent))

export class AgentService {
    static async listAgents(visibility?: 'public' | 'vip' | 'admin'): Promise<Agent[]> {
        const allAgents = Array.from(agents.values())
        if (!visibility) return allAgents
        return allAgents.filter(a => a.visibility === visibility)
    }

    static async getAgent(id: string): Promise<Agent | null> {
        return agents.get(id) || null
    }

    static async createAgent(data: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>): Promise<Agent> {
        const id = data.name.toLowerCase().replace(/\s+/g, '-')
        const agent: Agent = {
            ...data,
            id,
            createdAt: new Date(),
            updatedAt: new Date()
        }
        agents.set(id, agent)
        return agent
    }

    static async updateAgent(id: string, data: Partial<Agent>): Promise<Agent | null> {
        const existing = agents.get(id)
        if (!existing) return null

        const updated = {
            ...existing,
            ...data,
            id: existing.id,
            updatedAt: new Date()
        }
        agents.set(id, updated)
        return updated
    }

    static async deleteAgent(id: string): Promise<boolean> {
        return agents.delete(id)
    }
}
