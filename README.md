# File Server

## 概述

File Server 是一个简单的文件上传和下载服务，使用 Koa 框架和 SQLite 数据库来管理文件信息。用户可以通过 API 上传文件、下载文件、查询文件信息以及删除文件。

## 特性

- **文件上传**: 支持通过 PUT 请求上传文件。
- **文件下载**: 支持通过 GET 请求下载文件，并设置正确的文件名。
- **文件信息查询**: 支持通过 GET 请求查询文件信息。
- **文件删除**: 支持通过 DELETE 请求删除文件信息。
- **日志记录**: 使用 log4js 记录请求和错误信息。

## 安装

1. **克隆仓库**

    ```bash
    git clone https://github.com/yuanliwei/fileserver.git
    cd fileserver
    ```

2. **安装依赖**

    ```bash
    npm install
    ```

## 配置

1. **配置文件路径**

    默认情况下，文件存储在 `fileserver/data/` 目录下。你可以在 `main.js` 中通过环境变量 `ROOT_DIR_DATA` 来更改文件存储路径。

    ```bash
    ROOT_DIR_DATA=/repo/fileserver/data/ node src/main.js
    ```

2. **日志配置**

    根据 `RELEASE_FILE_SERVER` 环境变量配置不同的日志格式。默认情况下，日志格式在开发模式和发布模式下有所不同。

    ```bash
    RELEASE_FILE_SERVER=true node src/main.js
    ```

## 启动服务

1. **启动服务器**

    ```bash
    node src/main.js
    ```

    默认情况下，服务将在端口 `32109` 上启动。你可以通过设置环境变量 `PORT` 来更改端口号。

    ```bash
    PORT=3000 node src/main.js
    ```

## API 文档

### 上传文件

- **URL**: `/upload`
- **Method**: `PUT`
- **Headers**:
  - `x-filename`: 文件名
- **Body**: 文件数据（二进制）
- **Response**:
  - 成功: `200 OK`
  - 失败: `500 Internal Server Error`

**示例请求**

```bash
curl -X PUT -H "x-filename: example.txt" --data-binary @example.txt http://localhost:32109/upload
```

### 下载文件

- **URL**: `/download/:sha1`
- **Method**: `GET`
- **Response**:
  - 成功: `200 OK`，文件数据
  - 文件未找到: `404 Not Found`

**示例请求**

```bash
curl -O http://localhost:32109/download/<sha1>
```

### 查询文件信息

- **URL**: `/info/:sha1`
- **Method**: `GET`
- **Response**:
  - 成功: `200 OK`
  - 文件未找到: `404 Not Found`

**示例请求**

```bash
curl http://localhost:32109/info/<sha1>
```

### 删除文件

- **URL**: `/delete/:sha1`
- **Method**: `DELETE`
- **Response**:
  - 成功: `200 OK`
  - 文件未找到: `404 Not Found`

**示例请求**

```bash
curl -X DELETE http://localhost:32109/delete/<sha1>
```

### 服务状态

- **URL**: `/status`
- **Method**: `GET`
- **Response**:
  - 成功: `200 OK`

**示例请求**

```bash
curl http://localhost:32109/status
```

### 健康状态

- **URL**: `/front/health-status`
- **Method**: `GET`
- **Response**:
  - 成功: `200 OK`

**示例请求**

```bash
curl http://localhost:32109/front/health-status
```

## 测试

项目包含了一些测试用例，使用 Node.js 的内置测试模块 `node:test`。

1. **运行所有测试**

    ```bash
    node --test src/lib.test.js
    ```

2. **运行特定测试**

    ```bash
    node --test-name-pattern="^upload-file$" src/lib.test.js
    ```

## 贡献

欢迎贡献代码！请遵循以下步骤：

1. Fork 仓库
2. 创建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开一个 Pull Request

## 许可证

本项目采用 [MIT 许可证](LICENSE)。
