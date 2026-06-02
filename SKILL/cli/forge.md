# Forge CLI Reference — BeZhas Blockchain
> Comandos de Foundry para el proyecto

## Ruta del Ejecutable
```powershell
$FORGE = "$env:USERPROFILE\.foundry\bin\forge.exe"
# No está en PATH — siempre usar ruta completa
```

## Compilación
```powershell
# Compilar todo
& $FORGE build

# Compilar con sizes
& $FORGE build --sizes

# Compilar archivo específico
& $FORGE build --match-path src/wallet/SmartWallet.sol
```

## Tests
```powershell
# Ejecutar todos los tests
& $FORGE test

# Tests con verbose (stack traces)
& $FORGE test -vvv

# Test específico por archivo
& $FORGE test --match-path test/SmartWalletTest.t.sol

# Test específico por nombre
& $FORGE test --match-test "test_CreateWallet"

# Test con gas report
& $FORGE test --gas-report

# Fuzz runs (default 256)
& $FORGE test --fuzz-runs 1000
```

## Deploy
```powershell
# Deploy a local
& $FORGE script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast

# Deploy con verificación
& $FORGE script script/Deploy.s.sol --rpc-url $RPC --broadcast --verify
```

## Utilidades
```powershell
# Verificar contratos compilados
Get-ChildItem smart-contracts/out -Directory | Select-Object Name

# Contar contratos
(Get-ChildItem smart-contracts/src -Recurse -Filter "*.sol").Count

# Contar tests
(Get-ChildItem smart-contracts/test -Recurse -Filter "*.t.sol").Count

# ABI de un contrato
Get-Content smart-contracts/out/SmartWallet.sol/SmartWallet.json | ConvertFrom-Json | Select-Object -ExpandProperty abi
```

## Foundry Config (foundry.toml)
```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
via_ir = true
optimizer = true
optimizer_runs = 200

[profile.default.lint]
# Warnings (no errors)
# unsafe-typecast, erc20-unchecked-transfer
```

## Notas
- forge nightly retorna exit code 1 por lint warnings — tests pasan correctamente
- `via_ir = true` es necesario para compilar contratos complejos
- `optimizer_runs = 200` balance entre gas de deploy y gas de ejecución
