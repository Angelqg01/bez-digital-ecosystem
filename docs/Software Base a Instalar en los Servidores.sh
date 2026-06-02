# 1. Actualizar el sistema y dependencias básicas
sudo apt update && sudo apt upgrade -y
sudo apt install -y build-essential jq curl git make tmux liblz4-tool

# 2. Instalar Golang (El lenguaje en el que está escrita la blockchain)
wget https://go.dev/dl/go1.21.6.linux-amd64.tar.gz
sudo rm -rf /usr/local/go && sudo tar -C /usr/local -xzf go1.21.6.linux-amd64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
source ~/.bashrc

# 3. Instalar Docker y Docker Compose (Para aislar los servicios)
sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER

# 4. Instalar Node.js y Yarn (Para los scripts de despliegue)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
npm install --global yarn

# 5. Instalar Foundry (Suite de herramientas de Smart Contracts)
curl -L https://foundry.paradigm.xyz | bash
source ~/.bashrc
foundryup