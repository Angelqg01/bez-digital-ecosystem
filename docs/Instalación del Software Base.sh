# 1. Actualizar sistema e instalar herramientas base
sudo apt update && sudo apt upgrade -y
sudo apt install -y build-essential jq curl git make tmux liblz4-tool software-properties-common

# 2. Instalar Docker y Docker Compose
sudo apt install -y docker.io docker-compose-plugin
sudo systemctl enable docker && sudo systemctl start docker
sudo usermod -aG docker $USER

# 3. Instalar Golang (Lenguaje del OP Stack)
wget https://go.dev/dl/go1.21.6.linux-amd64.tar.gz
sudo rm -rf /usr/local/go && sudo tar -C /usr/local -xzf go1.21.6.linux-amd64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
source ~/.bashrc

# 4. Instalar Node.js (v20) y Yarn (Para el Panel de Control y Scripts)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install --global yarn pnpm pm2

# 5. Instalar Foundry (Compilador de Smart Contracts)
curl -L https://foundry.paradigm.xyz | bash
source ~/.bashrc
foundryup