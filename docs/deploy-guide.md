# 后端部署到阿里云服务器 · 手把手教程

> 适用于本项目（Comuni 职途 / 职引星途）后端：
> Django 5.2 + DRF + Celery + Redis + PostgreSQL，AI 使用 DeepSeek 云端 API。
>
> 部署目标：一个能公网访问的 HTTPS 后端，供微信小程序调用。
> 阅读顺序 = 操作顺序，命令可直接复制（路径/域名/密码需替换成你自己的）。

---

## 〇、先想清楚 3 件事（不然后面会返工）

### 1. 服务器规格

| 项 | 建议 |
|---|---|
| 配置 | **2 核 4G 起步**（推荐 4 核 8G）；低配先用 2 核 4G + 2G swap |
| 系统 | **Ubuntu 24.04 LTS**（自带 Python 3.12，和本地一致）或 Alibaba Cloud Linux 3 |
| 磁盘 | 40G 以上（依赖体积较大） |
| 地域 | 大陆地域需 ICP 备案；**比赛演示建议选香港地域（免备案）** |

> 为什么吃内存：Django + Gunicorn + Celery + PostgreSQL + Redis 全跑一台机器；
> 依赖里还有 chromadb 等较重的包。

### 2. 域名与备案（决定你多久能上线）

- **微信小程序要求后端必须是 HTTPS + 已备案域名**（大陆服务器）；
- 大陆地域：买域名 → 阿里云提交 **ICP 备案**（一般 1~2 周）→ 才能用 80/443；
- **香港/海外地域**：免备案，可直接用域名 + 443（比赛 Demo 首选，速度稍慢但可用）；
- 没域名时：可以用服务器公网 IP 先调通接口（小程序真机仍然需要 HTTPS 域名，开发者工具可开"不校验合法域名"临时调试）。

### 3. 阿里云要提前准备什么

1. 一台 ECS 实例（或轻量应用服务器，二者操作方式基本一致）；
2. **安全组**放行：`22`（SSH）、`80`（HTTP）、`443`（HTTPS）——**不要**放行 5432 / 6379；
3. 一个域名（可选，但强烈建议）；
4. 免费 SSL 证书：阿里云「数字证书管理服务」免费 DV 证书（下载 Nginx 版），或个人用 Let's Encrypt（本文用 certbot，二选一）。

---

## 一、登录服务器、做基础安全

### 1.1 创建实例并登录

阿里云控制台 → ECS → 创建实例（选 Ubuntu 24.04）→ 设置 root 密码或绑定密钥 → 获取公网 IP。

在本机 PowerShell 登录：

```powershell
ssh root@你的公网IP
# 首次会提示 yes 确认指纹
```

### 1.2 新建普通用户（不要一直用 root）

```bash
adduser deploy                     # 交互式设置密码
usermod -aG sudo deploy
su - deploy                        # 切换过去，后续都用 deploy
```

### 1.3 可选：配置 SSH 免密（本机生成密钥并上传）

```powershell
# 本机执行
ssh-keygen -t ed25519 -C "deploy@comuni"
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh root@你的公网IP "cat >> /home/deploy/.ssh/authorized_keys"
```

### 1.4 系统更新 + 时区

```bash
sudo apt update && sudo apt -y upgrade
sudo timedatectl set-timezone Asia/Shanghai
```

### 1.5 低配服务器加 swap（2 核 4G 强烈建议）

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h   # 确认 Swap 2G
```

---

## 二、安装运行环境

### 2.1 基础软件

```bash
sudo apt -y install python3 python3-venv python3-pip git nginx redis-server \
  build-essential libpq-dev curl
python3 --version    # 应显示 3.12.x（Ubuntu 24.04）
```

### 2.2 安装 PostgreSQL 18（与本地版本一致，便于导入数据）

Ubuntu 24.04 默认源是 PostgreSQL 16；要 18 需加官方源：

```bash
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/pgdg.gpg
sudo apt update && sudo apt -y install postgresql-18
```

> 不想折腾 18 也可以直接用 `sudo apt install postgresql`（16），项目用的都是标准特性，不影响运行；**但若要导入本地数据，建议版本一致**。

### 2.3 创建数据库和用户

```bash
sudo -u postgres psql
```

在 psql 里执行（密码换成你自己的）：

```sql
CREATE DATABASE comuni;
CREATE USER comuni_user WITH PASSWORD '换成强密码';
ALTER ROLE comuni_user SET client_encoding TO 'utf8';
ALTER ROLE comuni_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE comuni_user SET timezone TO 'Asia/Shanghai';
GRANT ALL PRIVILEGES ON DATABASE comuni TO comuni_user;
\q
```

### 2.4 配置 Redis（设置密码 + 只监听本机）

```bash
sudo nano /etc/redis/redis.conf
```

修改两处：

```
bind 127.0.0.1 -::1
requirepass 换成你的Redis密码
```

```bash
sudo systemctl restart redis-server
redis-cli -a 你的Redis密码 ping     # 应返回 PONG
```

> 项目 settings 里的 `REDIS_PASSWORD` 必须和这里一致，否则缓存、Celery 全都连不上。

---

## 三、把代码放到服务器

### 方案 A（推荐）：先建远程仓库再 git clone

后端仓库目前**没有远端**。先在本机：

```powershell
# 在 E:\projects\L_y_comuni\comuni_bakcend 下
git remote add origin https://gitee.com/你的账号/comuni-bakcend.git   # 或 GitHub 私有库
git push -u origin main
```

服务器上：

```bash
cd /home/deploy
git clone https://gitee.com/你的账号/comuni-bakcend.git comuni-bakcend
```

> 私有库建议用访问令牌（token）方式拉取，或临时改公钥。

### 方案 B：打包上传（不建仓库也能部署）

本机 PowerShell：

```powershell
cd E:\projects\L_y_comuni
tar -czf comuni-backend.tar.gz --exclude=comuni_bakcend\.venv --exclude=comuni_bakcend\media `
    --exclude=comuni_bakcend\__pycache__ --exclude=comuni_bakcend\.git comuni_bakcend
scp .\comuni-backend.tar.gz deploy@你的公网IP:/home/deploy/
```

服务器上：

```bash
cd /home/deploy
tar -xzf comuni-backend.tar.gz
mv comuni_bakcend comuni-backend
```

> `.env` 不要进 git、也不要打进压缩包：用 scp 单独传，或按第四步在服务器上新建。

---

## 四、配置 .env（最关键的一步）

项目 `setsite/settings.py` 用 `load_dotenv()` 读取**项目根目录**的 `.env`，
所以你必须在 `comuni-backend/.env` 放配置。**缺 `SECRET_KEY` / `ALLOWED_HOSTS` / `CSRF_TRUSTED_ORIGINS` 会直接 500。**

服务器上创建：

```bash
cd /home/deploy/comuni-backend
nano .env
```

内容模板（逐项按你实际情况改）：

```ini
# ---------- Django ----------
SECRET_KEY=换成一串随机长字符串
DEBUG=False
ALLOWED_HOSTS=你的公网IP,你的域名.com,www.你的域名.com
CSRF_TRUSTED_ORIGINS=https://你的域名.com,https://www.你的域名.com

# ---------- 数据库 ----------
POSTGRESQL_NAME=comuni
POSTGRESQL_USER=comuni_user
POSTGRESQL_PASSWORD=你的数据库密码
POSTGRESQL_HOST=127.0.0.1
POSTGRESQL_PORT=5432

# ---------- Redis / Celery ----------
REDIS_URL=redis://127.0.0.1:6379/1
REDIS_PASSWORD=你的Redis密码
CELERY_BROKER_URL=redis://:你的Redis密码@127.0.0.1:6379/2
CELERY_RESULT_BACKEND=redis://:你的Redis密码@127.0.0.1:6379/3

# ---------- AI ----------
DEEPSEEK_API_KEY=你的DeepSeek密钥
DEEPSEEK_API_URL=https://api.deepseek.com/chat/completions
DEEPSEEK_MODEL=deepseek-chat

# ---------- 小程序（启用微信登录时填） ----------
APP_ID=你的小程序AppID
APP_SECRET=你的小程序AppSecret

# ---------- 邮件（找回密码；不启用可留空，但键要存在） ----------
EMAIL_HOST=smtp.qq.com
EMAIL_PORT=465
EMAIL_HOST_USER=
EMAIL_HOST_PASSWORD=
EMAIL_USE_SSL=True
```

生成随机 SECRET_KEY（服务器执行）：

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(50))"
```

权限收紧：

```bash
chmod 600 .env
```

---

## 五、安装 Python 依赖

```bash
cd /home/deploy/comuni-backend
python3 -m venv .venv
source .venv/bin/activate
pip config set global.index-url https://mirrors.aliyun.com/pypi/simple/   # 阿里云镜像加速
pip install --upgrade pip wheel
pip install -r requirements.txt
```

> 依赖里有 chromadb 等较重包，2 核 4G 上首次安装约 5~10 分钟；若内存不足被 kill，
> 先加 swap（第 1.5 步）再重试。
> 只部署核心功能、想省时的话，可以先装最小集合：
> `pip install Django djangorestframework djangorestframework-simplejwt django-cors-headers django-redis celery redis psycopg psycopg2-binary python-dotenv requests pillow`，
> 缺什么装什么（例如 simpleui、channels）。

---

## 六、初始化数据库与静态文件

```bash
cd /home/deploy/comuni-backend
source .venv/bin/activate

python manage.py migrate
python manage.py createsuperuser       # 后台管理员
python manage.py collectstatic --noinput

# 媒体目录（头像等上传文件）
mkdir -p media
chmod 755 media
```

### 可选：把本地数据导到服务器

本机（PostgreSQL 18）：

```powershell
pg_dump -U postgres -d comuni -F c -f comuni.dump
scp comuni.dump deploy@你的公网IP:/home/deploy/
```

服务器：

```bash
pg_restore -U comuni_user -d comuni --no-owner --no-privileges /home/deploy/comuni.dump
```

> 如果服务器是 PG16 而本地是 PG18，dump 可能包含高版本语法；稳妥做法是服务器也装 PG18（第 2.2 步）。

---

## 七、启动 Django（Gunicorn + systemd）

Django 自带的 runserver 不能用于生产，用 Gunicorn。

```bash
sudo apt -y install gunicorn
source .venv/bin/activate
pip install gunicorn
```

创建 systemd 服务：

```bash
sudo nano /etc/systemd/system/comuni.service
```

```ini
[Unit]
Description=Comuni Backend (Gunicorn)
After=network.target postgresql.service redis-server.service

[Service]
User=deploy
Group=deploy
WorkingDirectory=/home/deploy/comuni-backend
Environment="PATH=/home/deploy/comuni-backend/.venv/bin"
ExecStart=/home/deploy/comuni-backend/.venv/bin/gunicorn setsite.wsgi:application \
          --bind 127.0.0.1:8000 --workers 3 --threads 2 --timeout 120
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

> `WorkingDirectory` 必须是项目根目录——`.env` 要从这里被 `load_dotenv()` 读到。

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now comuni
sudo systemctl status comuni
```

**本地自检**（服务器上）：

```bash
curl -i http://127.0.0.1:8000/api/v1/knowledge/knowledgebase/my-knowledge-bases/
# 返回 401（未登录）就说明服务通了
```

---

## 八、启动 Celery Worker（别漏！）

我们踩过的真实坑：**Celery 不在跑时，画像解析/岗位解析/AI 问答任务只会排队，前端等 30 秒超时**。
所以一定要把 worker 也做成服务：

```bash
sudo nano /etc/systemd/system/comuni-celery.service
```

```ini
[Unit]
Description=Comuni Celery Worker
After=network.target redis-server.service

[Service]
User=deploy
Group=deploy
WorkingDirectory=/home/deploy/comuni-backend
Environment="PATH=/home/deploy/comuni-backend/.venv/bin"
ExecStart=/home/deploy/comuni-backend/.venv/bin/celery -A celery_config worker \
          -l info --concurrency 2 --max-tasks-per-child 50
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now comuni-celery
sudo systemctl status comuni-celery
journalctl -u comuni-celery -f     # 观察任务日志（Ctrl+C 退出）
```

> Linux 可以用多进程；若用 Windows 才必须 `--pool=solo`。
> 记得 `CELERY_BROKER_URL` 里带 Redis 密码，否则 worker 报 `AUTH failed`。

---

## 九、Nginx 反向代理 + 静态/媒体 + HTTPS

### 9.1 基础配置（先 HTTP 跑通）

```bash
sudo nano /etc/nginx/sites-available/comuni
```

```nginx
server {
    listen 80;
    server_name 你的域名.com www.你的域名.com;   # 没有域名可先写 _

    client_max_body_size 20m;                    # 头像等上传
    proxy_read_timeout 120s;

    # 静态文件（collectstatic 的产物）
    location /static/ {
        alias /home/deploy/comuni-backend/staticfiles/;
        expires 7d;
    }

    # 媒体文件（DEBUG=False 时 Django 不再处理，必须 Nginx 提供）
    location /media/ {
        alias /home/deploy/comuni-backend/media/;
        expires 7d;
    }

    # API 转发给 Gunicorn
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

启用：

```bash
sudo ln -s /etc/nginx/sites-available/comuni /etc/nginx/sites-enabled/comuni
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

验证（服务器或本机）：

```bash
curl -i http://你的域名.com/api/v1/knowledge/knowledgebase/my-knowledge-bases/
```

### 9.2 配 HTTPS（二选一）

**方式 A：阿里云免费证书（推荐比赛用）**

1. 阿里云控制台 → 数字证书管理服务 → 免费证书 → 申请（绑定你的域名）；
2. 下载 **Nginx** 格式，得到 `xxx.pem` 和 `xxx.key`；
3. 上传到服务器：`/etc/nginx/ssl/`（root 权限，`chmod 600`）；
4. Nginx 配置里改成：

```nginx
server {
    listen 443 ssl;
    server_name 你的域名.com;
    ssl_certificate     /etc/nginx/ssl/你的.pem;
    ssl_certificate_key /etc/nginx/ssl/你的.key;
    ssl_protocols TLSv1.2 TLSv1.3;

    client_max_body_size 20m;
    location /static/ { alias /home/deploy/comuni-backend/staticfiles/; }
    location /media/  { alias /home/deploy/comuni-backend/media/; }
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
server {
    listen 80;
    server_name 你的域名.com;
    return 301 https://$host$request_uri;
}
```

**方式 B：Let's Encrypt（自动续期）**

```bash
sudo apt -y install certbot python3-certbot-nginx
sudo certbot --nginx -d 你的域名.com -d www.你的域名.com
```

验证证书自动续期：`sudo certbot renew --dry-run`。

`ALLOWED_HOSTS` / `CSRF_TRUSTED_ORIGINS` 记得包含域名与 https 前缀（第 4 步已写）。

---

## 十、完整验证清单（按顺序打勾）

| # | 检查 | 命令/操作 | 期望 |
|---|---|---|---|
| 1 | 服务状态 | `systemctl status comuni comuni-celery nginx` | 全部 active |
| 2 | 断言之：接口可达 | `curl -i https://你的域名.com/api/v1/knowledge/knowledgebase/my-knowledge-bases/` | 401（未登录） |
| 3 | 登录 | 用测试账号 POST `/api/v1/auth/password/login/` | 返回 token |
| 4 | 登录后列表 | 带 `Authorization: JWT <token>` 再请求 #2 | 200 + 数据 |
| 5 | AI 画像解析 | 提交解析任务并轮询 | 数秒出结果（Celery 正常） |
| 6 | 媒体上传 | 上传头像后访问 `/media/...` | 图片能打开 |
| 7 | 静态资源 | 打开 `/static/` 下任意文件 | 200 |
| 8 | Celery 日志 | `journalctl -u comuni-celery -n 50` | 有任务 received/succeeded |

---

## 十一、小程序前端切到线上

代码里基址集中在 `src/utils/request.ts`：

```ts
const USE_LOCAL_API = false;   // 改成 false
export const baseURL = USE_LOCAL_API ? 'http://localhost:8000' : 'https://yourdomain.com';
```

然后：

1. `npm run build:mp-weixin` 重新构建，微信开发者工具重新导入 `dist/build/mp-weixin`；
2. **微信公众平台 → 开发管理 → 服务器域名**：
   - request 合法域名：`https://你的域名.com`
   - uploadFile / downloadFile 合法域名：同样加上（头像上传、图片加载走这个）
   - 别忘了图片 CDN 域名 `https://youupro.xyz` 也要加入 downloadFile 白名单（否则线上图片加载失败）
3. 域名必须是 **HTTPS**，且大陆服务器需已备案；香港服务器无需备案。
4. 真机测试前，在开发者工具里先「不校验合法域名」确认接口没问题，再切正式校验。

---

## 十二、日常运维速查

```bash
# 查看日志
journalctl -u comuni -n 100 --no-pager
journalctl -u comuni-celery -n 100 --no-pager
sudo tail -f /var/log/nginx/error.log

# 改代码后更新（方案 A）
cd /home/deploy/comuni-backend
git pull
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
sudo systemctl restart comuni comuni-celery

# 数据库备份（建议每天 cron）
pg_dump -U comuni_user -d comuni -F c > /home/deploy/backup_$(date +%F).dump
# 加进 crontab（每天凌晨 3 点）：
# 0 3 * * * pg_dump -U comuni_user -d comuni -F c > /home/deploy/backup_$(date +\%F).dump
```

---

## 十三、常见坑（都是本项目真实踩过的）

| 现象 | 原因 | 解决 |
|---|---|---|
| 接口 400 `Invalid HTTP_HOST` | `.env` 的 `ALLOWED_HOSTS` 没加域名/IP | 补上域名与 IP |
| POST 报 CSRF `Origin checking failed` | `CSRF_TRUSTED_ORIGINS` 缺失或不含 `https://域名` | 补 https 前缀 |
| 画像生成一直转圈 30 秒后失败 | **Celery Worker 没启动**（任务只入队不消费） | `systemctl start comuni-celery` 并 `enable` |
| 缓存/任务报 `AUTH failed` | Redis 有密码，但 `REDIS_PASSWORD`/`CELERY_BROKER_URL` 不一致 | 三处密码保持一致 |
| `/media/...` 404 | `DEBUG=False` 时 Django 不再提供媒体文件 | Nginx 配 `location /media/` |
| 上传头像 413 | Nginx 默认 1MB 限制 | `client_max_body_size 20m;` |
| 小程序真机接口失败 | 没配合法域名 / 认证证书未生效 | 微信后台配置 + https 生效 |
| 依赖安装被 Killed | 内存不足 | 加 swap 或换更大内存 |
| 后台样式丢失 | 没跑 `collectstatic` | 执行并检查 `/static/` 映射 |

---

## 十四、最短路径（比赛演示版）

如果你只想在比赛前快速跑通：

1. 阿里云香港地域 → Ubuntu 24.04 → 2C4G；
2. 安全组开 22/80/443；
3. `apt install python3-venv nginx redis-server postgresql build-essential libpq-dev`；
4. 建库建用户、Redis 设密码；
5. `scp` 上传代码（方案 B）；
6. 写 `.env`（域名换成 IP 也行，但小程序真机要 HTTPS 域名）；
7. `venv` + `pip install` + `migrate` + `collectstatic`；
8. Gunicorn + Celery 两个 systemd 服务；
9. Nginx 反代 + certbot 上 HTTPS（有域名的话）；
10. 前端 `USE_LOCAL_API=false` + 域名白名单，重新构建。
