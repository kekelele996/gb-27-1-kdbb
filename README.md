# 在线课堂平台

一个支持直播授课与录播回放的在线课堂平台，面向 K12 及职业培训机构。

## 项目主要功能

- **用户管理与角色系统**：支持学生、教师、管理员三种角色注册登录，教师资质认证审核
- **课程管理**：教师可创建课程（含封面、简介、定价、课时列表），支持免费/付费课、按分类标签检索
- **直播授课**：实时直播课堂，支持屏幕共享、电子白板、课件展示、弹幕互动、举手发言
- **录播回放**：直播结束自动生成录播，支持倍速播放（0.5x-2.0x）和进度条拖拽
- **课堂签到与考勤**：直播过程发起签到，自动生成考勤报表，支持导出 Excel
- **作业系统**：教师布置作业（文本/选择/附件），学生在线提交，教师批改评分
- **学习数据统计**：教师和学生数据看板，销量、出勤率、作业完成率、学习时长等

## 快速启动（Docker Compose）

```bash
# 一键启动所有服务
docker compose up -d

# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f

# 停止服务
docker compose down
```

## 本地开发

### 前端开发

```bash
cd frontend
npm install
npm run dev
```

### 后端开发

```bash
cd backend
npm install
npm run start:dev
```

> 本地开发需要确保 PostgreSQL、Redis、MinIO 服务已启动并配置好环境变量。

## 访问地址

| 服务 | 地址 | 说明 |
|------|------|------|
| 前端 | http://localhost:8001 | 在线课堂平台 |
| 后端 API | http://localhost:3001 | API 服务 |
| API 文档 | http://localhost:3001/api/docs | Swagger 文档 |
| PostgreSQL | localhost:5501 | 数据库（账号: postgres / postgres123） |
| Redis | localhost:6401 | 缓存服务 |
| MinIO 控制台 | http://localhost:9002 | 对象存储控制台（账号: minioadmin / minioadmin） |

## 技术栈

| 类别 | 技术 |
|------|------|
| 前端框架 | React 18 |
| 开发语言 | TypeScript |
| UI 组件库 | Ant Design 5 |
| 构建工具 | Vite 5 |
| 状态管理 | Zustand |
| 路由 | React Router 6 |
| 后端框架 | NestJS 10 |
| 数据库 | PostgreSQL 15 |
| ORM | TypeORM |
| 缓存 | Redis 7 |
| 实时通信 | WebSocket (Socket.IO) |
| 对象存储 | MinIO |
| 认证 | JWT + 微信 OAuth2.0 |
| 容器化 | Docker + Docker Compose |

## 项目目录结构

```
在线课堂平台/
├── frontend/                    # 前端项目
│   ├── src/
│   │   ├── api/                 # API 请求
│   │   ├── components/          # 公共组件
│   │   ├── pages/               # 页面组件
│   │   │   ├── Home.tsx         # 首页
│   │   │   ├── Login.tsx        # 登录
│   │   │   ├── Register.tsx     # 注册
│   │   │   ├── CourseList.tsx   # 课程列表
│   │   │   ├── CourseDetail.tsx # 课程详情
│   │   │   ├── MyCourses.tsx    # 我的课程
│   │   │   ├── CreateCourse.tsx # 创建课程
│   │   │   ├── LiveClass.tsx    # 直播课堂
│   │   │   ├── Assignment.tsx   # 作业页面
│   │   │   └── Statistics.tsx   # 数据统计
│   │   ├── store/               # 状态管理 (Zustand)
│   │   ├── types/               # TypeScript 类型定义
│   │   ├── App.tsx              # 应用入口
│   │   ├── main.tsx             # 渲染入口
│   │   └── index.css            # 全局样式
│   ├── Dockerfile               # 前端 Dockerfile
│   ├── nginx.conf               # Nginx 配置
│   ├── vite.config.ts           # Vite 配置
│   ├── tsconfig.json            # TypeScript 配置
│   └── package.json             # 前端依赖
│
├── backend/                     # 后端项目
│   ├── src/
│   │   ├── common/
│   │   │   └── entities/        # 数据库实体
│   │   │       ├── user.entity.ts
│   │   │       ├── course.entity.ts
│   │   │       ├── course-lesson.entity.ts
│   │   │       ├── course-enrollment.entity.ts
│   │   │       ├── live-class.entity.ts
│   │   │       ├── assignment.entity.ts
│   │   │       ├── assignment-submission.entity.ts
│   │   │       └── attendance-record.entity.ts
│   │   ├── modules/             # 业务模块
│   │   │   ├── auth/            # 认证模块
│   │   │   ├── users/           # 用户模块
│   │   │   ├── courses/         # 课程模块
│   │   │   ├── live-classes/    # 直播模块
│   │   │   ├── assignments/     # 作业模块
│   │   │   ├── attendance/      # 考勤模块
│   │   │   └── statistics/      # 统计模块
│   │   ├── gateways/            # WebSocket 网关
│   │   │   └── chat.gateway.ts  # 弹幕/举手互动
│   │   ├── app.module.ts        # 应用模块
│   │   └── main.ts              # 入口文件
│   ├── database/
│   │   └── init.sql             # 数据库初始化脚本
│   ├── Dockerfile               # 后端 Dockerfile
│   ├── tsconfig.json            # TypeScript 配置
│   └── package.json             # 后端依赖
│
├── docker-compose.yml           # Docker Compose 编排
├── .env.example                 # 环境变量示例
├── .gitignore                   # Git 忽略
└── README.md                    # 项目文档
```

## 环境变量说明

复制 `.env.example` 为 `.env` 并根据需要修改：

```bash
cp .env.example .env
```

### 数据库配置

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| POSTGRES_HOST | PostgreSQL 主机 | localhost |
| POSTGRES_PORT | PostgreSQL 端口 | 5501 |
| POSTGRES_DB | 数据库名 | online_classroom |
| POSTGRES_USER | 数据库用户 | postgres |
| POSTGRES_PASSWORD | 数据库密码 | postgres123 |

### Redis 配置

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| REDIS_HOST | Redis 主机 | localhost |
| REDIS_PORT | Redis 端口 | 6401 |
| REDIS_PASSWORD | Redis 密码 | （空） |

### MinIO 配置

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| MINIO_ENDPOINT | MinIO 主机 | localhost |
| MINIO_PORT | MinIO 端口 | 9001 |
| MINIO_ACCESS_KEY | 访问密钥 | minioadmin |
| MINIO_SECRET_KEY | 密钥 | minioadmin |
| MINIO_BUCKET | 存储桶名 | online-classroom |

### JWT 配置

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| JWT_SECRET | JWT 签名密钥 | 请修改为随机字符串 |
| JWT_EXPIRES_IN | Token 过期时间 | 7d |

### 微信 OAuth 配置

| 变量名 | 说明 |
|--------|------|
| WECHAT_APP_ID | 微信开放平台 AppID |
| WECHAT_APP_SECRET | 微信开放平台 AppSecret |

## Docker 部署说明

### 端口映射

| 容器服务 | 容器端口 | 主机端口 | 说明 |
|----------|----------|----------|------|
| frontend | 80 | 8001 | 前端 Nginx |
| backend | 3001 | 3001 | 后端 API |
| postgres | 5432 | 5501 | PostgreSQL |
| redis | 6379 | 6401 | Redis |
| minio | 9000 | 9001 | MinIO API |
| minio | 9002 | 9002 | MinIO 控制台 |

### 数据卷

| 数据卷名 | 说明 |
|----------|------|
| online-classroom-postgres-data | PostgreSQL 数据持久化 |
| online-classroom-redis-data | Redis 数据持久化 |
| online-classroom-minio-data | MinIO 存储持久化 |

### 常见问题

**1. 端口冲突**

如果端口被占用，修改 `docker-compose.yml` 中对应服务的 `ports` 配置：

```yaml
ports:
  - "8002:80"  # 改为其他未占用端口
```

**2. 服务启动顺序**

后端服务配置了 `depends_on` 和 `healthcheck`，会等待 PostgreSQL 健康检查通过后再启动。

**3. 数据库初始化**

首次启动时，TypeORM 会自动创建表结构。如需手动执行初始化脚本：

```bash
# 进入数据库容器
docker exec -it online-classroom-postgres psql -U postgres -d online_classroom

# 或从外部执行
docker exec -i online-classroom-postgres psql -U postgres -d online_classroom < backend/database/init.sql
```

**4. 查看日志**

```bash
# 查看所有服务日志
docker compose logs -f

# 查看特定服务日志
docker compose logs -f backend
docker compose logs -f frontend
```

**5. 清除数据重新部署**

```bash
# 停止并删除容器和数据卷
docker compose down -v

# 重新启动
docker compose up -d --build
```

## License

MIT License
