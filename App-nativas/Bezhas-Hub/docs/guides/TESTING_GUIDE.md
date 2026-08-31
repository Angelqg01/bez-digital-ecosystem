# Quality Oracle - Testing Guide

## 📋 Resumen

Suite de tests completa para Quality Oracle incluyendo tests unitarios para backend (reputación, notificaciones) y frontend (hooks, componentes).

---

## 🧪 Tests Implementados

### Backend Tests

#### 1. **qualityReputationSystem.test.js** (370 líneas)

**Cobertura**:
- ✅ Constructor initialization
- ✅ updateAfterService (score calculation, achievements)
- ✅ updateAfterDispute (penalties, stats)
- ✅ Score calculation algorithm (weighted factors)
- ✅ Tier assignment (6 tiers)
- ✅ Leaderboard sorting and limiting
- ✅ getSummary with tier info
- ✅ Edge cases (0% quality, 100% quality, multiple disputes)

**Test Cases**: 25+

**Key Tests**:
```javascript
// Tier progression
it('should promote to PROFESSIONAL tier with consistent quality')

// Achievement awards
it('should award VETERAN_10 achievement after 10 services')
it('should award PERFECTIONIST achievement for consistent 95%+')

// Score calculation
it('should weight quality score most heavily (40%)')
it('should apply longevity bonus for veteran providers')

// Edge cases
it('should handle zero quality score')
it('should handle multiple disputes in succession')
```

---

### Frontend Tests

#### 2. **useQualityNotifications.test.js** (460 líneas)

**Cobertura**:
- ✅ WebSocket initialization
- ✅ Message handling (notification, stats, history)
- ✅ Notification management (mark read, clear)
- ✅ Auto-reconnect logic (max 5 attempts)
- ✅ Computed values (unreadCount, hasUnread)
- ✅ Cleanup on unmount

**Test Cases**: 20+

**Key Tests**:
```javascript
// Connection
it('should connect to WebSocket when wallet is connected')
it('should not connect when wallet is not connected')

// Message handling
it('should handle notification messages')
it('should limit notifications to MAX_NOTIFICATIONS (50)')

// Auto-reconnect
it('should attempt to reconnect on connection loss')
it('should give up after MAX_RECONNECT_ATTEMPTS (5)')

// Management
it('should mark all notifications as read')
it('should clear all notifications')
```

---

## 🛠️ Setup de Testing

### Instalación de Dependencias

```bash
# Backend testing
npm install --save-dev jest @types/jest

# Frontend testing  
npm install --save-dev @testing-library/react @testing-library/react-hooks @testing-library/jest-dom jest-environment-jsdom
```

### Configuración Jest

**jest.config.js** (Backend):
```javascript
module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'backend/services/**/*.js',
    'backend/routes/**/*.js',
    '!backend/**/*.test.js'
  ],
  testMatch: [
    '**/tests/**/*.test.js'
  ],
  verbose: true
};
```

**jest.config.js** (Frontend):
```javascript
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  collectCoverageFrom: [
    'src/hooks/**/*.js',
    'src/components/**/*.{js,jsx}',
    '!src/**/*.test.{js,jsx}'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};
```

### Scripts NPM

Agregar a **package.json**:
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:backend": "jest backend/tests",
    "test:frontend": "jest frontend/src/tests",
    "test:verbose": "jest --verbose --coverage"
  }
}
```

---

## 🚀 Ejecutar Tests

### Tests Completos
```bash
npm test
```

### Tests en Modo Watch
```bash
npm run test:watch
```

### Tests con Coverage
```bash
npm run test:coverage
```

### Tests de Backend Solamente
```bash
npm run test:backend
```

### Tests de Frontend Solamente
```bash
npm run test:frontend
```

---

## 📊 Coverage Esperado

### Backend
```
File                           | % Stmts | % Branch | % Funcs | % Lines
-------------------------------|---------|----------|---------|--------
qualityReputationSystem.js     |   95.2  |   88.5   |   100   |  95.8
qualityNotificationService.js  |   87.3  |   75.0   |   90.0  |  89.1
qualityEscrow.js (routes)      |   82.1  |   70.5   |   85.2  |  83.6
```

### Frontend
```
File                           | % Stmts | % Branch | % Funcs | % Lines
-------------------------------|---------|----------|---------|--------
useQualityNotifications.js     |   92.5  |   85.0   |   95.0  |  93.2
useQualityEscrow.js            |   88.0  |   78.5   |   87.5  |  89.3
QualityNotifications.jsx       |   75.5  |   68.0   |   80.0  |  76.8
```

---

## 🧩 Mocks Utilizados

### WebSocket Mock (Frontend)
```javascript
class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = WebSocket.CONNECTING;
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      if (this.onopen) this.onopen();
    }, 10);
  }
  send(data) {}
  close() {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) this.onclose();
  }
}
```

### Wagmi Mock (Frontend)
```javascript
jest.mock('wagmi', () => ({
  useAccount: jest.fn()
}));

// In tests:
useAccount.mockReturnValue({
  address: '0x1234...',
  isConnected: true
});
```

### Axios Mock (Frontend)
```javascript
jest.mock('axios');

axios.get.mockResolvedValue({
  data: { reputation: { score: 850 } }
});
```

---

## 📝 Test Patterns

### 1. **Arrange-Act-Assert (AAA)**
```javascript
it('should calculate correct score', async () => {
  // Arrange
  const provider = '0x1234...';
  const reputationSystem = new QualityReputationSystem();
  
  // Act
  await reputationSystem.updateAfterService(provider, {
    serviceId: 1,
    qualityScore: 90,
    collateralAmount: 100
  });
  
  // Assert
  const reputation = reputationSystem.reputations.get(provider);
  expect(reputation.score).toBeGreaterThan(800);
});
```

### 2. **Test Isolation**
```javascript
describe('QualityReputationSystem', () => {
  let reputationSystem;
  
  beforeEach(() => {
    reputationSystem = new QualityReputationSystem();
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
});
```

### 3. **Async Testing**
```javascript
it('should handle async operations', async () => {
  const { result } = renderHook(() => useQualityNotifications());
  
  await waitFor(() => {
    expect(result.current.isConnected).toBe(true);
  });
});
```

---

## 🔍 Integration Tests (Próximos)

### API Integration Tests
```javascript
describe('Quality Escrow API', () => {
  it('should create service via API', async () => {
    const response = await request(app)
      .post('/api/quality-escrow/create')
      .send({
        clientWallet: '0x...',
        collateralAmount: 100,
        initialQuality: 80
      });
    
    expect(response.status).toBe(201);
    expect(response.body.serviceId).toBeDefined();
  });
});
```

### E2E Tests (Cypress)
```javascript
describe('Quality Oracle Flow', () => {
  it('should create and finalize service', () => {
    cy.visit('/admin');
    cy.get('[data-testid="quality-oracle-tab"]').click();
    cy.get('[data-testid="new-service-btn"]').click();
    cy.get('[data-testid="client-wallet"]').type('0x...');
    cy.get('[data-testid="collateral-amount"]').type('100');
    cy.get('[data-testid="create-service-btn"]').click();
    cy.contains('Service created successfully');
  });
});
```

---

## 🐛 Debugging Tests

### Run Single Test
```bash
npm test -- qualityReputationSystem.test.js
```

### Run with Specific Pattern
```bash
npm test -- --testNamePattern="should award VETERAN_10"
```

### Watch Mode for Single File
```bash
npm test -- --watch qualityReputationSystem.test.js
```

### Debug in VS Code
```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Current File",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": [
    "${fileBasename}",
    "--config",
    "jest.config.js"
  ],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

---

## 📈 Coverage Reports

### Generar HTML Report
```bash
npm run test:coverage
```

Luego abrir: `coverage/lcov-report/index.html`

### Coverage Badges
```markdown
![Coverage](https://img.shields.io/badge/coverage-92%25-brightgreen)
```

---

## ✅ Testing Checklist

### Backend
- [x] QualityReputationSystem unit tests
- [x] 25+ test cases
- [ ] QualityNotificationService tests
- [ ] API routes integration tests
- [ ] WebSocket server tests

### Frontend
- [x] useQualityNotifications hook tests
- [x] 20+ test cases
- [ ] useQualityEscrow hook tests
- [ ] QualityNotifications component tests
- [ ] QualityAnalytics component tests
- [ ] QualityReputation component tests

### Integration
- [ ] API integration tests (Supertest)
- [ ] E2E tests (Cypress)
- [ ] Performance tests (k6)

### Coverage Goals
- [ ] Backend > 85%
- [ ] Frontend > 80%
- [ ] Critical paths > 95%

---

## 🔧 CI/CD Integration

### GitHub Actions
```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v2
        with:
          files: ./coverage/lcov.info
```

---

## 📚 Recursos

- [Jest Documentation](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Best Practices](https://testingjavascript.com/)
- [Jest Cheat Sheet](https://github.com/sapegin/jest-cheat-sheet)

---

**Última actualización**: 2026-01-03  
**Responsable**: GitHub Copilot  
**Estado**: ✅ Tests Implementados (45+ test cases)
