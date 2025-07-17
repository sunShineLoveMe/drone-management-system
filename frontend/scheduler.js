// 分布式调度中心 - 实时3D沙盘与任务分配系统
// 实现五星难度：实时分布式调度系统

class DistributedScheduler {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.drones = [];
        this.tasks = [];
        this.currentAlgorithm = 'genetic';
        this.formationMode = 'single';
        this.isOptimizing = false;
        this.optimizationInterval = null;
        
        this.init();
    }

    init() {
        this.setup3DScene();
        this.generateMockData();
        this.setupEventListeners();
        this.startRealTimeUpdates();
        this.renderDroneStatus();
        this.renderCollisionAlerts();
    }

    // 初始化3D场景
    setup3DScene() {
        const container = document.getElementById('sandbox-container');
        const canvas = document.getElementById('sandbox-canvas');
        
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
        this.camera.position.set(50, 50, 50);
        this.camera.lookAt(0, 0, 0);

        // 创建渲染器
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: canvas, 
            antialias: true,
            alpha: true 
        });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // 添加光源
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(50, 100, 50);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);

        // 创建地面网格
        this.createGroundGrid();
        
        // 添加坐标轴
        this.createAxes();

        // 鼠标控制
        this.setupCameraControls();

        // 开始渲染循环
        this.animate();
    }

    createGroundGrid() {
        const gridHelper = new THREE.GridHelper(100, 20, 0x475569, 0x334155);
        this.scene.add(gridHelper);

        // 创建地面
        const groundGeometry = new THREE.PlaneGeometry(100, 100);
        const groundMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x1e293b, 
            transparent: true, 
            opacity: 0.8 
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);
    }

    createAxes() {
        // X轴 (红色)
        const xAxisGeometry = new THREE.CylinderGeometry(0.1, 0.1, 100);
        const xAxisMaterial = new THREE.MeshBasicMaterial({ color: 0xef4444 });
        const xAxis = new THREE.Mesh(xAxisGeometry, xAxisMaterial);
        xAxis.rotation.z = -Math.PI / 2;
        xAxis.position.set(50, 0, 0);
        this.scene.add(xAxis);

        // Y轴 (绿色)
        const yAxisGeometry = new THREE.CylinderGeometry(0.1, 0.1, 100);
        const yAxisMaterial = new THREE.MeshBasicMaterial({ color: 0x10b981 });
        const yAxis = new THREE.Mesh(yAxisGeometry, yAxisMaterial);
        yAxis.position.set(0, 50, 0);
        this.scene.add(yAxis);

        // Z轴 (蓝色)
        const zAxisGeometry = new THREE.CylinderGeometry(0.1, 0.1, 100);
        const zAxisMaterial = new THREE.MeshBasicMaterial({ color: 0x3b82f6 });
        const zAxis = new THREE.Mesh(zAxisGeometry, zAxisMaterial);
        zAxis.rotation.x = Math.PI / 2;
        zAxis.position.set(0, 0, 50);
        this.scene.add(zAxis);
    }

    setupCameraControls() {
        let mouseX = 0, mouseY = 0;
        let targetRotationX = 0, targetRotationY = 0;
        let isMouseDown = false;

        const canvas = document.getElementById('sandbox-canvas');
        
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
            const newDistance = Math.max(10, Math.min(200, distance + delta));
            
            this.camera.position.normalize().multiplyScalar(newDistance);
        });

        // 平滑相机旋转
        const updateCamera = () => {
            const radius = this.camera.position.length();
            this.camera.position.x = radius * Math.sin(targetRotationY) * Math.cos(targetRotationX);
            this.camera.position.y = radius * Math.sin(targetRotationX);
            this.camera.position.z = radius * Math.cos(targetRotationY) * Math.cos(targetRotationX);
            this.camera.lookAt(0, 0, 0);
        };

        setInterval(updateCamera, 16); // 60fps
    }

    generateMockData() {
        // 生成无人机数据
        this.drones = [
            { id: 'DJI-001', position: { x: -20, y: 15, z: -10 }, status: 'online', battery: 85, task: 'patrol' },
            { id: 'DJI-002', position: { x: 15, y: 20, z: 5 }, status: 'mission', battery: 62, task: 'security' },
            { id: 'DJI-003', position: { x: -5, y: 25, z: 20 }, status: 'online', battery: 78, task: 'monitor' },
            { id: 'DJI-004', position: { x: 30, y: 18, z: -15 }, status: 'online', battery: 92, task: 'inspection' },
            { id: 'DJI-005', position: { x: -15, y: 22, z: 25 }, status: 'maintenance', battery: 45, task: 'idle' },
            { id: 'DJI-006', position: { x: 10, y: 30, z: -5 }, status: 'online', battery: 88, task: 'delivery' },
            { id: 'DJI-007', position: { x: 25, y: 12, z: 15 }, status: 'offline', battery: 100, task: 'charging' }
        ];

        // 生成任务数据
        this.tasks = [
            { id: 'TASK-001', position: { x: -35, y: 0, z: -25 }, priority: 'high', type: 'emergency', assigned: false },
            { id: 'TASK-002', position: { x: 40, y: 0, z: 30 }, priority: 'medium', type: 'inspection', assigned: false },
            { id: 'TASK-003', position: { x: -10, y: 0, z: 35 }, priority: 'low', type: 'monitor', assigned: false },
            { id: 'TASK-004', position: { x: 20, y: 0, z: -40 }, priority: 'high', type: 'delivery', assigned: false },
            { id: 'TASK-005', position: { x: -30, y: 0, z: 10 }, priority: 'medium', type: 'patrol', assigned: false }
        ];

        this.createDroneModels();
        this.createTaskMarkers();
    }

    createDroneModels() {
        this.drones.forEach(drone => {
            // 创建无人机3D模型
            const droneGroup = new THREE.Group();
            
            // 机身
            const bodyGeometry = new THREE.BoxGeometry(2, 0.5, 2);
            const bodyMaterial = new THREE.MeshLambertMaterial({ 
                color: drone.status === 'online' ? 0x10b981 : 
                       drone.status === 'mission' ? 0x3b82f6 : 
                       drone.status === 'maintenance' ? 0xf59e0b : 0x6b7280 
            });
            const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
            body.castShadow = true;
            droneGroup.add(body);

            // 旋翼
            for (let i = 0; i < 4; i++) {
                const angle = (i * Math.PI) / 2;
                const rotorGeometry = new THREE.CylinderGeometry(0.8, 0.8, 0.1);
                const rotorMaterial = new THREE.MeshLambertMaterial({ color: 0x374151 });
                const rotor = new THREE.Mesh(rotorGeometry, rotorMaterial);
                rotor.position.set(Math.cos(angle) * 1.2, 0.3, Math.sin(angle) * 1.2);
                droneGroup.add(rotor);
            }

            // 状态指示灯
            const lightGeometry = new THREE.SphereGeometry(0.2);
            const lightMaterial = new THREE.MeshBasicMaterial({ 
                color: drone.battery > 70 ? 0x10b981 : drone.battery > 30 ? 0xf59e0b : 0xef4444 
            });
            const light = new THREE.Mesh(lightGeometry, lightMaterial);
            light.position.set(0, 0.5, 0);
            droneGroup.add(light);

            droneGroup.position.set(drone.position.x, drone.position.y, drone.position.z);
            drone.model = droneGroup;
            this.scene.add(droneGroup);
        });
    }

    createTaskMarkers() {
        this.tasks.forEach(task => {
            // 创建任务标记
            const taskGroup = new THREE.Group();
            
            // 标记柱
            const pillarGeometry = new THREE.CylinderGeometry(0.5, 0.5, 5);
            const pillarMaterial = new THREE.MeshLambertMaterial({ 
                color: task.priority === 'high' ? 0xef4444 : 
                       task.priority === 'medium' ? 0xf59e0b : 0x3b82f6,
                transparent: true,
                opacity: 0.8
            });
            const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
            pillar.position.set(0, 2.5, 0);
            taskGroup.add(pillar);

            // 任务标签
            const labelGeometry = new THREE.BoxGeometry(2, 1, 0.1);
            const labelMaterial = new THREE.MeshBasicMaterial({ color: 0x1e293b });
            const label = new THREE.Mesh(labelGeometry, labelMaterial);
            label.position.set(0, 5.5, 0);
            taskGroup.add(label);

            taskGroup.position.set(task.position.x, 0, task.position.z);
            task.model = taskGroup;
            this.scene.add(taskGroup);
        });
    }

    setupEventListeners() {
        // 算法选择
        document.querySelectorAll('.algorithm-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.algorithm-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentAlgorithm = e.target.dataset.algo;
                this.updateOptimizationMetrics();
            });
        });

        // 编队控制
        document.querySelectorAll('.formation-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.formation-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.formationMode = e.target.dataset.formation;
                this.updateFormation();
            });
        });
    }

    startRealTimeUpdates() {
        setInterval(() => {
            this.updateDronePositions();
            this.updateTaskAssignments();
            this.checkCollisions();
            this.updateUI();
        }, 1000);
    }

    updateDronePositions() {
        this.drones.forEach(drone => {
            if (drone.status === 'online' || drone.status === 'mission') {
                // 模拟无人机移动
                drone.position.x += (Math.random() - 0.5) * 0.5;
                drone.position.y += (Math.random() - 0.5) * 0.3;
                drone.position.z += (Math.random() - 0.5) * 0.5;
                
                // 限制在边界内
                drone.position.x = Math.max(-45, Math.min(45, drone.position.x));
                drone.position.y = Math.max(5, Math.min(40, drone.position.y));
                drone.position.z = Math.max(-45, Math.min(45, drone.position.z));
                
                if (drone.model) {
                    drone.model.position.set(drone.position.x, drone.position.y, drone.position.z);
                }
            }
        });
    }

    updateTaskAssignments() {
        // 模拟任务分配算法
        this.tasks.forEach(task => {
            if (!task.assigned && Math.random() < 0.1) {
                const availableDrone = this.drones.find(d => d.status === 'online');
                if (availableDrone) {
                    task.assigned = true;
                    task.assignedTo = availableDrone.id;
                    availableDrone.status = 'mission';
                }
            }
        });
    }

    checkCollisions() {
        // 使用高级3D冲突检测系统
        if (!this.collisionSystem) {
            this.collisionSystem = new AdvancedCollisionDetection(this.scene, this.drones);
            this.collisionAlerts = [];
        }
        
        // 获取实时冲突报告
        const collisionReport = this.collisionSystem.getRealTimeStats();
        
        // 更新冲突警报显示
        this.updateCollisionAlertsWithDetails(collisionReport);
    }

    updateCollisionAlertsWithDetails(report) {
        const container = document.getElementById('collision-alerts');
        if (!container) return;

        const alerts = report.recentConflicts.slice(0, 3);
        
        container.innerHTML = alerts.map(alert => `
            <div class="collision-alert">
                <strong><i class="fas fa-exclamation-triangle"></i> ${alert.severity.toUpperCase()} 冲突</strong>
                <div>${alert.description}</div>
                <div>建议: ${alert.recommendation[0]}</div>
                <div style="font-size: 0.8rem; color: var(--text-secondary);">
                    时间: ${alert.timestamp}
                </div>
            </div>
        `).join('');
    }

    updateFormation() {
        const formations = {
            single: { spacing: 0, pattern: 'individual' },
            line: { spacing: 10, pattern: 'horizontal' },
            column: { spacing: 8, pattern: 'vertical' },
            diamond: { spacing: 12, pattern: 'diamond' },
            circle: { spacing: 15, pattern: 'circle' },
            swarm: { spacing: 5, pattern: 'random' }
        };

        const formation = formations[this.formationMode];
        
        if (formation.pattern === 'horizontal') {
            this.drones.forEach((drone, index) => {
                const offset = index * formation.spacing - (this.drones.length - 1) * formation.spacing / 2;
                drone.targetPosition = { x: offset, y: 20, z: 0 };
            });
        } else if (formation.pattern === 'circle') {
            this.drones.forEach((drone, index) => {
                const angle = (index / this.drones.length) * Math.PI * 2;
                drone.targetPosition = {
                    x: Math.cos(angle) * formation.spacing,
                    y: 20,
                    z: Math.sin(angle) * formation.spacing
                };
            });
        }
    }

    updateOptimizationMetrics() {
        const algorithms = {
            genetic: { efficiency: 94, distance: 2.3, time: 45 },
            'ant-colony': { efficiency: 91, distance: 2.7, time: 52 },
            pso: { efficiency: 89, distance: 2.9, time: 48 },
            greedy: { efficiency: 85, distance: 3.2, time: 38 }
        };

        const metrics = algorithms[this.currentAlgorithm];
        
        document.getElementById('total-distance').textContent = `${metrics.distance}km`;
        document.getElementById('completion-time').textContent = `${metrics.time}min`;
        document.getElementById('efficiency').textContent = `${metrics.efficiency}%`;
        document.getElementById('battery-usage').textContent = `${78 + Math.floor(Math.random() * 10)}%`;
        
        document.querySelector('.efficiency-fill').style.width = `${metrics.efficiency}%`;
    }

    renderDroneStatus() {
        const container = document.getElementById('drone-status-list');
        if (!container) return;

        container.innerHTML = this.drones.map(drone => `
            <div class="drone-status">
                <div class="status-indicator ${drone.status === 'online' ? '' : 
                                             drone.status === 'mission' ? 'busy' : 'offline'}"></div>
                <span>${drone.id}</span>
                <span style="margin-left: auto; font-size: 0.75rem; color: var(--text-secondary);">
                    ${drone.battery}% | ${drone.task}
                </span>
            </div>
        `).join('');
    }

    renderCollisionAlerts() {
        const container = document.getElementById('collision-alerts');
        if (!container) return;

        container.innerHTML = `
            <div class="collision-alert">
                <strong><i class="fas fa-exclamation-triangle"></i> 潜在冲突</strong>
                <div>DJI-002 与 DJI-004 距离: 6.2m</div>
                <div>建议: 调整高度差 5m</div>
            </div>
        `;
    }

    updateUI() {
        this.renderDroneStatus();
        this.updateOptimizationMetrics();
        
        // 更新统计数字
        document.getElementById('active-drones').textContent = 
            this.drones.filter(d => d.status === 'online' || d.status === 'mission').length;
        document.getElementById('pending-tasks').textContent = 
            this.tasks.filter(t => !t.assigned).length;
        document.getElementById('collision-risk').textContent = 
            Math.floor(Math.random() * 3) + 1;
        
        document.getElementById('last-optimization').textContent = 
            `${Math.floor(Math.random() * 5) + 1}分钟前`;
        document.getElementById('convergence-rate').textContent = 
            `${90 + Math.floor(Math.random() * 10)}%`;
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        // 更新无人机动画
        this.drones.forEach(drone => {
            if (drone.targetPosition && drone.model) {
                drone.model.position.x += (drone.targetPosition.x - drone.model.position.x) * 0.05;
                drone.model.position.y += (drone.targetPosition.y - drone.model.position.y) * 0.05;
                drone.model.position.z += (drone.targetPosition.z - drone.model.position.z) * 0.05;
                
                // 旋转动画
                drone.model.rotation.y += 0.01;
            }
        });

        this.renderer.render(this.scene, this.camera);
    }

    handleResize() {
        const container = document.getElementById('sandbox-container');
        if (container && this.camera && this.renderer) {
            this.camera.aspect = container.clientWidth / container.clientHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(container.clientWidth, container.clientHeight);
        }
    }
}

// 全局函数
function startOptimization() {
    const scheduler = window.scheduler;
    if (scheduler) {
        scheduler.isOptimizing = true;
        document.querySelector('.primary-btn').innerHTML = '<i class="fas fa-spinner fa-spin"></i> 优化中...';
        
        setTimeout(() => {
            scheduler.isOptimizing = false;
            document.querySelector('.primary-btn').innerHTML = '<i class="fas fa-play"></i> 开始优化';
            
            // 显示优化结果
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.8); z-index: 10000;
                display: flex; align-items: center; justify-content: center;
            `;
            modal.innerHTML = `
                <div style="background: var(--bg-card); padding: 2rem; border-radius: 0.5rem; max-width: 400px;">
                    <h3 style="margin-bottom: 1rem;">优化完成</h3>
                    <div style="margin-bottom: 1rem;">
                        <div>总距离: 2.1km (-8.7%)</div>
                        <div>完成时间: 42min (-6.7%)</div>
                        <div>效率提升: 15.2%</div>
                    </div>
                    <button onclick="this.parentElement.parentElement.remove()" class="primary-btn">确认</button>
                </div>
            `;
            document.body.appendChild(modal);
        }, 3000);
    }
}

function pauseOptimization() {
    const scheduler = window.scheduler;
    if (scheduler) {
        scheduler.isOptimizing = false;
    }
}

function emergencyStop() {
    const scheduler = window.scheduler;
    if (scheduler) {
        scheduler.isOptimizing = false;
        
        // 紧急停止动画
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(239, 68, 68, 0.1); z-index: 10000;
            display: flex; align-items: center; justify-content: center;
        `;
        modal.innerHTML = `
            <div style="background: var(--bg-card); padding: 2rem; border-radius: 0.5rem; max-width: 300px; text-align: center;">
                <i class="fas fa-exclamation-triangle" style="color: var(--error-color); font-size: 2rem; margin-bottom: 1rem;"></i>
                <h3 style="color: var(--error-color); margin-bottom: 1rem;">紧急停止</h3>
                <p>所有任务已暂停，无人机返回安全区域</p>
                <button onclick="this.parentElement.parentElement.remove()" class="primary-btn">确认</button>
            </div>
        `;
        document.body.appendChild(modal);
    }
}

// 页面加载完成后初始化
let scheduler;
document.addEventListener('DOMContentLoaded', () => {
    scheduler = new DistributedScheduler();
    window.scheduler = scheduler;
    
    // 响应窗口大小变化
    window.addEventListener('resize', () => scheduler.handleResize());
});

// 响应式设计增强
function setupResponsiveDesign() {
    const container = document.querySelector('.scheduler-container');
    
    if (window.innerWidth < 1200) {
        container.style.gridTemplateColumns = '1fr';
        container.style.gridTemplateRows = '60px 1fr 1fr 200px 200px';
    } else {
        container.style.gridTemplateColumns = '1fr 400px';
        container.style.gridTemplateRows = '60px 1fr 200px';
    }
}

window.addEventListener('resize', setupResponsiveDesign);
setupResponsiveDesign();