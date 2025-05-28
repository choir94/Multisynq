# Multisynq Synqchronize

> **Note:** This tutorial is intended for **Ubuntu/Debian**-based systems. You don't need to be logged in as root (use `sudo` only when necessary).

---
## First Join: Connect Phantom Wallet

[Click here to join and connect your new Phantom Wallet](https://startsynqing.com/?ref=904dd5-drcp33)

**Input code:** `drinktheblue`


## 1. Install Docker

### Update and install dependencies
```bash
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl gnupg lsb-release
```

### Add Docker's official GPG key and repository
```bash
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
```

```bash
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

### Install Docker and Compose Plugin
```bash
sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

### Test Docker installation
```bash
sudo docker run hello-world
```

---

## 2. Install Node.js via NVM

### Download and install NVM
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
```

### Activate NVM in the current shell
```bash
export NVM_DIR="$HOME/.nvm"
source "$NVM_DIR/nvm.sh"
```

> Or logout and log back in to automatically activate via `.bashrc` or `.zshrc`.

### Install Node.js version 20
```bash
nvm install 20
nvm use 20
nvm alias default 20
```

### Check version
```bash
node -v
npm -v
```

---

## 3. Install Synqchronize (Global)

### Install Synqchronizer globally
```bash
npm install -g synqchronizer
```

---

```bash
echo $PATH
```

```bash
npm config get prefix
```
```bash
export PATH="$(npm config get prefix)/bin:$PATH"
```
## 4. Configure Synqchronize

### Initialize configuration
```bash
synqchronize init  
```
> Follow the prompts and input the required account information.

---

## 5. Run Synqchronize as a Systemd Service


### Setup Synqchronize service
```bash
synqchronize service
```

### Copy the service file to the systemd directory
```bash
sudo cp ~/.synqchronizer/synqchronizer.service /etc/systemd/system/
```

### Reload systemd and enable the service
```bash
sudo systemctl daemon-reload
sudo systemctl enable synqchronizer
sudo systemctl start synqchronizer
```

### Verify service status
```bash
sudo systemctl status synqchronizer
```

---

## 6. Access Web Dashboard

### Open port 3000 in the VPS firewall (if needed)
```bash
sudo ufw allow 3000/tcp
```

### Run the dashboard (optional)
```bash
synqchronize web
```

Then access:
```
http://<YOUR_VPS_IP>:3000
```

---

## 7. Monitoring and Management

- Check node status:
  ```bash
  synqchronize status
  ```
- View service logs:
  ```bash
  sudo journalctl -u synqchronizer -f
  ```

---

## Community

- Telegram: [https://t.me/airdrop_node](https://t.me/airdrop_node)

- Join discord to claim role [https://discord.gg/QTBBCVPw]
(https://discord.gg/QTBBCVPw)

