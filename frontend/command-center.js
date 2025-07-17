// 指挥调度中心三层架构系统
// 实现五星难度：指挥调度中心三层架构
class CommandCenterSystem {
    constructor() {
        this.layers = {
            strategic: new StrategicLayer(),
            tactical: new TacticalLayer(),
            operational: new OperationalLayer()
        };
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.drones = [];
        this.missions = [];
        this.alerts = [];
        this.isEmergencyMode = false;
        
        this.init();
    }

    init() {
        this.setup3DVisualization();
        this.generateMockData();
        this.startRealTimeUpdates();
        this.setupEventListeners();
        this.initializeLayers();
    }

    // 初始化3D可视化
    setup3DVisualization() {
        const container = document.getElementById('situation-map');
        const canvas = document.getElementById('tactical-canvas');
        
        if (!canvas) return;

        // 创建场景
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0f172a);

        // 创建相机
        this.camera = new THREE.PerspectiveCamera(
            75, 
            container.clientWidth / container.clientHeight, 
            0.1, 
            1000
        );
        this.camera.position.set(0, 100, 100);
        this.camera.lookAt(0, 0, 0);

        // 创建渲染器
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: canvas, 
            antialias: true,
            alpha: true 
        });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.shadowMap.enabled = true;

        // 添加光源
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(50, 100, 50);
        directionalLight.castShadow = true;
        this.scene.add(directionalLight);

        // 创建地形
        this.createTerrain();
        
        // 添加坐标系
        this.createCoordinateSystem();

        // 鼠标控制
        this.setupCameraControls();

        // 开始渲染循环
        this.animate();
    }

    createTerrain() {
        // 创建地形网格
        const geometry = new THREE.PlaneGeometry(200, 200, 50, 50);
        const material = new THREE.MeshLambertMaterial({ 
            color: 0x1e293b, 
            transparent: true, 
            opacity: 0.8 
        });
        
        // 添加地形起伏
        const vertices = geometry.attributes.position.array;
        for (let i = 0; i < vertices.length; i += 3) {
            vertices[i + 2] = Math.sin(vertices[i] * 0.1) * Math.cos(vertices[i + 1] * 0.1) * 5;
        }
        geometry.attributes.position.needsUpdate = true;
        geometry.computeVertexNormals();
        
        const terrain = new THREE.Mesh(geometry, material);
        terrain.rotation.x = -Math.PI / 2;
        terrain.receiveShadow = true;
        this.scene.add(terrain);

        // 添加网格
        const gridHelper = new THREE.GridHelper(200, 20, 0x475569, 0x334155);
        this.scene.add(gridHelper);
    }

    createCoordinateSystem() {
        // 创建3D坐标轴
        const axesHelper = new THREE.AxesHelper(50);
        this.scene.add(axesHelper);

        // 添加建筑物标记
        this.createBuildingMarkers();
        
        // 添加禁飞区
        this.createNoFlyZones();
    }

    createBuildingMarkers() {
        const buildings = [
            { x: -30, z: -20, height: 20, name: '指挥中心' },
            { x: 40, z: 30, height: 15, name: '数据中心' },
            { x: -20, z: 40, height: 10, name: '充电站' },
            { x: 30, z: -40, height: 25, name: '通信塔' }
        ];

        buildings.forEach(building => {
            const geometry = new THREE.BoxGeometry(8, building.height, 8);
            const material = new THREE.MeshLambertMaterial({ color: 0x475569 });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(building.x, building.height / 2, building.z);
            mesh.castShadow = true;
            mesh.userData = { type: 'building', name: building.name };
            this.scene.add(mesh);
        });
    }

    createNoFlyZones() {
        const zones = [
            { x: 0, z: 0, radius: 15, name: '机场禁飞区' },
            { x: 50, z: 20, radius: 10, name: '敏感区域' }
        ];

        zones.forEach(zone => {
            const geometry = new THREE.CylinderGeometry(zone.radius, zone.radius, 1, 32);
            const material = new THREE.MeshBasicMaterial({ 
                color: 0xef4444, 
                transparent: true, 
                opacity: 0.3 
            });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(zone.x, 0.5, zone.z);
            mesh.userData = { type: 'noFlyZone', name: zone.name };
            this.scene.add(mesh);
        });
    }

    setupCameraControls() {
        let mouseX = 0, mouseY = 0;
        let targetRotationX = 0, targetRotationY = 0;
        let isMouseDown = false;

        const canvas = document.getElementById('tactical-canvas');
        
        canvas.addEventListener('mousedown', (event) => {
            isMouseDown = true;
            mouseX = event.clientX;
            mouseY = event.clientY;
        });

        canvas.addEventListener('mousemove', (event) => {
            if (!isMouseDown) return;
            
            const deltaX = event.clientX - mouseX;
            const deltaY = event.clientY - mouseY;
            
            targetRotationY += deltaX * 0.01;
            targetRotationX += deltaY * 0.01;
            
            mouseX = event.clientX;
            mouseY = event.clientY;
        });

        canvas.addEventListener('mouseup', () => {
            isMouseDown = false;
        });

        canvas.addEventListener('wheel', (event) => {
            const delta = event.deltaY * 0.1;
            const distance = this.camera.position.length();
            const newDistance = Math.max(20, Math.min(200, distance + delta));
            
            this.camera.position.normalize().multiplyScalar(newDistance);
        });

        const updateCamera = () => {
            const radius = this.camera.position.length();
            this.camera.position.x = radius * Math.sin(targetRotationY) * Math.cos(targetRotationX);
            this.camera.position.y = radius * Math.sin(targetRotationX);
            this.camera.position.z = radius * Math.cos(targetRotationY) * Math.cos(targetRotationX);
            this.camera.lookAt(0, 0, 0);
        };

        setInterval(updateCamera, 16);
    }

    generateMockData() {
        // 生成无人机数据
        this.drones = [
            {
                id: 'DJI-COMMAND-001',
                position: { x: -25, y: 30, z: -15 },
                status: 'patrolling',
                battery: 87,
                operator: '操作员 A001',
                task: '园区巡检',
                speed: 5.2,
                altitude: 30,
                signal: 95
            },
            {
                id: 'DJI-COMMAND-002',
                position: { x: 35, y: 25, z: 20 },
                status: 'security',
                battery: 73,
                operator: '操作员 B002',
                task: '安全监控',
                speed: 3.8,
                altitude: 25,
                signal: 89
            },
            {
                id: 'DJI-COMMAND-003',
                position: { x: -10, y: 35, z: 30 },
                status: 'emergency',
                battery: 45,
                operator: '应急席',
                task: '医疗配送',
                speed: 12.5,
                altitude: 35,
                signal: 78
            },
            {
                id: 'DJI-COMMAND-004',
                position: { x: 20, y: 20, z: -25 },
                status: 'inspection',
                battery: 92,
                operator: '操作员 C003',
                task: '设备检查',
                speed: 4.1,
                altitude: 20,
                signal: 96
            },
            {
                id: 'DJI-COMMAND-005',
                position: { x: -40, y: 28, z: 10 },
                status: 'delivery',
                battery: 68,
                operator: '操作员 D004',
                task: '物资运输',
                speed: 6.7,
                altitude: 28,
                signal: 85
            }
        ];

        // 生成任务数据
        this.missions = [
            {
                id: 'MISSION-001',
                type: 'patrol',
                priority: 'high',
                status: 'active',
                assignedDrone: 'DJI-COMMAND-001',
                startTime: new Date(Date.now() - 30 * 60 * 1000),
                estimatedEndTime: new Date(Date.now() + 15 * 60 * 1000),
                coverage: 75
            },
            {
                id: 'MISSION-002',
                type: 'emergency',
                priority: 'critical',
                status: 'active',
                assignedDrone: 'DJI-COMMAND-003',
                startTime: new Date(Date.now() - 5 * 60 * 1000),
                estimatedEndTime: new Date(Date.now() + 8 * 60 * 1000),
                coverage: 30
            }
        ];

        this.createDroneModels();
    }

    createDroneModels() {
        this.drones.forEach(drone => {
            const droneGroup = new THREE.Group();
            
            // 创建无人机主体
            const bodyGeometry = new THREE.BoxGeometry(3, 1, 3);
            const bodyMaterial = new THREE.MeshLambertMaterial({ 
                color: this.getColorByStatus(drone.status) 
            });
            const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
            body.castShadow = true;
            droneGroup.add(body);

            // 添加旋翼
            for (let i = 0; i < 4; i++) {
                const angle = (i * Math.PI) / 2;
                const rotorGeometry = new THREE.CylinderGeometry(1.5, 1.5, 0.2);
                const rotorMaterial = new THREE.MeshLambertMaterial({ color: 0x374151 });
                const rotor = new THREE.Mesh(rotorGeometry, rotorMaterial);
                rotor.position.set(Math.cos(angle) * 2, 0.5, Math.sin(angle) * 2);
                droneGroup.add(rotor);
            }

            // 添加状态指示灯
            const lightGeometry = new THREE.SphereGeometry(0.3);
            const lightMaterial = new THREE.MeshBasicMaterial({ 
                color: drone.battery > 50 ? 0x10b981 : drone.battery > 20 ? 0xf59e0b : 0xef4444 
            });
            const light = new THREE.Mesh(lightGeometry, lightMaterial);
            light.position.set(0, 1, 0);
            droneGroup.add(light);

            // 添加标签
            const labelGeometry = new THREE.PlaneGeometry(4, 1);
            const labelMaterial = new THREE.MeshBasicMaterial({ 
                color: 0x1e293b, 
                transparent: true, 
                opacity: 0.8 
            });
            const label = new THREE.Mesh(labelGeometry, labelMaterial);
            label.position.set(0, 3, 0);
            label.lookAt(0, 3, 1);
            droneGroup.add(label);

            droneGroup.position.set(drone.position.x, drone.position.y, drone.position.z);
            drone.model = droneGroup;
            drone.model.userData = drone;
            this.scene.add(droneGroup);
        });
    }

    getColorByStatus(status) {
        const colors = {
            'patrolling': 0x10b981,
            'security': 0x3b82f6,
            'emergency': 0xef4444,
            'inspection': 0xf59e0b,
            'delivery': 0x8b5cf6,
            'offline': 0x6b7280
        };
        return colors[status] || 0x10b981;
    }

    initializeLayers() {
        this.layers.strategic.init();
        this.layers.tactical.init();
        this.layers.operational.init();
    }

    startRealTimeUpdates() {
        setInterval(() => {
            this.updateDronePositions();
            this.updateMissionStatus();
            this.updateAlerts();
            this.updateUI();
            this.layers.strategic.update();
            this.layers.tactical.update();
            this.layers.operational.update();
        }, 1000);
    }

    updateDronePositions() {
        this.drones.forEach(drone => {
            if (drone.status !== 'offline') {
                // 模拟无人机移动
                const speed = drone.speed * 0.1;
                drone.position.x += (Math.random() - 0.5) * speed;
                drone.position.z += (Math.random() - 0.5) * speed;
                
                // 限制在边界内
                drone.position.x = Math.max(-90, Math.min(90, drone.position.x));
                drone.position.z = Math.max(-90, Math.min(90, drone.position.z));
                
                // 更新电池
                drone.battery = Math.max(0, drone.battery - Math.random() * 0.1);
                
                if (drone.model) {
                    drone.model.position.set(drone.position.x, drone.position.y, drone.position.z);
                    
                    // 旋翼旋转动画
                    drone.model.rotation.y += 0.05;
                }
            }
        });
    }

    updateMissionStatus() {
        this.missions.forEach(mission => {
            if (mission.status === 'active') {
                mission.coverage = Math.min(100, mission.coverage + Math.random() * 2);
                
                if (mission.coverage >= 100) {
                    mission.status = 'completed';
                }
            }
        });
    }

    updateAlerts() {
        // 生成随机警报
        if (Math.random() < 0.1) {
            const alertTypes = [
                { type: 'info', message: '系统运行正常' },
                { type: 'warning', message: 'DJI-COMMAND-003 电量低于20%' },
                { type: 'critical', message: '检测到潜在冲突区域' }
            ];
            
            const alert = alertTypes[Math.floor(Math.random() * alertTypes.length)];
            this.alerts.unshift(alert);
            
            if (this.alerts.length > 5) {
                this.alerts.pop();
            }
        }
    }

    updateUI() {
        this.updateStrategicLayer();
        this.updateTacticalLayer();
        this.updateOperationalLayer();
    }

    updateStrategicLayer() {
        document.getElementById('total-drones').textContent = this.drones.length;
        document.getElementById('active-missions').textContent = this.missions.filter(m => m.status === 'active').length;
        document.getElementById('coverage-area').textContent = Math.round(75 + Math.random() * 10) + '%';
        document.getElementById('system-health').textContent = Math.round(95 + Math.random() * 3) + '%';
    }

    updateTacticalLayer() {
        // 更新任务时间线
        const timeline = document.getElementById('mission-timeline');
        if (timeline) {
            const recentEvents = this.generateTimelineEvents();
            timeline.innerHTML = recentEvents.map(event => `
                <div class="timeline-item">
                    <div class="timeline-time">${event.time}</div>
                    <div class="timeline-event">${event.description}</div>
                </div>
            `).join('');
        }

        // 更新警报系统
        const alerts = document.getElementById('alert-system');
        if (alerts) {
            alerts.innerHTML = this.alerts.map(alert => `
                <div class="alert-item">
                    <div class="alert-icon alert-${alert.type}">${alert.type === 'critical' ? '!' : alert.type === 'warning' ? '!' : 'i'}</div>
                    <span>${alert.message}</span>
                </div>
            `).join('');
        }
    }

    updateOperationalLayer() {
        // 更新操作员状态
        const operators = ['A001', 'B002', 'C003'];
        operators.forEach((operator, index) => {
            const element = document.querySelectorAll('.operator-station')[index];
            if (element) {
                const isOnline = Math.random() > 0.1;
                const statusIndicator = element.querySelector('.operator-status');
                if (statusIndicator) {
                    statusIndicator.className = `operator-status ${isOnline ? 'operator-online' : 'operator-offline'}`;
                }
            }
        });
    }

    generateTimelineEvents() {
        const events = [
            { time: this.getCurrentTime(), description: 'DJI-COMMAND-001 继续园区巡检' },
            { time: this.getCurrentTime(-2), description: 'DJI-COMMAND-002 完成安全扫描' },
            { time: this.getCurrentTime(-5), description: 'DJI-COMMAND-003 启动紧急配送' },
            { time: this.getCurrentTime(-8), description: '系统检测到风速变化' }
        ];
        return events;
    }

    getCurrentTime(offset = 0) {
        const now = new Date();
        now.setMinutes(now.getMinutes() + offset);
        return now.toLocaleTimeString('zh-CN', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    handleResize() {
        const container = document.getElementById('situation-map');
        if (container && this.camera && this.renderer) {
            this.camera.aspect = container.clientWidth / container.clientHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(container.clientWidth, container.clientHeight);
        }
    }

    // 执行紧急停止
    executeEmergencyStop() {
        this.isEmergencyMode = true;
        
        // 更新无人机状态
        this.drones.forEach(drone => {
            if (drone.status !== 'offline') {
                drone.status = 'returning';
                drone.targetPosition = { x: 0, y: 10, z: 0 }; // 返回安全区域
            }
        });

        // 更新威胁等级
        const threatLevel = document.querySelector('.threat-level');
        if (threatLevel) {
            threatLevel.className = 'threat-level threat-high';
            threatLevel.innerHTML = '<i class="fas fa-exclamation-triangle"></i><span>威胁等级: 紧急</span>';
        }

        // 发送警报
        this.alerts.unshift({
            type: 'critical',
            message: '紧急停止已激活，所有无人机返回安全区域'
        });
    }
}

// 战略层 - 总指挥席
class StrategicLayer {
    constructor() {
        this.decisionSupport = new DecisionSupportSystem();
        this.riskAssessment = new RiskAssessmentSystem();
    }

    init() {
        this.setupDecisionSupport();
        this.setupRiskMonitoring();
    }

    setupDecisionSupport() {
        // 初始化决策支持系统
        this.decisionSupport.init();
    }

    setupRiskMonitoring() {
        // 初始化风险评估系统
        this.riskAssessment.init();
    }

    update() {
        this.decisionSupport.update();
        this.riskAssessment.update();
    }
}

// 战术层 - 态势分析
class TacticalLayer {
    constructor() {
        this.situationAwareness = new SituationAwarenessSystem();
        this.missionPlanning = new MissionPlanningSystem();
    }

    init() {
        this.situationAwareness.init();
        this.missionPlanning.init();
    }

    update() {
        this.situationAwareness.update();
        this.missionPlanning.update();
    }
}

// 操作层 - 飞行控制
class OperationalLayer {
    constructor() {
        this.flightControl = new FlightControlSystem();
        this.monitoring = new MonitoringSystem();
    }

    init() {
        this.flightControl.init();
        this.monitoring.init();
    }

    update() {
        this.flightControl.update();
        this.monitoring.update();
    }
}

// 决策支持系统
class DecisionSupportSystem {
    init() {
        this.algorithms = ['genetic', 'ant-colony', 'pso', 'greedy'];
        this.currentAlgorithm = 'genetic';
    }

    update() {
        // 更新决策建议
        const suggestions = [
            '建议优化DJI-COMMAND-003的飞行路径',
            '考虑调整DJI-COMMAND-002的巡逻区域',
            '推荐启用备用无人机DJI-COMMAND-006'
        ];
    }
}

// 风险评估系统
class RiskAssessmentSystem {
    init() {
        this.riskFactors = {
            weather: 0.2,
            traffic: 0.3,
            battery: 0.3,
            communication: 0.2
        };
    }

    update() {
        // 计算综合风险评分
        const riskScore = Math.random() * 100;
        
        // 更新威胁等级显示
        const threatLevel = document.querySelector('.threat-level');
        if (threatLevel) {
            let className, text, icon;
            if (riskScore < 30) {
                className = 'threat-low';
                text = '威胁等级: 低';
                icon = 'fa-shield-alt';
            } else if (riskScore < 70) {
                className = 'threat-medium';
                text = '威胁等级: 中';
                icon = 'fa-exclamation-triangle';
            } else {
                className = 'threat-high';
                text = '威胁等级: 高';
                icon = 'fa-exclamation-triangle';
            }
            
            threatLevel.className = `threat-level ${className}`;
            threatLevel.innerHTML = `<i class="fas ${icon}"></i><span>${text}</span>`;
        }
    }
}

// 态势感知系统
class SituationAwarenessSystem {
    init() {
        this.trackingTargets = [];
        this.collisionDetection = new CollisionDetection();
    }

    update() {
        // 更新态势感知数据
        this.trackingTargets = this.generateTrackingData();
    }

    generateTrackingData() {
        return [
            { id: 'TARGET-001', type: 'drone', position: { x: 10, y: 25, z: 15 } },
            { id: 'TARGET-002', type: 'vehicle', position: { x: -15, y: 0, z: 20 } }
        ];
    }
}

// 任务规划系统
class MissionPlanningSystem {
    init() {
        this.plannedMissions = [];
        this.resourceAllocation = new ResourceAllocator();
    }

    update() {
        // 更新任务规划状态
        this.updateMissionTimeline();
    }

    updateMissionTimeline() {
        // 动态更新任务时间线
    }
}

// 飞行控制系统
class FlightControlSystem {
    init() {
        this.controlModes = ['manual', 'auto', 'voice'];
        this.currentMode = 'auto';
    }

    update() {
        // 更新飞行控制状态
    }

    setMode(mode) {
        this.currentMode = mode;
        console.log(`飞行控制模式切换到: ${mode}`);
    }
}

// 监控系统
class MonitoringSystem {
    init() {
        this.metrics = {
            commandRate: 0,
            successRate: 0,
            responseTime: 0
        };
    }

    update() {
        // 更新监控指标
        this.metrics.commandRate = 45 + Math.floor(Math.random() * 10);
        this.metrics.successRate = 99.5 + Math.random() * 0.5;
        this.metrics.responseTime = 120 + Math.floor(Math.random() * 50);
        
        // 更新UI显示
        const commandRate = document.querySelector('.status-value');
        if (commandRate) {
            commandRate.textContent = this.metrics.commandRate;
        }
    }
}

// 碰撞检测系统
class CollisionDetection {
    checkCollisions(drones) {
        const collisions = [];
        
        for (let i = 0; i < drones.length; i++) {
            for (let j = i + 1; j < drones.length; j++) {
                const distance = Math.sqrt(
                    Math.pow(drones[i].position.x - drones[j].position.x, 2) +
                    Math.pow(drones[i].position.y - drones[j].position.y, 2) +
                    Math.pow(drones[i].position.z - drones[j].position.z, 2)
                );
                
                if (distance < 10) {
                    collisions.push({
                        drone1: drones[i].id,
                        drone2: drones[j].id,
                        distance: distance
                    });
                }
            }
        }
        
        return collisions;
    }
}

// 资源分配器
class ResourceAllocator {
    allocateMission(mission, availableDrones) {
        // 智能资源分配算法
        const suitableDrones = availableDrones.filter(drone => 
            drone.battery > 30 && drone.status === 'online'
        );
        
        return suitableDrones.length > 0 ? suitableDrones[0] : null;
    }
}

// 全局变量
let commandCenter;

// 页面加载完成后初始化
window.addEventListener('DOMContentLoaded', () => {
    commandCenter = new CommandCenterSystem();
    window.commandCenter = commandCenter;
    
    // 响应窗口大小变化
    window.addEventListener('resize', () => commandCenter.handleResize());
});

// 全局函数
function executeEmergencyStop() {
    if (commandCenter) {
        commandCenter.executeEmergencyStop();
    }
}

function manualControl() {
    if (commandCenter && commandCenter.layers.operational.flightControl) {
        commandCenter.layers.operational.flightControl.setMode('manual');
    }
}

function autoMode() {
    if (commandCenter && commandCenter.layers.operational.flightControl) {
        commandCenter.layers.operational.flightControl.setMode('auto');
    }
}

function voiceCommand() {
    if (commandCenter && commandCenter.layers.operational.flightControl) {
        commandCenter.layers.operational.flightControl.setMode('voice');
    }
}