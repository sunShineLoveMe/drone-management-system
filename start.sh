#!/bin/bash

# 显示欢迎信息
echo "========================================"
echo "  无人机管理系统 - 启动脚本"
echo "========================================"
echo ""

# 检查是否安装了必要的工具
command -v node >/dev/null 2>&1 || { echo "需要安装Node.js，请访问 https://nodejs.org/ 下载安装"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "需要安装Python3，请访问 https://www.python.org/ 下载安装"; exit 1; }

# 创建日志目录
mkdir -p backend/logs

# 启动前端服务
echo "正在启动前端服务..."
cd frontend
python3 -m http.server 3000 &
FRONTEND_PID=$!
echo "前端服务已启动，访问 http://localhost:3000"
echo ""

# 返回根目录
cd ..

# 提示后端服务需要安装依赖
echo "后端服务需要安装依赖，请按照以下步骤操作："
echo "1. 打开新的终端窗口"
echo "2. 进入项目目录: cd $(pwd)/backend"
echo "3. 安装依赖: npm install"
echo "4. 启动服务: npm run dev"
echo ""
echo "注意：由于这是一个原型系统，后端服务需要配置数据库和Redis。"
echo "目前您可以直接访问前端界面查看UI设计。"
echo ""

# 等待用户按下Ctrl+C
echo "前端服务正在运行中，按Ctrl+C停止..."
trap "kill $FRONTEND_PID; echo '已停止所有服务'; exit" INT
wait