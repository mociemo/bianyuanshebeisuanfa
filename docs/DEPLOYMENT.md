# 区块链身份认证系统 部署指南

## 系统要求

- Node.js >= 16.0.0
- Redis >= 5.0
- Git

## 开发环境部署

### 1. 克隆项目

```bash
git clone <repository-url>
cd shenfenrz
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

复制 `.env.example` 为 `.env` 并配置:

```env
# 服务器配置
PORT=3000
NODE_ENV=development

# 区块链配置
CONTRACT_ADDRESS=0x...
RPC_URL=http://localhost:8545
PRIVATE_KEY=your_private_key

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# 缓存配置
CACHE_TTL=300

# 日志配置
LOG_LEVEL=INFO
```

### 4. 启动本地区块链

```bash
npm run node
```

保持此终端运行。

### 5. 部署智能合约

在新终端中运行:

```bash
npm run deploy
```

记录输出的合约地址,更新到 `.env` 文件的 `CONTRACT_ADDRESS`。

### 6. 启动服务器

```bash
npm start
```

### 7. 访问应用

打开浏览器访问: `http://localhost:3000`

---

## 生产环境部署

### 1. 环境准备

#### 安装Redis (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis
sudo systemctl enable redis
```

#### 安装Redis (CentOS/RHEL)

```bash
sudo yum install redis
sudo systemctl start redis
sudo systemctl enable redis
```

### 2. 配置生产环境

```env
# .env
PORT=3000
NODE_ENV=production
LOG_LEVEL=WARN

# 使用安全的RPC端点
RPC_URL=https://mainnet.infura.io/v3/YOUR_KEY

# 使用强密码
REDIS_PASSWORD=your_strong_password
```

### 3. 使用PM2部署

#### 安装PM2

```bash
npm install -g pm2
```

#### 启动应用

```bash
pm2 start server/index.js --name "blockchain-auth"
```

#### 设置开机自启

```bash
pm2 startup
pm2 save
```

#### 常用命令

```bash
pm2 list                    # 查看进程
pm2 logs blockchain-auth     # 查看日志
pm2 restart blockchain-auth  # 重启
pm2 stop blockchain-auth     # 停止
pm2 delete blockchain-auth   # 删除
```

### 4. 使用Nginx反向代理

#### 安装Nginx

```bash
sudo apt install nginx
```

#### 配置Nginx

创建 `/etc/nginx/sites-available/blockchain-auth`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

#### 启用配置

```bash
sudo ln -s /etc/nginx/sites-available/blockchain-auth /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## Docker部署

### 1. 创建Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

### 2. 创建docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - REDIS_HOST=redis
      - REDIS_PORT=6379
    depends_on:
      - redis
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

volumes:
  redis-data:
```

### 3. 构建并运行

```bash
docker-compose up -d
```

---

## 监控和日志

### 查看日志

```bash
# PM2日志
pm2 logs blockchain-auth

# 应用日志
tail -f logs/app.log

# 错误日志
tail -f logs/error.log
```

### 性能监控

```bash
# PM2监控
pm2 monit

# 系统资源
htop
```

---

## 测试

### 运行测试

```bash
# 运行所有测试
npm test

# 运行服务器测试
npm run test:server

# 监听模式
npm run test:watch
```

### 查看覆盖率

```bash
npm run test:server -- --coverage
```

---

## 备份和恢复

### 数据库备份

```bash
# 备份SQLite数据库
cp data/auth.db data/auth.db.backup

# 恢复
cp data/auth.db.backup data/auth.db
```

### Redis备份

```bash
# 备份Redis数据
redis-cli SAVE
cp /var/lib/redis/dump.rdb backup/

# 恢复
systemctl stop redis
cp backup/dump.rdb /var/lib/redis/
systemctl start redis
```

---

## 故障排查

### 问题1: Redis连接失败

```bash
# 检查Redis状态
systemctl status redis

# 测试连接
redis-cli ping
```

### 问题2: 区块链连接失败

```bash
# 检查Hardhat节点
npx hardhat node

# 验证合约地址
grep CONTRACT_ADDRESS .env
```

### 问题3: 端口被占用

```bash
# 查看端口占用
netstat -tlnp | grep 3000

# 更换端口
export PORT=3001
```

---

## 安全建议

1. **使用HTTPS** - 配置SSL证书
2. **限制API访问** - 使用防火墙和API网关
3. **定期更新** - 保持依赖包最新
4. **备份策略** - 定期备份数据库和配置
5. **监控告警** - 设置异常行为告警

---

## 性能优化

### 1. 缓存策略

根据业务场景调整 `CACHE_TTL`:
- 高频访问: 600-1800秒
- 中频访问: 300-600秒
- 低频访问: 60-300秒

### 2. 数据库优化

```sql
-- 创建索引
CREATE INDEX idx_auth_logs_device ON auth_logs(device_address);
CREATE INDEX idx_auth_logs_time ON auth_logs(created_at);
```

### 3. Redis优化

```conf
# redis.conf
maxmemory 256mb
maxmemory-policy allkeys-lru
```

---

## 支持

如遇问题,请查看:
- 日志文件: `logs/app.log`
- 错误日志: `logs/error.log`
- GitHub Issues
