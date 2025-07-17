// 现代化无人机管理系统交互逻辑

class DroneManagementSystem {
    constructor() {
        this.currentSection = 'dashboard';
        this.drones = [];
        this.missions = [];
        this.charts = {};
        this.map = null;
        this.websocket = null;
        this.reconnectInterval = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initializeCharts();
        this.initializeMap();
        this.loadMockData();
        this.initializeWebSocket();
        this.startRealTimeUpdates();
    }

    // 事件监听器设置
    setupEventListeners() {
        // 导航菜单切换
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = item.dataset.section;
                this.switchSection(section);
            });
        });

        // 刷新按钮
        document.querySelector('.refresh-btn')?.addEventListener('click', () => {
            this.refreshDashboard();
        });

        // 新建任务按钮
        document.querySelector('[onclick="createNewMission()"]')?.addEventListener('click', () => {
            this.createNewMission();
        });

        // 任务操作按钮
        document.addEventListener('click', (e) => {
            if (e.target.closest('.mission-actions')) {
                this.handleMissionAction(e);
            }
        });

        // 设备操作按钮
        document.addEventListener('click', (e) => {
            if (e.target.closest('.drone-actions')) {
                this.handleDroneAction(e);
            }
        });

        // 日期范围更新
        document.querySelector('[onclick="updateAnalytics()"]')?.addEventListener('click', () => {
            this.updateAnalytics();
        });
    }

    // 切换内容区域
    switchSection(section) {
        // 更新导航状态
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-section="${section}"]`).classList.add('active');

        // 更新内容区域
        document.querySelectorAll('.content-section').forEach(sec => {
            sec.classList.remove('active');
        });
        document.getElementById(`${section}-section`).classList.add('active');

        this.currentSection = section;

        // 特殊处理某些区域的初始化
        if (section === 'analytics') {
            this.updateAnalytics();
        } else if (section === 'map') {
            setTimeout(() => this.map?.invalidateSize(), 100);
        }
    }

    // 初始化图表
    initializeCharts() {
        // 任务状态图表
        const missionCtx = document.getElementById('mission-chart');
        if (missionCtx) {
            this.charts.mission = new Chart(missionCtx, {
                type: 'doughnut',
                data: {
                    labels: ['进行中', '已完成', '已取消', '等待中'],
                    datasets: [{
                        data: [8, 45, 3, 12],
                        backgroundColor: ['#3B82F6', '#10B981', '#EF4444', '#F59E0B'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { color: '#CBD5E1' }
                        }
                    }
                }
            });
        }

        // 趋势图表
        const trendCtx = document.getElementById('trend-chart');
        if (trendCtx) {
            this.charts.trend = new Chart(trendCtx, {
                type: 'line',
                data: {
                    labels: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
                    datasets: [{
                        label: '任务完成数',
                        data: [12, 19, 15, 22, 18, 25, 21],
                        borderColor: '#3B82F6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: { color: '#CBD5E1' }
                        }
                    },
                    scales: {
                        x: { ticks: { color: '#64748B' } },
                        y: { ticks: { color: '#64748B' } }
                    }
                }
            });
        }

        // 设备利用率图表
        const utilizationCtx = document.getElementById('utilization-chart');
        if (utilizationCtx) {
            this.charts.utilization = new Chart(utilizationCtx, {
                type: 'bar',
                data: {
                    labels: ['DJI-001', 'DJI-002', 'DJI-003', 'DJI-004', 'DJI-005'],
                    datasets: [{
                        label: '利用率 (%)',
                        data: [85, 92, 78, 95, 88],
                        backgroundColor: '#10B981'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: { color: '#CBD5E1' }
                        }
                    },
                    scales: {
                        x: { ticks: { color: '#64748B' } },
                        y: { ticks: { color: '#64748B' } }
                    }
                }
            });
        }

        // 告警统计图表
        const alertCtx = document.getElementById('alert-chart');
        if (alertCtx) {
            this.charts.alert = new Chart(alertCtx, {
                type: 'radar',
                data: {
                    labels: ['电量', '信号', '位置', '温度', '风速', '其他'],
                    datasets: [{
                        label: '告警类型',
                        data: [12, 8, 15, 6, 9, 4],
                        borderColor: '#EF4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.2)'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: { color: '#CBD5E1' }
                        }
                    },
                    scales: {
                        r: {
                            ticks: { color: '#64748B' },
                            grid: { color: '#334155' },
                            angleLines: { color: '#334155' }
                        }
                    }
                }
            });
        }
    }

    // 初始化地图
    initializeMap() {
        // 检查是否使用高德地图
        if (typeof AMap !== 'undefined') {
            this.initializeAMap();
        } else {
            this.initializeLeafletMap();
        }
    }

    // 初始化高德地图
    initializeAMap() {
        // 初始化小地图
        const miniMap = document.getElementById('mini-map');
        if (miniMap) {
            this.miniMap = new MapIntegration('mini-map', {
                zoom: 13,
                center: [116.404, 39.915]
            });
        }

        // 初始化任务规划地图
        const missionMap = document.getElementById('mission-map');
        if (missionMap) {
            this.missionMap = new MapIntegration('mission-map', {
                zoom: 15,
                center: [116.404, 39.915]
            });
        }
    }

    // 初始化Leaflet地图（备选方案）
    initializeLeafletMap() {
        // 初始化小地图
        const miniMap = document.getElementById('mini-map');
        if (miniMap) {
            this.miniMap = L.map('mini-map').setView([39.915, 116.404], 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(this.miniMap);

            // 添加示例标记
            L.marker([39.915, 116.404]).addTo(this.miniMap)
                .bindPopup('指挥中心').openPopup();
        }

        // 初始化任务规划地图
        const missionMap = document.getElementById('mission-map');
        if (missionMap) {
            this.missionMap = L.map('mission-map').setView([39.915, 116.404], 15);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(this.missionMap);

            // 添加地图控件
            L.control.scale().addTo(this.missionMap);
            
            // 添加绘图控件
            this.addDrawingTools();
        }
    }

    // 初始化WebSocket
    initializeWebSocket() {
        this.websocket = new WebSocketClient();
        this.realtimeManager = new RealtimeDataManager(this.websocket);
        
        // 设置WebSocket事件监听
        this.setupWebSocketListeners();
        
        // 请求实时数据
        this.realtimeManager.requestRealtimeData();
    }

    // 添加绘图工具
    addDrawingTools() {
        if (!this.missionMap) return;

        // 创建自定义绘图控件
        const drawControl = L.Control.extend({
            options: { position: 'topright' },
            onAdd: function(map) {
                const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
                container.innerHTML = `
                    <button class="leaflet-control-btn" onclick="system.addWaypoint()" title="添加航点">
                        <i class="fas fa-map-pin"></i>
                    </button>
                    <button class="leaflet-control-btn" onclick="system.clearRoute()" title="清除航线">
                        <i class="fas fa-trash"></i>
                    </button>
                `;
                return container;
            }
        });

        this.missionMap.addControl(new drawControl());
        this.waypoints = [];
        this.routeLine = null;
    }

    // 添加航点
    addWaypoint() {
        if (!this.missionMap) return;

        this.missionMap.once('click', (e) => {
            const waypoint = L.marker(e.latlng).addTo(this.missionMap);
            waypoint.bindPopup(`航点 ${this.waypoints.length + 1}`);
            this.waypoints.push(waypoint);
            this.updateRoute();
        });
    }

    // 更新航线
    updateRoute() {
        if (this.waypoints.length < 2) return;

        const latlngs = this.waypoints.map(marker => marker.getLatLng());
        
        if (this.routeLine) {
            this.missionMap.removeLayer(this.routeLine);
        }

        this.routeLine = L.polyline(latlngs, {
            color: '#3B82F6',
            weight: 3,
            opacity: 0.8
        }).addTo(this.missionMap);

        this.missionMap.fitBounds(this.routeLine.getBounds());
    }

    // 清除航线
    clearRoute() {
        this.waypoints.forEach(waypoint => this.missionMap.removeLayer(waypoint));
        if (this.routeLine) {
            this.missionMap.removeLayer(this.routeLine);
        }
        this.waypoints = [];
        this.routeLine = null;
    }

    // 加载模拟数据
    loadMockData() {
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
                lastUpdate: '2分钟前',
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
                lastUpdate: '实时',
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
                lastUpdate: '1小时前',
                camera: 'H20T云台',
                gimbal: '高精度定位',
                storage: '128GB/256GB'
            },
            {
                id: 'DJI-004',
                name: '巡检先锋-004',
                model: 'Air 2S',
                status: 'online',
                battery: 92,
                signal: 97,
                position: '园区C区-办公楼',
                mission: '楼顶巡检',
                progress: 23,
                speed: 15.8,
                altitude: 95,
                temperature: 26,
                lastUpdate: '30秒前',
                camera: '1英寸传感器',
                gimbal: '机械增稳',
                storage: '32GB/64GB'
            },
            {
                id: 'DJI-005',
                name: '物流运输-005',
                model: 'FlyCart 30',
                status: 'mission',
                battery: 45,
                signal: 82,
                position: '园区D区-物流站',
                mission: '物资运输',
                progress: 65,
                speed: 18.3,
                altitude: 150,
                temperature: 27,
                lastUpdate: '实时',
                camera: '双光云台',
                gimbal: '货舱监控',
                storage: '64GB/128GB'
            },
            {
                id: 'DJI-006',
                name: '环境监测-006',
                model: 'Mavic 3 Multispectral',
                status: 'online',
                battery: 78,
                signal: 91,
                position: '园区E区-绿化带',
                mission: '植被监测',
                progress: 37,
                speed: 9.7,
                altitude: 70,
                temperature: 24,
                lastUpdate: '1分钟前',
                camera: '多光谱传感器',
                gimbal: '农业专用',
                storage: '128GB/256GB'
            },
            {
                id: 'DJI-007',
                name: '安防巡逻-007',
                model: 'M30 Series',
                status: 'maintenance',
                battery: 100,
                signal: 0,
                position: '维护中心-检修区',
                mission: '定期保养',
                progress: 100,
                speed: 0,
                altitude: 0,
                temperature: 23,
                lastUpdate: '3小时前',
                camera: 'H20N夜视',
                gimbal: '激光测距',
                storage: '64GB/128GB'
            }
        ];

        this.missions = [
            {
                id: 1,
                name: '园区巡检 - A区域',
                description: '执行日常安全巡检任务',
                status: 'active',
                drone: 'DJI-001',
                startTime: '14:30',
                endTime: '15:30',
                progress: 45
            },
            {
                id: 2,
                name: '应急搜索 - 北区',
                description: '搜索失踪人员',
                status: 'pending',
                drone: '未分配',
                startTime: '等待执行',
                endTime: '待定',
                progress: 0
            }
        ];

        this.renderDrones();
        this.renderMissions();
    }

    // 渲染无人机列表
    renderDrones() {
        const container = document.querySelector('.drones-grid');
        if (!container) return;

        container.innerHTML = this.drones.map(drone => `
            <div class="drone-card ${drone.status}">
                <div class="drone-header">
                    <h4>${drone.id}</h4>
                    <span class="status-badge ${drone.status}">
                        ${this.getStatusText(drone.status)}
                    </span>
                </div>
                <div class="drone-image">
                    <i class="fas fa-drone"></i>
                </div>
                <div class="drone-info">
                    <div class="info-item">
                        <span>电量:</span>
                        <span class="battery-level">
                            <span class="battery-bar" style="width: ${drone.battery}%"></span>
                            ${drone.battery}%
                        </span>
                    </div>
                    <div class="info-item">
                        <span>信号:</span>
                        <span class="signal-strength good">
                            ${'●'.repeat(Math.floor(drone.signal / 20))}
                        </span>
                    </div>
                    <div class="info-item">
                        <span>位置:</span>
                        <span>${drone.position}</span>
                    </div>
                    ${drone.status === 'mission' ? `
                        <div class="info-item">
                            <span>任务:</span>
                            <span>${drone.mission}</span>
                        </div>
                        <div class="info-item">
                            <span>进度:</span>
                            <span>${drone.progress}%</span>
                        </div>
                    ` : ''}
                </div>
                <div class="drone-actions">
                    <button class="btn-small" onclick="system.controlDrone('${drone.id}')">
                        ${drone.status === 'mission' ? '监控' : '控制'}
                    </button>
                    <button class="btn-small" onclick="system.viewDroneDetails('${drone.id}')">
                        详情
                    </button>
                </div>
            </div>
        `).join('');
    }

    // 渲染任务列表
    renderMissions() {
        const listContainer = document.querySelector('.missions-list');
        if (!listContainer) return;

        listContainer.innerHTML = this.missions.map(mission => `
            <div class="mission-item" data-mission-id="${mission.id}">
                <div class="mission-status ${mission.status}"></div>
                <div class="mission-info">
                    <h4>${mission.name}</h4>
                    <p>${mission.description}</p>
                    <div class="mission-meta">
                        <span><i class="fas fa-clock"></i> ${mission.startTime}</span>
                        <span><i class="fas fa-drone"></i> ${mission.drone}</span>
                    </div>
                </div>
                <div class="mission-actions">
                    <button class="btn-icon" title="编辑" onclick="system.editMission(${mission.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon" title="监控" onclick="system.monitorMission(${mission.id})">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${mission.status === 'active' ? `
                        <button class="btn-icon" title="停止" onclick="system.stopMission(${mission.id})">
                            <i class="fas fa-stop"></i>
                        </button>
                    ` : `
                        <button class="btn-icon" title="开始" onclick="system.startMission(${mission.id})">
                            <i class="fas fa-play"></i>
                        </button>
                    `}
                </div>
            </div>
        `).join('');
    }

    // 获取状态文本
    getStatusText(status) {
        const statusMap = {
            online: '在线',
            mission: '任务中',
            offline: '离线',
            maintenance: '维护中'
        };
        return statusMap[status] || status;
    }

    // 控制无人机
    controlDrone(droneId) {
        const drone = this.drones.find(d => d.id === droneId);
        if (!drone) return;
        
        console.log(`控制无人机: ${droneId}`);
        this.openDroneControlModal(drone);
    }

    // 查看无人机详情
    viewDroneDetails(droneId) {
        const drone = this.drones.find(d => d.id === droneId);
        if (!drone) return;
        
        console.log(`查看无人机详情: ${droneId}`);
        this.openDroneDetailsModal(drone);
    }

    // 打开设备控制模态框
    openDroneControlModal(drone) {
        const modal = document.getElementById('drone-control-modal');
        if (!modal) {
            console.error('设备控制模态框未找到');
            return;
        }

        // 填充设备信息
        document.getElementById('control-drone-name').textContent = drone.name;
        document.getElementById('control-drone-status').textContent = this.getStatusText(drone.status);
        document.getElementById('control-drone-status').className = `status-badge ${drone.status}`;
        document.getElementById('control-battery').textContent = `${drone.battery}%`;
        document.getElementById('control-signal').textContent = `${drone.signal}%`;
        document.getElementById('control-position').textContent = drone.position;
        document.getElementById('control-altitude').textContent = `${drone.altitude}米`;

        // 重置滑块值
        document.getElementById('speed-slider').value = 50;
        document.getElementById('speed-value').textContent = '50%';
        document.getElementById('altitude-slider').value = drone.altitude || 120;
        document.getElementById('altitude-value').textContent = `${drone.altitude || 120}m`;

        // 显示模态框 - 使用更可靠的方式
        modal.style.display = 'block';
        modal.style.visibility = 'visible';
        modal.style.opacity = '1';
        modal.classList.add('show');
        
        // 确保模态框在最上层
        modal.style.zIndex = '10000';
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        
        // 强制显示body以允许滚动
        document.body.style.overflow = 'hidden';
        
        // 存储当前设备ID
        window.currentDroneId = drone.id;
        
        console.log(`已打开设备控制模态框: ${drone.name}`);
    }

    // 打开设备详情模态框
    openDroneDetailsModal(drone) {
        const modal = document.getElementById('drone-details-modal');
        if (!modal) return;

        // 填充设备信息
        document.getElementById('detail-id').textContent = drone.id;
        document.getElementById('detail-name').textContent = drone.name;
        document.getElementById('detail-model').textContent = drone.model;
        document.getElementById('detail-status').textContent = this.getStatusText(drone.status);
        document.getElementById('detail-status').className = `status-badge ${drone.status}`;
        document.getElementById('detail-update').textContent = drone.lastUpdate;
        document.getElementById('detail-battery').textContent = drone.battery;
        document.getElementById('detail-signal').textContent = drone.signal;
        document.getElementById('detail-altitude').textContent = drone.altitude;
        document.getElementById('detail-speed').textContent = drone.speed;
        document.getElementById('detail-camera').textContent = drone.camera;
        document.getElementById('detail-gimbal').textContent = drone.gimbal;
        document.getElementById('detail-storage').textContent = drone.storage;
        document.getElementById('detail-temperature').textContent = `${drone.temperature}°C`;
        document.getElementById('detail-mission').textContent = drone.mission;
        document.getElementById('detail-progress').textContent = `${drone.progress}%`;
        document.getElementById('detail-location').textContent = drone.position;

        // 显示模态框
        modal.style.display = 'block';
        
        // 存储当前设备ID
        window.currentDroneId = drone.id;
        
        // 初始化历史图表
        this.initDetailHistoryChart(drone);
    }

    // 初始化详情页面的历史数据图表
    initDetailHistoryChart(drone) {
        const ctx = document.getElementById('detail-history-chart');
        if (!ctx) return;

        // 模拟历史数据
        const labels = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00'];
        const batteryData = [100, 95, 90, 85, 82, 80, 78];
        const altitudeData = [0, 50, 100, 120, 110, 125, 120];

        // 销毁已存在的图表
        if (window.detailHistoryChart) {
            window.detailHistoryChart.destroy();
        }

        window.detailHistoryChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: '电量 (%)',
                        data: batteryData,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        tension: 0.4,
                        yAxisID: 'y'
                    },
                    {
                        label: '高度 (米)',
                        data: altitudeData,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.4,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#cbd5e1' }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#64748b' },
                        grid: { color: '#334155' }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        ticks: { color: '#64748b' },
                        grid: { color: '#334155' }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        ticks: { color: '#64748b' },
                        grid: { drawOnChartArea: false }
                    }
                }
            }
        });
    }

    // 创建新任务
    createNewMission() {
        console.log('创建新任务');
        // 这里可以打开任务创建模态框
    }

    // 编辑任务
    editMission(missionId) {
        console.log(`编辑任务: ${missionId}`);
    }

    // 监控任务
    monitorMission(missionId) {
        console.log(`监控任务: ${missionId}`);
    }

    // 开始任务
    startMission(missionId) {
        const mission = this.missions.find(m => m.id === missionId);
        if (mission) {
            mission.status = 'active';
            mission.drone = 'DJI-001';
            this.renderMissions();
        }
    }

    // 停止任务
    stopMission(missionId) {
        const mission = this.missions.find(m => m.id === missionId);
        if (mission) {
            mission.status = 'completed';
            this.renderMissions();
        }
    }

    // 处理无人机操作
    handleDroneAction(e) {
        const button = e.target.closest('button');
        if (!button) return;
        
        const action = button.textContent.trim();
        const card = button.closest('.drone-card');
        const droneId = card.querySelector('h4').textContent;
        
        console.log('按钮点击:', action, '设备ID:', droneId);
        
        if (action.includes('控制') || action.includes('监控')) {
            this.controlDrone(droneId);
        } else if (action.includes('详情')) {
            this.viewDroneDetails(droneId);
        } else if (action === '召回') {
            this.recallDrone(droneId);
        }
    }

    // 召回无人机
    recallDrone(droneId) {
        const drone = this.drones.find(d => d.id === droneId);
        if (drone) {
            drone.status = 'online';
            drone.mission = '待命';
            drone.progress = 0;
            this.renderDrones();
        }
    }

    // 处理任务操作
    handleMissionAction(e) {
        const action = e.target.closest('button').title;
        const missionId = parseInt(e.target.closest('.mission-item').dataset.missionId);
        
        switch(action) {
            case '编辑':
                this.editMission(missionId);
                break;
            case '监控':
                this.monitorMission(missionId);
                break;
            case '开始':
                this.startMission(missionId);
                break;
            case '停止':
                this.stopMission(missionId);
                break;
        }
    }

    // 初始化WebSocket连接
    initializeWebSocket() {
        if (typeof WebSocket !== 'undefined') {
            this.connectWebSocket();
        } else {
            console.warn('WebSocket不可用，使用模拟更新');
            this.startSimulatedUpdates();
        }
    }

    // WebSocket连接
    connectWebSocket() {
        const wsUrl = `ws://${window.location.hostname}:8080/ws`;
        
        try {
            this.websocket = new WebSocket(wsUrl);
            
            this.websocket.onopen = () => {
                console.log('WebSocket连接已建立');
                this.sendWebSocketMessage({
                    type: 'subscribe',
                    channels: ['drone_updates', 'mission_updates', 'alerts', 'system_status']
                });
            };

            this.websocket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleWebSocketMessage(data);
                } catch (error) {
                    console.error('WebSocket消息解析错误:', error);
                }
            };

            this.websocket.onclose = () => {
                console.log('WebSocket连接断开，尝试重连...');
                this.scheduleReconnect();
            };

            this.websocket.onerror = (error) => {
                console.error('WebSocket错误:', error);
                this.startSimulatedUpdates();
            };

        } catch (error) {
            console.error('WebSocket连接失败:', error);
            this.startSimulatedUpdates();
        }
    }

    // 处理WebSocket消息
    handleWebSocketMessage(message) {
        const { type, data } = message;
        
        switch (type) {
            case 'drone_update':
                this.updateDroneRealtime(data);
                break;
            case 'mission_update':
                this.updateMissionRealtime(data);
                break;
            case 'alert':
                this.handleAlertRealtime(data);
                break;
            case 'system_status':
                this.updateSystemStatus(data);
                break;
            case 'heartbeat':
                this.sendWebSocketMessage({ type: 'pong', timestamp: Date.now() });
                break;
        }
    }

    // 实时更新无人机数据
    updateDroneRealtime(droneUpdates) {
        droneUpdates.forEach(updatedDrone => {
            const index = this.drones.findIndex(d => d.id === updatedDrone.id);
            if (index !== -1) {
                this.drones[index] = { ...this.drones[index], ...updatedDrone };
            }
        });
        
        this.updateDashboardStats();
        this.renderDrones();
    }

    // 实时更新任务数据
    updateMissionRealtime(missionUpdates) {
        missionUpdates.forEach(updatedMission => {
            const index = this.missions.findIndex(m => m.id === updatedMission.id);
            if (index !== -1) {
                this.missions[index] = { ...this.missions[index], ...updatedMission };
            } else {
                this.missions.push(updatedMission);
            }
        });
        
        this.renderMissions();
    }

    // 处理实时告警
    handleAlertRealtime(alertData) {
        this.showNotification(alertData);
        this.updateAlertCount();
    }

    // 显示通知
    showNotification(alert) {
        if (Notification.permission === 'granted') {
            new Notification('无人机系统告警', {
                body: alert.message,
                icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiNFRjQ0NDQiLz4KPHN2ZyB4PSIxMCIgeT0iMTAiIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJ3aGl0ZSI+CjxwYXRoIGQ9Ik0xMiAyQzYuNDggMiAyIDYuNDggMiAxMnM0LjQ4IDEwIDEwIDEwIDEwLTQuNDggMTAtMTBTMTcuNTIgMiAxMiAyem0xIDE1aC0ydi0yaDJ2MnptMC00aC0yVjdoMnY2eiIvPgo8L3N2Zz4KPC9zdmc+',
                tag: 'drone-alert'
            });
        }

        // DOM通知
        const notification = document.createElement('div');
        notification.className = `alert-notification ${alert.severity}`;
        notification.innerHTML = `
            <div class="alert-content">
                <i class="fas fa-exclamation-triangle"></i>
                <span>${alert.message}</span>
                <button class="close-btn" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    // 更新系统状态
    updateSystemStatus(statusData) {
        const stats = statusData.stats || {};
        document.getElementById('online-count').textContent = stats.online || 0;
        document.getElementById('mission-count').textContent = stats.mission || 0;
        document.getElementById('alert-count').textContent = stats.alert || 0;
    }

    // 发送WebSocket消息
    sendWebSocketMessage(message) {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.send(JSON.stringify(message));
        }
    }

    // 计划重连
    scheduleReconnect() {
        if (this.reconnectInterval) {
            clearTimeout(this.reconnectInterval);
        }
        
        this.reconnectInterval = setTimeout(() => {
            this.connectWebSocket();
        }, 5000);
    }

    // 开始模拟更新（作为WebSocket的fallback）
    startSimulatedUpdates() {
        console.log('使用模拟数据更新');
        setInterval(() => {
            this.updateSimulatedData();
        }, 3000);
    }

    // 模拟数据更新
    updateSimulatedData() {
        this.drones.forEach(drone => {
            if (drone.status === 'online') {
                drone.battery = Math.max(0, Math.min(100, drone.battery + (Math.random() - 0.5) * 2));
                drone.signal = Math.max(0, Math.min(100, drone.signal + (Math.random() - 0.5) * 5));
            } else if (drone.status === 'mission') {
                drone.battery = Math.max(0, drone.battery - Math.random() * 0.5);
                drone.progress = Math.min(100, drone.progress + Math.random() * 5);
                
                if (drone.progress >= 100) {
                    drone.status = 'online';
                    drone.mission = '待命';
                    drone.progress = 0;
                }
            }
        });

        this.updateDashboardStats();
        this.renderDrones();
    }

    // 更新仪表板统计数据
    updateDashboardStats() {
        const onlineCount = this.drones.filter(d => d.status === 'online').length;
        const missionCount = this.drones.filter(d => d.status === 'mission').length;
        const alertCount = Math.floor(Math.random() * 3);

        document.getElementById('online-count').textContent = onlineCount;
        document.getElementById('mission-count').textContent = missionCount;
        document.getElementById('alert-count').textContent = alertCount;
    }

    // 实时更新数据（向后兼容）
    startRealTimeUpdates() {
        // 现在由WebSocket或模拟更新处理
        if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
            this.startSimulatedUpdates();
        }
    }

    // 刷新仪表板
    refreshDashboard() {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.sendWebSocketMessage({
                type: 'refresh_request',
                data: { timestamp: Date.now() }
            });
        } else {
            this.updateSimulatedData();
        }
        
        // 添加刷新动画
        const refreshBtn = document.querySelector('.refresh-btn');
        refreshBtn.style.transform = 'rotate(360deg)';
        setTimeout(() => {
            refreshBtn.style.transform = 'rotate(0deg)';
        }, 300);
    }

    // 更新分析数据
    updateAnalytics() {
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;
        
        console.log(`更新分析数据: ${startDate} 至 ${endDate}`);
        
        // 这里可以调用API获取新的分析数据
        // 然后更新图表
        
        // 模拟数据更新
        if (this.charts.trend) {
            this.charts.trend.data.datasets[0].data = [
                Math.floor(Math.random() * 30),
                Math.floor(Math.random() * 30),
                Math.floor(Math.random() * 30),
                Math.floor(Math.random() * 30),
                Math.floor(Math.random() * 30),
                Math.floor(Math.random() * 30),
                Math.floor(Math.random() * 30)
            ];
            this.charts.trend.update();
        }
    }
}

// 地图监控系统扩展类
class MapMonitoringSystem extends DroneManagementSystem {
    constructor() {
        super();
        this.formationMode = 'single';
        this.collaborationMode = 'master';
        this.emergencyLevel = 1;
        this.formationDrones = [];
        this.effectivenessScore = 85.6;
    }

    // 初始化地图监控
    initializeMapMonitoring() {
        this.setupFormationControls();
        this.setupEmergencySystem();
        this.setupEffectivenessMetrics();
        this.startRealTimeMonitoring();
    }

    // 编队控制
    setupFormationControls() {
        const formationSelect = document.getElementById('formation-select');
        const modeButtons = document.querySelectorAll('.mode-btn');

        formationSelect?.addEventListener('change', (e) => {
            this.formationMode = e.target.value;
            this.updateFormationDisplay();
        });

        modeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                modeButtons.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.collaborationMode = e.target.dataset.mode;
                this.updateCollaborationStats();
            });
        });
    }

    // 应急响应系统
    setupEmergencySystem() {
        const emergencyButtons = document.querySelectorAll('.emergency-btn');
        emergencyButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const level = e.target.dataset.level || e.target.closest('.emergency-btn').dataset.level;
                this.triggerEmergencyResponse(level);
            });
        });
    }

    // 触发应急响应
    triggerEmergencyResponse(level) {
        const levels = {
            level2: { color: 'yellow', message: '启动监控模式', time: '15秒' },
            level3: { color: 'orange', message: '应急搜索模式', time: '5分钟' },
            level4: { color: 'red', message: '紧急救援模式', time: '120秒' }
        };

        const levelData = levels[level];
        if (levelData) {
            this.emergencyLevel = parseInt(level.replace('level', ''));
            this.updateEmergencyDisplay(levelData);
            this.showNotification({
                type: 'emergency',
                message: `${levelData.message}已激活，预计${levelData.time}内完成部署`,
                severity: levelData.color
            });
        }
    }

    // 更新编队显示
    updateFormationDisplay() {
        const formationCount = document.getElementById('formation-count');
        const counts = {
            single: 1,
            line: 3,
            column: 4,
            diamond: 4,
            circle: 6,
            swarm: 12
        };
        
        if (formationCount) {
            formationCount.textContent = counts[this.formationMode] || 1;
        }
    }

    // 更新协同统计
    updateCollaborationStats() {
        const accuracy = document.getElementById('coordination-accuracy');
        const latency = document.getElementById('system-latency');
        
        const stats = {
            master: { accuracy: 95, latency: 120 },
            distributed: { accuracy: 88, latency: 200 },
            relay: { accuracy: 92, latency: 150 }
        };

        const current = stats[this.collaborationMode];
        if (accuracy) accuracy.textContent = current.accuracy + '%';
        if (latency) latency.textContent = current.latency + 'ms';
    }

    // 指挥效能评估
    setupEffectivenessMetrics() {
        this.updateEffectivenessScore();
        setInterval(() => {
            this.updateEffectivenessScore();
        }, 5000);
    }

    updateEffectivenessScore() {
        const score = 85.6 + (Math.random() - 0.5) * 4;
        this.effectivenessScore = Math.max(80, Math.min(95, score));
        
        const circle = document.querySelector('.circle-progress');
        if (circle) {
            const degrees = (this.effectivenessScore / 100) * 360;
            circle.style.background = `conic-gradient(var(--primary-color) 0deg, var(--primary-color) ${degrees}deg, var(--border-color) ${degrees}deg)`;
            circle.querySelector('.score').textContent = this.effectivenessScore.toFixed(1);
        }
    }

    // 实时监控系统
    startRealTimeMonitoring() {
        this.updateFormationDisplay();
        this.updateCollaborationStats();
        
        // 模拟实时数据更新
        setInterval(() => {
            this.updateRealTimeData();
        }, 1000);
    }

    updateRealTimeData() {
        // 更新实时态势数据
        const situationStats = document.querySelectorAll('.stat-item strong');
        if (situationStats.length >= 3) {
            situationStats[0].textContent = Math.floor(5 + Math.random() * 8); // 在线无人机
            situationStats[1].textContent = Math.floor(1 + Math.random() * 5); // 活跃任务
            situationStats[2].textContent = Math.floor(Math.random() * 2); // 告警
        }

        // 更新效能指标
        this.updateEffectivenessScore();
    }

    // 启动编队
    startFormation() {
        this.showNotification({
            type: 'success',
            message: `启动${this.formationMode}编队，协同模式：${this.collaborationMode}`,
            severity: 'info'
        });
    }

    // 同步校准
    syncFormation() {
        this.showNotification({
            type: 'success',
            message: '编队同步校准完成，协同精度提升至95%',
            severity: 'success'
        });
    }
}

// 告警中心系统扩展类
class AlertCenterSystem extends MapMonitoringSystem {
    constructor() {
        super();
        this.alerts = [];
        this.rules = [];
        this.predictions = [];
        this.alertEngine = null;
        this.correlationEngine = null;
        this.isRealTimeMode = true;
        this.alertHistory = [];
        this.initAlertSystem();
    }

    // 初始化告警系统
    initAlertSystem() {
        this.setupAlertEngine();
        this.setupCorrelationEngine();
        this.setupPredictionEngine();
        this.startRealTimeAlertStream();
        this.loadMockAlerts();
        this.initializeAlertCharts();
    }

    // 设置告警引擎
    setupAlertEngine() {
        this.alertEngine = {
            rules: [
                {
                    id: 'low_battery',
                    name: '低电量预警',
                    condition: 'battery < 20',
                    severity: 'critical',
                    responseTime: 30,
                    enabled: true
                },
                {
                    id: 'signal_loss',
                    name: '信号丢失检测',
                    condition: 'signal_strength < 30',
                    severity: 'warning',
                    responseTime: 10,
                    enabled: true
                },
                {
                    id: 'geofence_violation',
                    name: '越界告警',
                    condition: 'outside_boundary',
                    severity: 'critical',
                    responseTime: 5,
                    enabled: true
                },
                {
                    id: 'predictive_maintenance',
                    name: '预测性维护',
                    condition: 'motor_temp > 80',
                    severity: 'info',
                    responseTime: 300,
                    enabled: true
                }
            ],
            
            evaluateRule: function(droneData, rule) {
                const condition = rule.condition;
                switch(condition) {
                    case 'battery < 20':
                        return droneData.battery < 20;
                    case 'signal_strength < 30':
                        return droneData.signal < 30;
                    case 'outside_boundary':
                        return this.checkGeofenceViolation(droneData.position);
                    case 'motor_temp > 80':
                        return droneData.motorTemp > 80;
                    default:
                        return false;
                }
            },

            checkGeofenceViolation: function(position) {
                // 简化的越界检查
                const boundaries = {
                    minLat: 39.85,
                    maxLat: 39.95,
                    minLng: 116.35,
                    maxLng: 116.45
                };
                return position.lat < boundaries.minLat || 
                       position.lat > boundaries.maxLat ||
                       position.lng < boundaries.minLng || 
                       position.lng > boundaries.maxLng;
            }
        };
    }

    // 设置关联分析引擎
    setupCorrelationEngine() {
        this.correlationEngine = {
            analyze: function(alerts) {
                const correlations = [];
                
                // 时空关联分析
                for (let i = 0; i < alerts.length; i++) {
                    for (let j = i + 1; j < alerts.length; j++) {
                        const spatialDistance = this.calculateSpatialDistance(
                            alerts[i].location, alerts[j].location
                        );
                        const temporalDistance = Math.abs(
                            new Date(alerts[i].timestamp) - new Date(alerts[j].timestamp)
                        );
                        
                        if (spatialDistance < 1000 && temporalDistance < 300000) { // 1km内，5分钟内
                            correlations.push({
                                alerts: [alerts[i], alerts[j]],
                                correlationType: 'spatio-temporal',
                                strength: this.calculateCorrelationStrength(spatialDistance, temporalDistance)
                            });
                        }
                    }
                }
                
                return correlations;
            },

            calculateSpatialDistance: function(loc1, loc2) {
                // 简化的距离计算
                const R = 6371000; // 地球半径（米）
                const dLat = (loc2.lat - loc1.lat) * Math.PI / 180;
                const dLng = (loc2.lng - loc1.lng) * Math.PI / 180;
                const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                          Math.cos(loc1.lat * Math.PI / 180) * Math.cos(loc2.lat * Math.PI / 180) *
                          Math.sin(dLng/2) * Math.sin(dLng/2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                return R * c;
            },

            calculateCorrelationStrength: function(distance, timeDiff) {
                const distanceScore = Math.max(0, 1 - distance / 1000);
                const timeScore = Math.max(0, 1 - timeDiff / 300000);
                return (distanceScore + timeScore) / 2;
            }
        };
    }

    // 设置预测引擎
    setupPredictionEngine() {
        this.predictionEngine = {
            models: {
                battery: {
                    predict: function(currentData) {
                        const dischargeRate = 0.5; // 每公里消耗0.5%电量
                        const distanceToHome = this.calculateDistance(currentData.position, currentData.homePoint);
                        const requiredBattery = distanceToHome * dischargeRate * 2 + 10; // 往返+10%安全余量
                        const predictedTime = (currentData.battery - requiredBattery) / dischargeRate;
                        
                        return {
                            type: 'battery_critical',
                            probability: currentData.battery < 25 ? 0.9 : 0.3,
                            timeToEvent: Math.max(0, predictedTime),
                            confidence: 0.85
                        };
                    },

                    calculateDistance: function(pos1, pos2) {
                        // 简化的距离计算
                        return Math.sqrt(Math.pow(pos1.lat - pos2.lat, 2) + Math.pow(pos1.lng - pos2.lng, 2)) * 111000;
                    }
                },

                motor: {
                    predict: function(currentData) {
                        const tempTrend = currentData.motorTempTrend || 0;
                        const predictedTemp = currentData.motorTemp + tempTrend * 5; // 5分钟预测
                        
                        return {
                            type: 'motor_overheat',
                            probability: predictedTemp > 85 ? 0.8 : 0.2,
                            timeToEvent: predictedTemp > 85 ? Math.max(0, (90 - predictedTemp) / tempTrend) : -1,
                            confidence: 0.75
                        };
                    }
                }
            }
        };
    }

    // 加载模拟告警数据
    loadMockAlerts() {
        const now = new Date();
        this.alerts = [
            {
                id: 'ALT001',
                type: 'critical',
                title: 'DJI-003 电量严重不足',
                description: '无人机DJI-003当前电量仅为8%，距离返航点约2.5公里，预计剩余飞行时间3分钟。',
                timestamp: new Date(now.getTime() - 120000),
                location: { lat: 39.9042, lng: 116.3912 },
                droneId: 'DJI-003',
                severity: 'critical',
                status: 'active',
                source: 'battery_monitor',
                suggestedAction: '立即返航'
            },
            {
                id: 'ALT002',
                type: 'warning',
                title: 'DJI-007 信号强度降低',
                description: '无人机DJI-007信号强度降至25%，可能存在通信中断风险。',
                timestamp: new Date(now.getTime() - 300000),
                location: { lat: 39.9125, lng: 116.3856 },
                droneId: 'DJI-007',
                severity: 'warning',
                status: 'active',
                source: 'signal_monitor',
                suggestedAction: '调整位置或高度'
            },
            {
                id: 'ALT003',
                type: 'info',
                title: 'DJI-012 进入预测维护窗口',
                description: '基于电机温度趋势分析，DJI-012预计在15分钟后需要冷却。',
                timestamp: new Date(now.getTime() - 600000),
                location: { lat: 39.8987, lng: 116.4045 },
                droneId: 'DJI-012',
                severity: 'info',
                status: 'active',
                source: 'predictive_system',
                suggestedAction: '计划返航'
            }
        ];

        this.renderAlerts();
        this.renderPredictions();
        this.renderRules();
    }

    // 渲染告警流
    renderAlerts() {
        const container = document.getElementById('alert-stream');
        if (!container) return;

        container.innerHTML = this.alerts.map(alert => `
            <div class="alert-item ${alert.severity}" data-alert-id="${alert.id}">
                <div class="alert-header">
                    <div class="alert-level ${alert.severity}">
                        <i class="fas fa-exclamation-circle"></i>
                        <span>${this.getSeverityText(alert.severity)}</span>
                    </div>
                    <div class="alert-time">${this.formatTime(alert.timestamp)}</div>
                </div>
                <div class="alert-title">${alert.title}</div>
                <div class="alert-description">${alert.description}</div>
                <div class="alert-meta">
                    <span><i class="fas fa-drone"></i> ${alert.droneId}</span>
                    <span><i class="fas fa-map-marker-alt"></i> ${alert.location.lat.toFixed(4)}, ${alert.location.lng.toFixed(4)}</span>
                </div>
                <div class="alert-actions">
                    <button class="action-btn ${alert.severity}" onclick="alertSystem.handleAlertAction('${alert.id}', 'resolve')">
                        <i class="fas fa-check"></i> 处理
                    </button>
                    <button class="action-btn info" onclick="alertSystem.handleAlertAction('${alert.id}', 'details')">
                        <i class="fas fa-info"></i> 详情
                    </button>
                </div>
            </div>
        `).join('');

        this.updateAlertCounts();
    }

    // 渲染预测告警
    renderPredictions() {
        const container = document.getElementById('prediction-list');
        if (!container) return;

        const predictions = [
            {
                title: '设备故障预警',
                description: 'DJI-002电机温度异常，建议立即检查',
                timeToEvent: 15,
                probability: 0.92,
                risk: 'high'
            },
            {
                title: '电量不足预警',
                description: 'DJI-005预计在8分钟后电量低于安全阈值',
                timeToEvent: 8,
                probability: 0.85,
                risk: 'medium'
            }
        ];

        container.innerHTML = predictions.map(pred => `
            <div class="prediction-item ${pred.risk}-risk">
                <div class="prediction-header">
                    <span class="prediction-title">${pred.title}</span>
                    <span class="prediction-time">预计${pred.timeToEvent}分钟后</span>
                </div>
                <div class="prediction-details">
                    <span>${pred.description}</span>
                    <div class="risk-indicator">
                        <div class="risk-bar">
                            <div class="risk-fill" style="width: ${pred.probability * 100}%"></div>
                        </div>
                        <span>${Math.round(pred.probability * 100)}%</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // 渲染规则列表
    renderRules() {
        const container = document.getElementById('rules-list');
        if (!container) return;

        container.innerHTML = this.alertEngine.rules.map(rule => `
            <div class="rule-item ${rule.enabled ? 'active' : ''}">
                <div class="rule-header">
                    <span class="rule-name">${rule.name}</span>
                    <span class="rule-status ${rule.enabled ? 'enabled' : 'disabled'}">
                        ${rule.enabled ? '启用' : '禁用'}
                    </span>
                </div>
                <div class="rule-details">
                    <span>触发条件: ${rule.condition}</span>
                    <span>响应时间: ${rule.responseTime}秒</span>
                </div>
            </div>
        `).join('');
    }

    // 获取严重性文本
    getSeverityText(severity) {
        const map = {
            'critical': '紧急',
            'warning': '警告',
            'info': '提示'
        };
        return map[severity] || severity;
    }

    // 格式化时间
    formatTime(timestamp) {
        const now = new Date();
        const diff = now - timestamp;
        
        if (diff < 60000) {
            return '刚刚';
        } else if (diff < 3600000) {
            return `${Math.floor(diff / 60000)}分钟前`;
        } else {
            return timestamp.toLocaleTimeString();
        }
    }

    // 更新告警计数
    updateAlertCounts() {
        const counts = {
            critical: this.alerts.filter(a => a.severity === 'critical').length,
            warning: this.alerts.filter(a => a.severity === 'warning').length,
            info: this.alerts.filter(a => a.severity === 'info').length,
            resolved: this.alertHistory.filter(a => a.status === 'resolved').length
        };

        document.getElementById('critical-alerts-count').textContent = counts.critical;
        document.getElementById('warning-alerts-count').textContent = counts.warning;
        document.getElementById('predictive-alerts-count').textContent = counts.info;
        document.getElementById('resolved-alerts-count').textContent = counts.resolved;
    }

    // 实时告警流
    startRealTimeAlertStream() {
        setInterval(() => {
            this.generateRandomAlert();
        }, 10000); // 每10秒生成一个随机告警

        setInterval(() => {
            this.updatePredictions();
        }, 5000); // 每5秒更新预测
    }

    // 生成随机告警
    generateRandomAlert() {
        const severities = ['critical', 'warning', 'info'];
        const types = ['battery', 'signal', 'position', 'temperature'];
        const drones = ['DJI-001', 'DJI-002', 'DJI-003', 'DJI-004', 'DJI-005'];

        const newAlert = {
            id: `ALT${String(Date.now()).slice(-6)}`,
            type: severities[Math.floor(Math.random() * severities.length)],
            title: `${drones[Math.floor(Math.random() * drones.length)]} ${types[Math.floor(Math.random() * types.length)]}异常`,
            description: `检测到${types[Math.floor(Math.random() * types.length)]}参数异常，需要立即关注`,
            timestamp: new Date(),
            location: {
                lat: 39.9042 + (Math.random() - 0.5) * 0.01,
                lng: 116.3912 + (Math.random() - 0.5) * 0.01
            },
            droneId: drones[Math.floor(Math.random() * drones.length)],
            severity: severities[Math.floor(Math.random() * severities.length)],
            status: 'active',
            source: 'real_time_monitor',
            suggestedAction: '检查设备状态'
        };

        this.alerts.unshift(newAlert);
        if (this.alerts.length > 20) {
            this.alerts = this.alerts.slice(0, 20);
        }

        this.renderAlerts();
        this.showNotification(newAlert);
    }

    // 更新预测
    updatePredictions() {
        // 模拟预测更新
        const predictions = document.querySelectorAll('.risk-fill');
        predictions.forEach(bar => {
            const currentWidth = parseInt(bar.style.width);
            const newWidth = Math.max(0, Math.min(100, currentWidth + (Math.random() - 0.5) * 10));
            bar.style.width = `${newWidth}%`;
            bar.parentElement.nextElementSibling.textContent = `${Math.round(newWidth)}%`;
        });
    }

    // 处理告警操作
    handleAlertAction(alertId, action) {
        const alert = this.alerts.find(a => a.id === alertId);
        if (!alert) return;

        switch(action) {
            case 'resolve':
                alert.status = 'resolved';
                this.alertHistory.push({...alert, resolvedAt: new Date()});
                this.alerts = this.alerts.filter(a => a.id !== alertId);
                this.renderAlerts();
                this.showToast('告警已处理', 'success');
                break;
            case 'details':
                this.showAlertDetails(alert);
                break;
        }
    }

    // 显示告警详情
    showAlertDetails(alert) {
        const detailsContainer = document.getElementById('alert-details');
        if (!detailsContainer) return;

        detailsContainer.innerHTML = `
            <div class="alert-info">
                <div class="alert-level ${alert.severity}">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>${this.getSeverityText(alert.severity)}告警</span>
                </div>
                <div class="alert-title">${alert.title}</div>
                <div class="alert-time">${alert.timestamp.toLocaleString()}</div>
                <div class="alert-location">位置: ${alert.location.lat.toFixed(6)}, ${alert.location.lng.toFixed(6)}</div>
                <div class="alert-description">${alert.description}</div>
                <div class="alert-source">来源: ${alert.source}</div>
            </div>
            <div class="alert-actions">
                <button class="action-btn emergency" onclick="alertSystem.handleAlertAction('${alert.id}', 'resolve')">
                    立即处理
                </button>
                <button class="action-btn warning" onclick="alertSystem.createEmergencyTask('${alert.id}')">
                    创建应急任务
                </button>
                <button class="action-btn info" onclick="alertSystem.shareAlert('${alert.id}')">
                    分享告警
                </button>
            </div>
        `;
    }

    // 创建应急任务
    createEmergencyTask(alertId) {
        const alert = this.alerts.find(a => a.id === alertId);
        if (!alert) return;

        this.showToast(`已创建应急任务处理 ${alert.title}`, 'info');
    }

    // 分享告警
    shareAlert(alertId) {
        const alert = this.alerts.find(a => a.id === alertId);
        if (!alert) return;

        this.showToast('告警信息已分享到跨部门协作平台', 'success');
    }

    // 初始化告警图表
    initializeAlertCharts() {
        setTimeout(() => {
            try {
                console.log('开始初始化告警图表...');
                
                // 确保DOM元素存在且可见
                const trendChart = document.getElementById('alerts-trend-chart');
                const typeChart = document.getElementById('alerts-type-chart');
                const correlationChart = document.getElementById('correlation-chart');
                
                if (!trendChart || !typeChart || !correlationChart) {
                    console.warn('图表容器元素未找到，延迟重试...');
                    setTimeout(() => this.initializeAlertCharts(), 1000);
                    return;
                }
                
                // 确保容器可见且有尺寸
                [trendChart, typeChart, correlationChart].forEach(canvas => {
                    if (!canvas.offsetParent) {
                        console.warn(`Canvas ${canvas.id} 不可见，尝试显示...`);
                        canvas.style.display = 'block';
                        canvas.style.visibility = 'visible';
                    }
                    if (canvas.offsetWidth === 0 || canvas.offsetHeight === 0) {
                        console.warn(`Canvas ${canvas.id} 尺寸为0，设置默认尺寸`);
                        canvas.style.width = '100%';
                        canvas.style.height = '250px';
                    }
                });
                
                this.renderAlertTrendChart();
                this.renderAlertTypeChart();
                this.renderCorrelationChart();
                
                console.log('告警图表初始化完成');
                
            } catch (error) {
                console.error('告警图表初始化失败:', error);
                this.showToast(`图表初始化失败: ${error.message}`, 'error');
                
                // 提供降级显示
                this.showChartFallback();
            }
        }, 2000); // 增加延迟确保DOM完全加载
    }

    // 渲染告警趋势图表
    renderAlertTrendChart() {
        const ctx = document.getElementById('alerts-trend-chart');
        if (!ctx) return;

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
                datasets: [
                    {
                        label: '紧急告警',
                        data: [2, 1, 5, 8, 3, 2],
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        tension: 0.4
                    },
                    {
                        label: '警告告警',
                        data: [5, 3, 12, 15, 8, 6],
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        tension: 0.4
                    },
                    {
                        label: '预测告警',
                        data: [8, 12, 25, 30, 20, 15],
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#CBD5E1' }
                    }
                },
                scales: {
                    x: { ticks: { color: '#64748B' } },
                    y: { ticks: { color: '#64748B' } }
                }
            }
        });
    }

    // 渲染告警类型图表
    renderAlertTypeChart() {
        const ctx = document.getElementById('alerts-type-chart');
        if (!ctx) return;

        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['电量告警', '信号告警', '位置告警', '温度告警', '风速告警', '其他告警'],
                datasets: [{
                    data: [25, 18, 22, 15, 12, 8],
                    backgroundColor: [
                        '#ef4444',
                        '#f59e0b',
                        '#3b82f6',
                        '#10b981',
                        '#8b5cf6',
                        '#6b7280'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#CBD5E1' }
                    }
                }
            }
        });
    }

    // 显示通知
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `alert-notification ${type}`;
        toast.innerHTML = `
            <div class="alert-content">
                <span>${message}</span>
                <button class="close-btn" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 5000);
    }

    // 创建告警规则
    createAlertRule() {
        this.showToast('打开告警规则创建向导', 'info');
    }

    // 导出告警报告
    exportAlerts() {
        this.showToast('正在生成告警分析报告...', 'info');
    }

    // 管理规则
    manageRules() {
        this.showToast('打开规则管理面板', 'info');
    }

    // 切换3D视图
    toggle3DView() {
        this.showToast('切换到3D告警沙盘视图', 'info');
    }

    // 聚焦告警
    focusOnAlerts() {
        this.showToast('聚焦到告警区域', 'info');
    }

    // 关闭告警详情
    closeAlertDetails() {
        const detailsContainer = document.getElementById('alert-details');
        if (detailsContainer) {
            detailsContainer.innerHTML = '<div style="text-align: center; color: #64748B; padding: 2rem;">选择一个告警查看详情</div>';
        }
    }
}

// 全局告警系统实例
let alertSystem;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    system = new MapMonitoringSystem();
    system.initializeMapMonitoring();
    alertSystem = new AlertCenterSystem();
});

// 全局函数（供HTML调用）
function refreshDashboard() {
    system.refreshDashboard();
}

function createNewMission() {
    system.createNewMission();
}

function updateAnalytics() {
    system.updateAnalytics();
}

function startFormation() {
    system.startFormation();
}

function syncFormation() {
    system.syncFormation();
}

function emergencyResponse() {
    system.triggerEmergencyResponse('level3');
}

function triggerEmergency(level) {
    system.triggerEmergencyResponse(level);
}

function createQuickMission(type) {
    const missions = {
        patrol: '区域巡检任务',
        monitor: '定点监控任务',
        emergency: '应急搜索任务'
    };
    
    system.showNotification({
        type: 'info',
        message: `创建${missions[type]}，正在规划最佳路径...`,
        severity: 'info'
    });
}

// 设备控制模态框函数
function closeDroneControlModal() {
    const modal = document.getElementById('drone-control-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function closeDroneDetailsModal() {
    const modal = document.getElementById('drone-details-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function sendDroneCommand(command) {
    console.log(`发送无人机命令: ${command}`);
    system.showNotification({
        type: 'success',
        message: `命令已发送: ${command}`,
        severity: 'success'
    });
}

function sendPresetCommand(command) {
    console.log(`发送预设命令: ${command}`);
    system.showNotification({
        type: 'success',
        message: `预设动作已激活: ${command}`,
        severity: 'success'
    });
}

function refreshDroneData() {
    const droneId = window.currentDroneId;
    if (droneId) {
        const drone = system.drones.find(d => d.id === droneId);
        if (drone) {
            system.openDroneDetailsModal(drone);
            system.showNotification({
                type: 'info',
                message: `已刷新 ${drone.name} 的数据`,
                severity: 'info'
            });
        }
    }
}

function exportDroneData() {
    const droneId = window.currentDroneId;
    if (droneId) {
        system.showNotification({
            type: 'success',
            message: `正在导出 ${droneId} 的数据报告...`,
            severity: 'success'
        });
        
        // 模拟导出过程
        setTimeout(() => {
            system.showNotification({
                type: 'success',
                message: `数据报告已导出到下载文件夹`,
                severity: 'success'
            });
        }, 2000);
    }
}

// 点击模态框外部关闭
window.addEventListener('click', function(event) {
    const controlModal = document.getElementById('drone-control-modal');
    const detailsModal = document.getElementById('drone-details-modal');
    
    if (event.target === controlModal) {
        closeDroneControlModal();
    }
    if (event.target === detailsModal) {
        closeDroneDetailsModal();
    }
});

// ESC键关闭模态框
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeDroneControlModal();
        closeDroneDetailsModal();
    }
});