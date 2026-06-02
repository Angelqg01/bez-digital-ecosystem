# ⚙️ Technical Reference & API

## 📡 API Documentation
**Base URL**: `http://localhost:3001/api`
**Swagger UI**: `http://localhost:3001/api-docs`

### Authentication
- **Method**: JWT (Bearer Token) or API Key (`X-API-Key`).
- **Tiers**: Free (100 req/h), Pro (1000 req/h).

### Key Endpoints
| Category | Method | Endpoint | Description |
|----------|--------|----------|-------------|
| **Auth** | POST | `/auth/login` | Login user |
| **Users** | GET | `/users/profile/:id` | Get public profile |
| **Posts** | GET | `/posts/feed` | Get main feed |
| **Market** | GET | `/marketplace/products` | List basic products |
| **DAO** | GET | `/governance/proposals` | List DAO proposals |

---

## 💾 Database Schema (MongoDB)

### Users
```json
{
  "username": "String",
  "walletAddress": "String (Index, Unique)",
  "role": "Enum ['user', 'admin', 'business']",
  "reputationScore": "Number",
  "inventory": ["Ref(NFT)"]
}
```

### Posts
```json
{
  "author": "Ref(User)",
  "content": "String",
  "media": ["String(URL)"],
  "isTokenized": "Boolean",
  "qualityScore": "Number",
  "onChainId": "Number (if tokenized)"
}
```

---

## 🔒 Security Architecture
1. **Middleware**: `helmet`, `cors`, `rateLimit`, `apiKeyAuth`.
2. **Input Validation**: `express-validator` on all routes.
3. **Smart Contracts**: Slither scanned. `Ownable`, `ReentrancyGuard` used standardly.

---

## 🧪 Testing Strategy
- **Unit (Backend)**: Jest + Supertest.
- **Integration (Blockchain)**: Hardhat + Chai.
- **E2E (Frontend)**: Cypress (Roadmap).

**Run Backend Tests**:
```bash
cd backend
npm test
```
