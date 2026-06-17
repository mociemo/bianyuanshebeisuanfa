# 部署指南

本项目包含两个独立方案和一个对比前端。各组件需分别在各自目录下部署。

## 架构要求

### scheme-a（复现方案）
- Node.js 18+
- MongoDB（本地或远程）
- Polygon / 以太坊 RPC 节点

### scheme-7（改进方案）
- Node.js 18+
- Polygon / 以太坊 RPC 节点
- **不需要** MongoDB

### 对比前端
- Node.js 18+

---

## 本地开发部署

### 1. scheme-7（改进方案，端口 3000）

```bash
cd scheme-7

# 安装依赖
npm install
npx hardhat compile

# 终端 1：启动本地区块链
npm run node

# 终端 2：部署合约（待 node 启动后执行）
npm run deploy
# 将输出的 CONTRACT_ADDRESS 写入 .env

# 终端 3：启动服务器
npm start
```

访问 http://localhost:3000

### 2. scheme-a（复现方案，端口 3001）

```bash
cd scheme-a

# 安装依赖
npm install
npx hardhat compile

# 确保 MongoDB 已启动
# 终端 1：本地区块链（如果与 scheme-7 共用则跳过）
npm run node

# 终端 2：部署合约
npm run deploy
# 将输出的 CONTRACT_ADDRESS 写入 .env

# 终端 3：启动服务器
npm start
```

访问 http://localhost:3001

### 3. 对比前端（端口 8080）

```bash
cd frontend

# 安装依赖
npm install

# 启动
npm start
```

访问 http://localhost:8080（自动跳转到对比页面）

---

## 环境变量配置

### scheme-7 `.env`

位置：`scheme-7/.env`

```env
BLOCKCHAIN_URL=http://127.0.0.1:8545
CONTRACT_ADDRESS=0x...
PORT=3000
PUBKEY_TTL=3600              # 内存公钥有效期（秒）
OFFLINE_TIMESTAMP_WINDOW=60  # 离线时间窗（秒）
CHALLENGE_TTL=300
```

### scheme-a `.env`

位置：`scheme-a/.env`

```env
BLOCKCHAIN_URL=http://127.0.0.1:8545
CONTRACT_ADDRESS=0x...
MONGODB_URI=mongodb://127.0.0.1:27017/auth-db
PORT=3001
```

---

## Polygon 测试网部署

### 部署合约

在 `scheme-7/hardhat.config.js` 或 `scheme-a/hardhat.config.js` 中配置：

```javascript
networks: {
  amoy: {
    url: process.env.POLYGON_RPC_URL,
    accounts: [process.env.DEPLOYER_PRIVATE_KEY]
  }
}
```

```bash
cd scheme-7  # 或 cd scheme-a
npx hardhat run scripts/deploy.js --network amoy
```

### 配置边缘服务器

更新对应方案 `.env` 中的 `BLOCKCHAIN_URL` 和 `CONTRACT_ADDRESS`。

---

## PM2 部署

```bash
npm install -g pm2

# scheme-7
cd scheme-7
pm2 start server/index.js --name scheme-7

# scheme-a
cd scheme-a
pm2 start server/index.js --name scheme-a

# 对比前端
cd frontend
pm2 start server.js --name comparison-frontend

pm2 save
pm2 startup
```

---

## Docker（可选）

### scheme-7 Dockerfile

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3000
CMD ["node", "server/index.js"]
```

> 注意：容器重启会清空边缘内存，断网设备需重新联网预热公钥。

### scheme-a Dockerfile

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3001
CMD ["node", "server/index.js"]
```

> scheme-a 需要额外的 MongoDB 容器或外部 MongoDB 服务。

---

## Nginx 反向代理

```nginx
server {
    listen 443 ssl;
    server_name auth.example.com;

    location /scheme-7/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /scheme-a/ {
        proxy_pass http://127.0.0.1:3001/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        proxy_pass http://127.0.0.1:8080/;
        proxy_set_header Host $host;
    }
}
```

---

## 安全建议

1. 生产环境禁用开发接口（`NODE_ENV=production`）
2. 使用 HTTPS
3. 合约 owner 私钥与边缘服务器分离保管
4. 设备私钥仅存于设备端，演示接口不可用于生产
5. 定期审计合约与依赖

---

## 故障排查

| 问题 | 处理 |
|------|------|
| 注册失败 | 检查 `CONTRACT_ADDRESS`、RPC 连通性 |
| 认证 nonce 错误 | 先 `GET /nonce/:address` 获取最新值 |
| 离线认证失败 | 确认已执行 challenge 预热且未重启边缘服务 |
| 公钥缓存过期 | 重新联网调用 `/challenge/:address?refresh=true` |
| scheme-a 注册失败 | 确认 MongoDB 已启动且连接正常 |
| 端口冲突 | scheme-7 默认 3000，scheme-a 默认 3001，前端 8080 |
