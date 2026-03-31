# Supabase 环境映射

> 更新时间：2026-03-31
> 状态：Active

> **说明**：本文记录 `unuvault` 当前已确认的 Supabase project、env 对照规则与账号归属。不要在文档中写入真实 key、密码或 token。

## 1. 已确认的项目映射

### 1.1 shared identity project
- project 名：`unu-identity-dev`
- URL：`https://fujmhkhqxygekmqymbdg.supabase.co`
- 当前归属 Supabase 帐号：`335427118@qq.com`

### 1.2 product-data project
- project 名：`unuvault-dev`
- URL：`https://rvelolgdbaykinysjvcc.supabase.co`
- 当前归属 Supabase 帐号：`fengzhen_de@qq.com`

## 2. env 对照表

| env 名 | 作用 | 应指向哪个 project | 应使用的 URL |
|---|---|---|---|
| `NEXT_PUBLIC_IDENTITY_SUPABASE_URL` | 浏览器侧 shared identity | `unu-identity-dev` | `https://fujmhkhqxygekmqymbdg.supabase.co` |
| `NEXT_PUBLIC_IDENTITY_SUPABASE_ANON_KEY` | 浏览器侧 shared identity anon key | `unu-identity-dev` | `unu-identity-dev` 的 anon key |
| `IDENTITY_SUPABASE_URL` | 服务端 shared identity | `unu-identity-dev` | `https://fujmhkhqxygekmqymbdg.supabase.co` |
| `IDENTITY_SUPABASE_SERVICE_ROLE_KEY` | 服务端 shared identity 高权限 key | `unu-identity-dev` | `unu-identity-dev` 的 service role key |
| `NEXT_PUBLIC_SUPABASE_URL` | 浏览器侧 product-data | `unuvault-dev` | `https://rvelolgdbaykinysjvcc.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 浏览器侧 product-data anon key | `unuvault-dev` | `unuvault-dev` 的 anon key |
| `SUPABASE_URL` | 服务端 product-data | `unuvault-dev` | `https://rvelolgdbaykinysjvcc.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | 服务端 product-data 高权限 key | `unuvault-dev` | `unuvault-dev` 的 service role key |

## 3. 判断规则

- 名字里有 `IDENTITY` 的 env，都应指向 `unu-identity-dev`。
- 普通 `SUPABASE_*` env，都应指向 `unuvault-dev`。
- 不要把 identity project 的 key 与 product-data project 的 key 混用。
- 浏览器侧和服务端虽然变量名前缀不同，但只要逻辑角色相同，就应指向同一个 project。

## 4. 与仓库现有入口的关系

- `apps/web/.env.local` 需要浏览器侧 shared identity 配置与 API base URL。
- `apps/api/.env.local` 需要同时具备 shared identity 与 product-data 两套服务端配置。
- 本文补充的是 project 映射与 env 归属规则；更高层的 Supabase 边界仍以 `docs/architecture/0002-supabase-boundary.md` 为准。

## 5. key 存放位置台账（不含真实值）

### 5.1 shared identity 相关

| key / 变量 | 对应环境 | 真相源头 | 正式保存位置 | 典型消费位置 | 当前本地副本 |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_IDENTITY_SUPABASE_URL` | dev / shared identity | Supabase `unu-identity-dev` project 控制台 | 密码管理器 / `op` 一类 secrets manager | `apps/web` 浏览器侧 identity；部署环境注入 | `apps/web/.env.local` 当前为模板占位 |
| `NEXT_PUBLIC_IDENTITY_SUPABASE_ANON_KEY` | dev / shared identity | Supabase `unu-identity-dev` project 控制台 | 密码管理器 / `op` 一类 secrets manager | `apps/web` 浏览器侧 identity；部署环境注入 | `apps/web/.env.local` 当前为模板占位 |
| `IDENTITY_SUPABASE_URL` | dev / shared identity | Supabase `unu-identity-dev` project 控制台 | 密码管理器 / `op` 一类 secrets manager | `apps/api` 服务端 identity；部署环境注入 | `apps/api/.env.local` 当前为模板占位 |
| `IDENTITY_SUPABASE_SERVICE_ROLE_KEY` | dev / shared identity | Supabase `unu-identity-dev` project 控制台 | 密码管理器 / `op` 一类 secrets manager | `apps/api` 服务端 identity；部署环境注入 | `apps/api/.env.local` 当前为模板占位 |

### 5.2 product-data 相关

| key / 变量 | 对应环境 | 真相源头 | 正式保存位置 | 典型消费位置 | 当前本地副本 |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | dev / product-data | Supabase `unuvault-dev` project 控制台 | 密码管理器 / `op` 一类 secrets manager | `apps/web` 浏览器侧 product-data；部署环境注入 | `apps/web/.env.local` 当前为模板占位 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | dev / product-data | Supabase `unuvault-dev` project 控制台 | 密码管理器 / `op` 一类 secrets manager | `apps/web` 浏览器侧 product-data；部署环境注入 | `apps/web/.env.local` 当前为模板占位 |
| `SUPABASE_URL` | dev / product-data | Supabase `unuvault-dev` project 控制台 | 密码管理器 / `op` 一类 secrets manager | `apps/api` 服务端 product-data；部署环境注入 | `apps/api/.env.local` 当前为模板占位 |
| `SUPABASE_SERVICE_ROLE_KEY` | dev / product-data | Supabase `unuvault-dev` project 控制台 | 密码管理器 / `op` 一类 secrets manager | `apps/api` 服务端 product-data；部署环境注入 | `apps/api/.env.local` 当前为模板占位 |

## 6. 当前判断

- `unuvault` 的 Supabase 配置边界已经比较清楚：`IDENTITY_*` 属于 shared identity，普通 `SUPABASE_*` 属于 `unuvault-dev` product-data。
- 当前这两套值的 non-local 正式保存方向，仍应优先写成密码管理器 / `op` 一类 secrets manager；部署环境变量和 CI secrets 属于消费层，不应反向当作 authority。
- 当前仓库里已确认的 `.env.local` 仍是模板占位，说明真实值没有被直接固化在已提交文件中；这些本地文件应继续被视为个人开发副本。
- `unuvault` 自己提供的 developer-local bridge 只负责 `local` namespace 便利性，不应被理解成 shared identity 或 product-data 的 non-local formal authority。

## 7. 安全注意事项

- 不要把真实 anon key、service role key、数据库密码写入本文。
- 真实 key 只记录“存放位置”，例如密码管理器、CI secrets 或本地 `.env.local`。
- 当前 `unuvault-dev` 仍位于独立 Supabase 帐号下；后续若做帐号收敛，优先更新本文再调整环境变量。
