// 轻量级无人机管理系统 - 原型专用
// 专为静态原型设计，无WebSocket、无定时器、最小化资源占用

class LiteDroneManagementSystem {
    constructor() {
        this.currentSection = 'dashboard';
        this.drones = [];
        this.missions = [];
        this.charts = {};
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadStaticData();
        this.renderInitialViews();
    }

    setupEventListeners() {
        // 导航菜单切换
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = item.dataset.section;
                this.switchSection(section);
            });
        });

        // 刷新按钮（静态数据）
        document.querySelector('.refresh-btn')?.addEventListener('click', () => {
            this.refreshStaticData();
        });

        // 模态框关闭事件
        this.setupModalEvents();
    }

    switchSection(section) {
        // 更新导航状态
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-section="${section}"]`)?.classList.add('active');

        // 更新内容区域
        document.querySelectorAll('.content-section').forEach(sec => {
            sec.classList.remove('active');
        });
        document.getElementById(`${section}-section`)?.classList.add('active');

        this.currentSection = section;

        // 初始化图表（仅一次）
        if (section === 'dashboard' && !this.charts.initialized) {
            this.initializeChartsOnce();
        }
    }

    loadStaticData() {
        this.drones = [
            {
                id: 'DJI-001',
                name: '巡检先锋-001',
                model: 'Mavic 3 Enterprise',
                status: 'online',
                battery: 85,
                signal: 95,
                position: '园区A区-北段',
                mission: '日常巡检',
                progress: 45,
                speed: 12.5,
                altitude: 120,
                temperature: 25,
                camera: '4K广角',
                gimbal: '3轴稳定',
                storage: '64GB/128GB'
            },
            {
                id: 'DJI-002',
                name: '监控卫士-002',
                model: 'M30T热成像',
                status: 'mission',
                battery: 62,
                signal: 88,
                position: '园区B区-仓库',
                mission: '安全监控',
                progress: 78,
                speed: 8.2,
                altitude: 85,
                temperature: 28,
                camera: '热成像+可见光',
                gimbal: '智能跟踪',
                storage: '32GB/64GB'
            },
            {
                id: 'DJI-003',
                name: '应急响应-003',
                model: 'M300 RTK',
                status: 'offline',
                battery: 0,
                signal: 0,
                position: '维护中心-充电区',
                mission: '待命',
                progress: 0,
                speed: 0,
                altitude: 0,
                temperature: 22,
                camera: 'H20N云台',
                gimbal: '高精度定位',
                storage: '128GB/256GB'
            }
        ];

        this.missions = [
            {
                id: 1,
                name: '园区巡检 - A区域',
                description: '执行日常安全巡检任务',
                status: 'active',
                drone: 'DJI-001',
                progress: 45
            },
            {
                id: 2,
                name: '应急搜索 - 北区',
                description: '搜索失踪人员',
                status: 'pending',
                drone: '未分配',
                progress: 0
            }
        ];
    }

    renderInitialViews() {
        this.renderDrones();
        this.renderMissions();
        this.initializeChartsOnce();
    }

    renderDrones() {
        const container = document.querySelector('.drones-grid');
        if (!container) return;

        container.innerHTML = this.drones.map(drone => `
            <div class="drone-card ${drone.status}">
                <div class="drone-header">
                    <h4>${drone.id}</h4>
                    <span class="status-badge ${drone.status}">${this.getStatusText(drone.status)}</span>
                </div>
                <div class="drone-info">
                    <div class="info-row">
                        <span>电量:</span>
                        <span>${drone.battery}%</span>
                    </div>
                    <div class="info-row">
                        <span>信号:</span>
                        <span>${drone.signal}%</span>
                    </div>
                    <div class="info-row">
                        <span>位置:</span>
                        <span>${drone.position}</span>
                    </div>
                    ${drone.status === 'mission' ? `
                        <div class="info-row">
                            <span>任务:</span>
                            <span>${drone.mission}</span>
                        </div>
                        <div class="info-row">
                            <span>进度:</span>
                            <span>${drone.progress}%</span>
                        </div>
                    ` : ''}
                </div>
                <div class="drone-actions">
                    <button class="action-btn" onclick="liteSystem.showDroneControl('${drone.id}')">
                        ${drone.status === 'mission' ? '监控' : '控制'}
                    </button>
                    <button class="action-btn" onclick="liteSystem.showDroneDetails('${drone.id}')">
                        详情
                    </button>
                </div>
            </div>
        `).join('');
    }

    renderMissions() {
        const container = document.querySelector('.missions-list');
        if (!container) return;

        container.innerHTML = this.missions.map(mission => `
            <div class="mission-item">
                <div class="mission-info">
                    <h4>${mission.name}</h4>
                    <p>${mission.description}</p>
                </div>
                <div class="mission-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${mission.progress}%"></div>
                    </div>
                    <span>${mission.progress}%</span>
                </div>
            </div>
        `).join('');
    }

    initializeChartsOnce() {
        if (this.charts.initialized) return;

        // 确保Chart.js已加载
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js未加载，跳过图表初始化');
            // 创建图表占位符
            this.createChartPlaceholders();
            return;
        }

        try {
            // 任务状态图表
            const missionCtx = document.getElementById('mission-chart');
            if (missionCtx) {
                // 设置canvas尺寸
                missionCtx.width = 400;
                missionCtx.height = 200;
                
                new Chart(missionCtx, {
                    type: 'doughnut',
                    data: {
                        labels: ['进行中', '已完成', '等待中'],
                        datasets: [{
                            data: [8, 45, 12],
                            backgroundColor: ['#3B82F6', '#10B981', '#F59E0B'],
                            borderWidth: 0
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'bottom',
                                labels: { 
                                    color: '#CBD5E1', 
                                    font: { size: 12 },
                                    padding: 20
                                }
                            }
                        },
                        cutout: '60%',
                        spacing: 2
                    }
                });
            }

            // 趋势图表
            const trendCtx = document.getElementById('trend-chart');
            if (trendCtx) {
                // 设置canvas尺寸
                trendCtx.width = 400;
                trendCtx.height = 200;
                
                new Chart(trendCtx, {
                    type: 'line',
                    data: {
                        labels: ['周一', '周二', '周三', '周四', '周五'],
                        datasets: [{
                            label: '任务完成数',
                            data: [12, 19, 15, 22, 18],
                            borderColor: '#3B82F6',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            tension: 0.4,
                            fill: true,
                            borderWidth: 2,
                            pointRadius: 4,
                            pointHoverRadius: 6
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false }
                        },
                        scales: {
                            x: { 
                                display: false,
                                grid: { display: false }
                            },
                            y: { 
                                display: false,
                                grid: { display: false }
                            }
                        },
                        interaction: {
                            intersect: false,
                            mode: 'index'
                        }
                    }
                });
            }

            // 初始化分析页面图表
            this.initializeAnalyticsCharts();

            this.charts.initialized = true;
            console.log('图表初始化完成');
        } catch (error) {
            console.error('图表初始化失败:', error);
            this.createChartPlaceholders();
        }
    }

    createChartPlaceholders() {
        // 为图表创建占位符
        const charts = ['mission-chart', 'trend-chart', 'utilization-chart'];
        charts.forEach(chartId => {
            const canvas = document.getElementById(chartId);
            if (canvas) {
                const placeholder = document.createElement('div');
                placeholder.className = 'chart-placeholder';
                placeholder.innerHTML = `
                    <div style="height: 200px; display: flex; align-items: center; justify-content: center; 
                                background: var(--bg-tertiary); border-radius: 8px; color: var(--text-muted);
                                border: 1px solid var(--border-color);">
                        <div style="text-align: center;">
                            <i class="fas fa-chart-bar" style="font-size: 24px; margin-bottom: 8px; color: var(--text-secondary);"></i>
                            <div>图表加载中...</div>
                        </div>
                    </div>
                `;
                canvas.parentNode.replaceChild(placeholder, canvas);
            }
        });
    }

    initializeAnalyticsCharts() {
        // 设备利用率图表
        const utilizationCtx = document.getElementById('utilization-chart');
        if (utilizationCtx) {
            utilizationCtx.width = 400;
            utilizationCtx.height = 200;
            
            new Chart(utilizationCtx, {
                type: 'bar',
                data: {
                    labels: ['DJI-001', 'DJI-002', 'DJI-003', 'DJI-004', 'DJI-005'],
                    datasets: [{
                        label: '利用率 (%)',
                        data: [85, 92, 78, 95, 88],
                        backgroundColor: '#10B981',
                        borderRadius: 4,
                        borderSkipped: false
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        x: { 
                            display: false,
                            grid: { display: false }
                        },
                        y: { 
                            display: false,
                            grid: { display: false }
                        }
                    }
                }
            });
        }
    }

    setupModalEvents() {
        // 模态框关闭
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal').forEach(modal => {
                    modal.style.display = 'none';
                });
            }
        });
    }

    showDroneControl(droneId) {
        const drone = this.drones.find(d => d.id === droneId);
        if (!drone) return;

        // 简单的控制面板显示
        alert(`控制 ${drone.name}\n电量: ${drone.battery}%\n状态: ${this.getStatusText(drone.status)}`);
    }

    showDroneDetails(droneId) {
        const drone = this.drones.find(d => d.id === droneId);
        if (!drone) return;

        // 简单的详情显示
        alert(`${drone.name} 详情\n型号: ${drone.model}\n电量: ${drone.battery}%\n位置: ${drone.position}`);
    }

    refreshStaticData() {
        // 添加简单的刷新动画
        const btn = document.querySelector('.refresh-btn');
        if (btn) {
            btn.style.transform = 'rotate(360deg)';
            setTimeout(() => {
                btn.style.transform = 'rotate(0deg)';
            }, 300);
        }
    }

    getStatusText(status) {
        const statusMap = {
            online: '在线',
            mission: '任务中',
            offline: '离线',
            maintenance: '维护中'
        };
        return statusMap[status] || status;
    }
}

// 全局函数
function refreshDashboard() {
    liteSystem.refreshStaticData();
}

function createNewMission() {
    alert('创建新任务功能');
}

function updateAnalytics() {
    alert('更新分析数据');
}

// 初始化轻量级系统
let liteSystem;
document.addEventListener('DOMContentLoaded', () => {
    liteSystem = new LiteDroneManagementSystem();
});