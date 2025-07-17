// 多机协同编队控制系统 - 五星难度实现
// 实现智能编队算法、实时协同控制、动态调整
class FormationControlSystem {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.drones = [];
        this.currentFormation = 'line';
        this.formationParameters = {
            spacing: 20,
            altitudeDelta: 5,
            speed: 8,
            precision: 98
        };
        this.isFormationActive = false;
        this.formationCenter = { x: 0, y: 25, z: 0 };
        this.formationRadius = 50;
        
        this.init();
    }

    init() {
        this.setup3DScene();
        this.generateDroneSwarm();
        this.setupFormationControls();
        this.startRealTimeUpdates();
        this.initializeFormationAlgorithms();
    }

    // 初始化3D场景
    setup3DScene() {
        const container = document.getElementById('formation-canvas');
        if (!container) return;

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
        this.camera.position.set(100, 75, 100);
        this.camera.lookAt(0, 25, 0);

        // 创建渲染器
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: container, 
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
        
        // 添加网格和坐标轴
        const gridHelper = new THREE.GridHelper(200, 20, 0x475569, 0x334155);
        this.scene.add(gridHelper);

        const axesHelper = new THREE.AxesHelper(50);
        this.scene.add(axesHelper);

        // 鼠标控制
        this.setupCameraControls();

        // 开始渲染循环
        this.animate();
    }

    createTerrain() {
        // 创建飞行区域地形
        const geometry = new THREE.PlaneGeometry(200, 200, 50, 50);
        const material = new THREE.MeshLambertMaterial({ 
            color: 0x1e293b, 
            transparent: true, 
            opacity: 0.8 
        });
        
        // 添加地形起伏
        const vertices = geometry.attributes.position.array;
        for (let i = 0; i < vertices.length; i += 3) {
            vertices[i + 2] = Math.sin(vertices[i] * 0.05) * Math.cos(vertices[i + 1] * 0.05) * 3;
        }
        geometry.attributes.position.needsUpdate = true;
        geometry.computeVertexNormals();
        
        const terrain = new THREE.Mesh(geometry, material);
        terrain.rotation.x = -Math.PI / 2;
        terrain.receiveShadow = true;
        this.scene.add(terrain);
    }

    setupCameraControls() {
        let mouseX = 0, mouseY = 0;
        let targetRotationX = 0, targetRotationY = 0;
        let isMouseDown = false;

        const canvas = document.getElementById('formation-canvas');
        
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
            const newDistance = Math.max(30, Math.min(200, distance + delta));
            
            this.camera.position.normalize().multiplyScalar(newDistance);
        });

        const updateCamera = () => {
            const radius = this.camera.position.length();
            this.camera.position.x = radius * Math.sin(targetRotationY) * Math.cos(targetRotationX);
            this.camera.position.y = 50 + radius * Math.sin(targetRotationX);
            this.camera.position.z = radius * Math.cos(targetRotationY) * Math.cos(targetRotationX);
            this.camera.lookAt(0, 25, 0);
        };

        setInterval(updateCamera, 16);
    }

    // 生成无人机蜂群
    generateDroneSwarm() {
        const droneConfigs = [
            { id: 'DJI-001', battery: 87, signal: 95, role: 'leader' },
            { id: 'DJI-002', battery: 92, signal: 89, role: 'follower' },
            { id: 'DJI-003', battery: 78, signal: 96, role: 'follower' },
            { id: 'DJI-004', battery: 95, signal: 92, role: 'follower' },
            { id: 'DJI-005', battery: 83, signal: 87, role: 'follower' },
            { id: 'DJI-006', battery: 90, signal: 94, role: 'follower' }
        ];

        this.drones = droneConfigs.map((config, index) => ({
            id: config.id,
            currentPosition: { 
                x: (Math.random() - 0.5) * 20, 
                y: 25 + (Math.random() - 0.5) * 10, 
                z: (Math.random() - 0.5) * 20 
            },
            targetPosition: { x: 0, y: 25, z: 0 },
            velocity: { x: 0, y: 0, z: 0 },
            battery: config.battery,
            signal: config.signal,
            role: config.role,
            formationIndex: index,
            model: null,
            trail: []
        }));

        this.createDroneModels();
    }

    createDroneModels() {
        this.drones.forEach(drone => {
            const droneGroup = new THREE.Group();
            
            // 创建无人机主体
            const bodyGeometry = new THREE.BoxGeometry(2, 0.8, 2);
            const bodyMaterial = new THREE.MeshLambertMaterial({ 
                color: drone.role === 'leader' ? 0xef4444 : 0x10b981 
            });
            const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
            body.castShadow = true;
            droneGroup.add(body);

            // 添加旋翼
            for (let i = 0; i < 4; i++) {
                const angle = (i * Math.PI) / 2;
                const rotorGeometry = new THREE.CylinderGeometry(1, 1, 0.1);
                const rotorMaterial = new THREE.MeshLambertMaterial({ color: 0x374151 });
                const rotor = new THREE.Mesh(rotorGeometry, rotorMaterial);
                rotor.position.set(Math.cos(angle) * 1.5, 0.4, Math.sin(angle) * 1.5);
                droneGroup.add(rotor);
            }

            // 添加状态指示灯
            const lightGeometry = new THREE.SphereGeometry(0.2);
            const lightMaterial = new THREE.MeshBasicMaterial({ 
                color: this.getBatteryColor(drone.battery) 
            });
            const light = new THREE.Mesh(lightGeometry, lightMaterial);
            light.position.set(0, 0.8, 0);
            droneGroup.add(light);

            // 添加标签
            const labelGeometry = new THREE.PlaneGeometry(3, 1);
            const labelMaterial = new THREE.MeshBasicMaterial({ 
                color: 0x1e293b, 
                transparent: true, 
                opacity: 0.8 
            });
            const label = new THREE.Mesh(labelGeometry, labelMaterial);
            label.position.set(0, 2, 0);
            label.lookAt(0, 2, 1);
            droneGroup.add(label);

            // 添加轨迹线
            const trailGeometry = new THREE.BufferGeometry();
            const trailMaterial = new THREE.LineBasicMaterial({ 
                color: drone.role === 'leader' ? 0xef4444 : 0x10b981,
                transparent: true,
                opacity: 0.6
            });
            const trail = new THREE.Line(trailGeometry, trailMaterial);
            this.scene.add(trail);
            drone.trailMesh = trail;

            droneGroup.position.set(drone.currentPosition.x, drone.currentPosition.y, drone.currentPosition.z);
            drone.model = droneGroup;
            drone.model.userData = drone;
            this.scene.add(droneGroup);
        });
    }

    getBatteryColor(battery) {
        if (battery > 70) return 0x10b981;
        if (battery > 30) return 0xf59e0b;
        return 0xef4444;
    }

    // 初始化编队算法
    initializeFormationAlgorithms() {
        this.formationAlgorithms = {
            line: this.generateLineFormation.bind(this),
            column: this.generateColumnFormation.bind(this),
            diamond: this.generateDiamondFormation.bind(this),
            circle: this.generateCircleFormation.bind(this),
            vShape: this.generateVShapeFormation.bind(this),
            echelon: this.generateEchelonFormation.bind(this)
        };
    }

    // 设置编队控制
    setupFormationControls() {
        // 编队模板选择
        document.querySelectorAll('.template-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.template-btn').forEach(b => b.classList.remove('active'));
                e.target.closest('.template-btn').classList.add('active');
                
                this.currentFormation = e.target.closest('.template-btn').dataset.formation;
                this.updateFormation();
                this.updatePreview();
            });
        });

        // 参数控制
        const sliders = {
            'spacing-slider': (value) => {
                this.formationParameters.spacing = parseInt(value);
                this.updateFormation();
            },
            'altitude-slider': (value) => {
                this.formationParameters.altitudeDelta = parseInt(value);
                this.updateFormation();
            },
            'speed-slider': (value) => {
                this.formationParameters.speed = parseInt(value);
                this.updateFormation();
            },
            'precision-slider': (value) => {
                this.formationParameters.precision = parseInt(value);
                this.updateFormation();
            }
        };

        Object.keys(sliders).forEach(sliderId => {
            const slider = document.getElementById(sliderId);
            if (slider) {
                slider.addEventListener('input', (e) => {
                    sliders[sliderId](e.target.value);
                });
            }
        });

        // 编队动作按钮
        window.startFormation = this.startFormation.bind(this);
        window.pauseFormation = this.pauseFormation.bind(this);
        window.resetFormation = this.resetFormation.bind(this);
        window.emergencyFormation = this.emergencyFormation.bind(this);
    }

    // 生成编队目标位置
    generateLineFormation() {
        const positions = [];
        const spacing = this.formationParameters.spacing;
        const halfCount = (this.drones.length - 1) / 2;
        
        this.drones.forEach((drone, index) => {
            positions.push({
                x: (index - halfCount) * spacing,
                y: 25 + (index % 2) * this.formationParameters.altitudeDelta,
                z: 0
            });
        });
        
        return positions;
    }

    generateColumnFormation() {
        const positions = [];
        const spacing = this.formationParameters.spacing;
        
        this.drones.forEach((drone, index) => {
            positions.push({
                x: 0,
                y: 25 + index * this.formationParameters.altitudeDelta,
                z: index * spacing
            });
        });
        
        return positions;
    }

    generateDiamondFormation() {
        const positions = [];
        const spacing = this.formationParameters.spacing;
        
        // 菱形编队布局
        const layout = [
            { x: 0, y: 0, z: 0 },           // 中心
            { x: -spacing, y: 0, z: -spacing }, // 左上
            { x: spacing, y: 0, z: -spacing },  // 右上
            { x: -spacing, y: 0, z: spacing },  // 左下
            { x: spacing, y: 0, z: spacing },   // 右下
            { x: 0, y: 0, z: -spacing * 1.5 }   // 前点
        ];
        
        this.drones.forEach((drone, index) => {
            const pos = layout[index % layout.length];
            positions.push({
                x: pos.x,
                y: 25 + pos.y + index * this.formationParameters.altitudeDelta,
                z: pos.z
            });
        });
        
        return positions;
    }

    generateCircleFormation() {
        const positions = [];
        const radius = this.formationParameters.spacing * 1.5;
        const angleStep = (2 * Math.PI) / this.drones.length;
        
        this.drones.forEach((drone, index) => {
            const angle = index * angleStep;
            positions.push({
                x: Math.cos(angle) * radius,
                y: 25 + index * this.formationParameters.altitudeDelta,
                z: Math.sin(angle) * radius
            });
        });
        
        return positions;
    }

    generateVShapeFormation() {
        const positions = [];
        const spacing = this.formationParameters.spacing;
        
        this.drones.forEach((drone, index) => {
            const side = index % 2 === 0 ? -1 : 1;
            const row = Math.floor(index / 2);
            positions.push({
                x: side * spacing * (row + 1),
                y: 25 + index * this.formationParameters.altitudeDelta,
                z: -spacing * (row + 1)
            });
        });
        
        // 添加领头无人机
        if (this.drones.length > 0) {
            positions.unshift({
                x: 0,
                y: 25,
                z: spacing * 2
            });
        }
        
        return positions;
    }

    generateEchelonFormation() {
        const positions = [];
        const spacing = this.formationParameters.spacing;
        
        this.drones.forEach((drone, index) => {
            positions.push({
                x: index * spacing * 0.8,
                y: 25 + index * this.formationParameters.altitudeDelta,
                z: index * spacing * 0.6
            });
        });
        
        return positions;
    }

    // 更新编队
    updateFormation() {
        if (!this.formationAlgorithms[this.currentFormation]) return;
        
        const positions = this.formationAlgorithms[this.currentFormation]();
        
        this.drones.forEach((drone, index) => {
            if (positions[index]) {
                drone.targetPosition = {
                    x: this.formationCenter.x + positions[index].x,
                    y: positions[index].y,
                    z: this.formationCenter.z + positions[index].z
                };
            }
        });
    }

    // 启动编队
    startFormation() {
        this.isFormationActive = true;
        this.updateFormation();
        
        // 显示成功消息
        this.showFormationStatus('编队已启动', 'success');
    }

    // 暂停编队
    pauseFormation() {
        this.isFormationActive = false;
        this.showFormationStatus('编队已暂停', 'warning');
    }

    // 重置编队
    resetFormation() {
        this.isFormationActive = false;
        
        // 重置到初始位置
        this.drones.forEach((drone, index) => {
            drone.targetPosition = {
                x: (Math.random() - 0.5) * 20,
                y: 25 + (Math.random() - 0.5) * 10,
                z: (Math.random() - 0.5) * 20
            };
        });
        
        this.showFormationStatus('编队已重置', 'info');
    }

    // 紧急分散
    emergencyFormation() {
        this.isFormationActive = false;
        
        // 执行紧急分散算法
        this.drones.forEach((drone, index) => {
            const angle = (index / this.drones.length) * 2 * Math.PI;
            const distance = 50;
            drone.targetPosition = {
                x: this.formationCenter.x + Math.cos(angle) * distance,
                y: 25 + Math.random() * 20,
                z: this.formationCenter.z + Math.sin(angle) * distance
            };
        });
        
        this.showFormationStatus('紧急分散已执行', 'error');
    }

    // 实时更新
    startRealTimeUpdates() {
        setInterval(() => {
            this.updateDronePositions();
            this.updateMetrics();
            this.checkFormationIntegrity();
        }, 50);
    }

    updateDronePositions() {
        this.drones.forEach(drone => {
            // 平滑移动算法
            const dx = drone.targetPosition.x - drone.currentPosition.x;
            const dy = drone.targetPosition.y - drone.currentPosition.y;
            const dz = drone.targetPosition.z - drone.currentPosition.z;
            
            const smoothingFactor = 0.05;
            drone.currentPosition.x += dx * smoothingFactor;
            drone.currentPosition.y += dy * smoothingFactor;
            drone.currentPosition.z += dz * smoothingFactor;
            
            // 更新速度
            drone.velocity.x = dx * smoothingFactor;
            drone.velocity.y = dy * smoothingFactor;
            drone.velocity.z = dz * smoothingFactor;
            
            if (drone.model) {
                drone.model.position.set(
                    drone.currentPosition.x,
                    drone.currentPosition.y,
                    drone.currentPosition.z
                );
                
                // 旋翼旋转动画
                drone.model.rotation.y += 0.1;
            }
            
            // 更新轨迹
            this.updateDroneTrail(drone);
        });
    }

    updateDroneTrail(drone) {
        drone.trail.push({
            x: drone.currentPosition.x,
            y: drone.currentPosition.y,
            z: drone.currentPosition.z,
            timestamp: Date.now()
        });
        
        // 限制轨迹长度
        if (drone.trail.length > 50) {
            drone.trail.shift();
        }
        
        // 更新轨迹显示
        if (drone.trailMesh) {
            const positions = drone.trail.flatMap(point => [point.x, point.y, point.z]);
            drone.trailMesh.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            drone.trailMesh.geometry.attributes.position.needsUpdate = true;
        }
    }

    updateMetrics() {
        // 计算编队精度
        const precision = this.calculateFormationPrecision();
        
        // 计算同步率
        const synchronization = this.calculateSynchronization();
        
        // 计算响应时间
        const responseTime = this.calculateResponseTime();
        
        // 计算稳定性
        const stability = this.calculateStability();
        
        // 更新UI显示
        this.updateMetricDisplay('formation-precision', precision.toFixed(1) + '%');
        this.updateMetricDisplay('synchronization', synchronization.toFixed(1) + '%');
        this.updateMetricDisplay('response-time', responseTime.toFixed(1) + 's');
        this.updateMetricDisplay('stability', stability.toFixed(1) + '%');
    }

    calculateFormationPrecision() {
        // 基于所有无人机与目标位置的偏差计算精度
        let totalDeviation = 0;
        
        this.drones.forEach(drone => {
            const dx = drone.targetPosition.x - drone.currentPosition.x;
            const dy = drone.targetPosition.y - drone.currentPosition.y;
            const dz = drone.targetPosition.z - drone.currentPosition.z;
            
            const deviation = Math.sqrt(dx * dx + dy * dy + dz * dz);
            totalDeviation += deviation;
        });
        
        const avgDeviation = totalDeviation / this.drones.length;
        return Math.max(0, 100 - avgDeviation * 2);
    }

    calculateSynchronization() {
        // 基于所有无人机的速度同步程度计算同步率
        const leader = this.drones.find(d => d.role === 'leader') || this.drones[0];
        let totalSyncError = 0;
        
        this.drones.forEach(drone => {
            const dx = Math.abs(drone.velocity.x - leader.velocity.x);
            const dy = Math.abs(drone.velocity.y - leader.velocity.y);
            const dz = Math.abs(drone.velocity.z - leader.velocity.z);
            
            totalSyncError += (dx + dy + dz);
        });
        
        return Math.max(0, 100 - totalSyncError * 5);
    }

    calculateResponseTime() {
        // 模拟响应时间计算
        return 0.5 + Math.random() * 0.5;
    }

    calculateStability() {
        // 基于编队一致性计算稳定性
        const positions = this.drones.map(drone => drone.currentPosition);
        const centroid = this.calculateCentroid(positions);
        
        let totalVariance = 0;
        positions.forEach(pos => {
            const dx = pos.x - centroid.x;
            const dy = pos.y - centroid.y;
            const dz = pos.z - centroid.z;
            totalVariance += (dx * dx + dy * dy + dz * dz);
        });
        
        return Math.max(0, 100 - Math.sqrt(totalVariance));
    }

    calculateCentroid(positions) {
        const centroid = { x: 0, y: 0, z: 0 };
        positions.forEach(pos => {
            centroid.x += pos.x;
            centroid.y += pos.y;
            centroid.z += pos.z;
        });
        
        const count = positions.length;
        centroid.x /= count;
        centroid.y /= count;
        centroid.z /= count;
        
        return centroid;
    }

    checkFormationIntegrity() {
        // 检查编队完整性
        let offlineDrones = 0;
        this.drones.forEach(drone => {
            if (drone.battery < 20 || drone.signal < 50) {
                offlineDrones++;
            }
        });
        
        // 更新活跃编队数量
        this.updateFormationStatus();
    }

    updateFormationStatus() {
        const activeFormations = this.isFormationActive ? 1 : 0;
        const coordinationScore = (this.calculateFormationPrecision() + 
                                  this.calculateSynchronization() + 
                                  this.calculateStability()) / 3;
        
        document.getElementById('active-formations').textContent = activeFormations;
        document.getElementById('coordination-score').textContent = coordinationScore.toFixed(0) + '%';
    }

    updateMetricDisplay(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        }
    }

    updatePreview() {
        const preview = document.getElementById('formation-preview');
        if (preview) {
            const formationNames = {
                line: '横队',
                column: '纵队',
                diamond: '菱形',
                circle: '圆形',
                vShape: 'V字队',
                echelon: '梯队'
            };
            
            preview.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
                    <div style="font-size: 1.5rem;">${this.getFormationIcon(this.currentFormation)}</div>
                    <div style="font-size: 0.875rem; font-weight: 500;">${formationNames[this.currentFormation]}</div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary);">
                        ${this.drones.length}架无人机 | 间距${this.formationParameters.spacing}米
                    </div>
                </div>
            `;
        }
    }

    getFormationIcon(formation) {
        const icons = {
            line: '➖',
            column: '⬆️',
            diamond: '⬟',
            circle: '⭕',
            vShape: 'V',
            echelon: '⟋'
        };
        return icons[formation] || '❓';
    }

    showFormationStatus(message, type) {
        const colors = {
            success: '#10b981',
            warning: '#f59e0b',
            error: '#ef4444',
            info: '#3b82f6'
        };
        
        console.log(`%c${message}`, `color: ${colors[type]}`);
    }

    // 高级编队算法
    calculateOptimalFormation(droneCount, formationType, constraints) {
        // 基于约束条件的最优化编队计算
        const positions = [];
        const spacing = constraints.spacing || 20;
        const altitudeRange = constraints.altitudeRange || 10;
        
        switch (formationType) {
            case 'adaptive':
                return this.calculateAdaptiveFormation(droneCount, constraints);
            case 'dynamic':
                return this.calculateDynamicFormation(droneCount, constraints);
            default:
                return this.generateLineFormation();
        }
    }

    calculateAdaptiveFormation(droneCount, constraints) {
        // 基于环境约束的自适应编队算法
        const positions = [];
        const { windSpeed, obstacles, batteryLevels } = constraints;
        
        // 根据风速调整编队间距
        const adjustedSpacing = constraints.spacing * (1 + windSpeed * 0.1);
        
        // 根据电池电量分配位置
        const sortedByBattery = [...this.drones].sort((a, b) => b.battery - a.battery);
        
        for (let i = 0; i < droneCount; i++) {
            positions.push({
                x: (i - droneCount / 2) * adjustedSpacing,
                y: 25 + i * constraints.altitudeDelta,
                z: 0,
                priority: sortedByBattery[i].battery
            });
        }
        
        return positions;
    }

    calculateDynamicFormation(droneCount, constraints) {
        // 基于实时环境的动态编队算法
        const positions = [];
        const center = constraints.center || { x: 0, y: 25, z: 0 };
        const radius = constraints.radius || 50;
        
        // 使用螺旋布局实现动态调整
        for (let i = 0; i < droneCount; i++) {
            const angle = (i / droneCount) * 2 * Math.PI;
            const r = radius * Math.sqrt(i / droneCount);
            positions.push({
                x: center.x + Math.cos(angle) * r,
                y: center.y + i * constraints.altitudeDelta,
                z: center.z + Math.sin(angle) * r
            });
        }
        
        return positions;
    }

    // 故障恢复算法
    handleDroneFailure(failedDroneId) {
        const failedIndex = this.drones.findIndex(d => d.id === failedDroneId);
        if (failedIndex === -1) return;
        
        // 重新计算编队以适应缺失的无人机
        const remainingDrones = this.drones.filter(d => d.id !== failedDroneId);
        const newPositions = this.calculateOptimalFormation(
            remainingDrones.length,
            this.currentFormation,
            this.formationParameters
        );
        
        remainingDrones.forEach((drone, index) => {
            if (newPositions[index]) {
                drone.targetPosition = newPositions[index];
            }
        });
        
        this.showFormationStatus(`无人机 ${failedDroneId} 故障，编队已重新调整`, 'warning');
    }

    // 碰撞避免算法
    avoidCollision(avoidanceRadius = 15) {
        this.drones.forEach((drone1, i) => {
            this.drones.forEach((drone2, j) => {
                if (i !== j) {
                    const dx = drone1.currentPosition.x - drone2.currentPosition.x;
                    const dy = drone1.currentPosition.y - drone2.currentPosition.y;
                    const dz = drone1.currentPosition.z - drone2.currentPosition.z;
                    
                    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                    
                    if (distance < avoidanceRadius) {
                        // 计算避让向量
                        const avoidanceVector = {
                            x: (dx / distance) * (avoidanceRadius - distance),
                            y: (dy / distance) * (avoidanceRadius - distance),
                            z: (dz / distance) * (avoidanceRadius - distance)
                        };
                        
                        // 应用避让
                        drone1.targetPosition.x += avoidanceVector.x;
                        drone1.targetPosition.y += avoidanceVector.y;
                        drone1.targetPosition.z += avoidanceVector.z;
                    }
                }
            });
        });
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    handleResize() {
        const container = document.getElementById('formation-canvas');
        if (container && this.camera && this.renderer) {
            this.camera.aspect = container.clientWidth / container.clientHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(container.clientWidth, container.clientHeight);
        }
    }
}

// 编队控制管理器
class FormationManager {
    constructor() {
        this.formations = new Map();
        this.formationSystem = new FormationControlSystem();
        this.savedFormations = [];
    }

    saveFormation(name, config) {
        this.savedFormations.push({
            name,
            config,
            timestamp: new Date().toISOString()
        });
    }

    loadFormation(name) {
        const formation = this.savedFormations.find(f => f.name === name);
        if (formation) {
            this.formationSystem.currentFormation = formation.config.type;
            this.formationSystem.formationParameters = formation.config.parameters;
            this.formationSystem.updateFormation();
        }
    }

    exportFormation() {
        return {
            formation: this.formationSystem.currentFormation,
            parameters: this.formationSystem.formationParameters,
            drones: this.formationSystem.drones.map(d => ({
                id: d.id,
                position: d.currentPosition,
                battery: d.battery,
                signal: d.signal
            }))
        };
    }
}

// 智能编队算法
class SmartFormationAlgorithm {
    static calculateOptimalPath(drones, targetFormation, constraints) {
        // 使用A*算法计算最优路径
        const paths = [];
        
        drones.forEach((drone, index) => {
            const path = this.aStarPathfinding(
                drone.currentPosition,
                targetFormation[index],
                constraints
            );
            paths.push(path);
        });
        
        return paths;
    }

    static aStarPathfinding(start, end, constraints) {
        // 简化的A*算法实现
        const path = [start];
        const steps = 20;
        
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            path.push({
                x: start.x + (end.x - start.x) * t,
                y: start.y + (end.y - start.y) * t,
                z: start.z + (end.z - start.z) * t
            });
        }
        
        return path;
    }
}

// 实时监控面板
class FormationMonitor {
    constructor(formationSystem) {
        this.formationSystem = formationSystem;
        this.metrics = {
            precision: 0,
            synchronization: 0,
            stability: 0,
            responseTime: 0
        };
    }

    update() {
        this.metrics.precision = this.formationSystem.calculateFormationPrecision();
        this.metrics.synchronization = this.formationSystem.calculateSynchronization();
        this.metrics.stability = this.formationSystem.calculateStability();
        this.metrics.responseTime = this.formationSystem.calculateResponseTime();
        
        this.updateDisplay();
    }

    updateDisplay() {
        const elements = [
            'formation-precision',
            'synchronization',
            'response-time',
            'stability'
        ];
        
        elements.forEach(elementId => {
            const element = document.getElementById(elementId);
            if (element) {
                const value = this.metrics[elementId.replace('-', '')] || this.metrics[elementId];
                if (typeof value === 'number') {
                    element.textContent = value.toFixed(1) + (elementId.includes('time') ? 's' : '%');
                }
            }
        });
    }
}

// 全局变量
let formationControl;
let formationManager;
let formationMonitor;

// 页面加载完成后初始化
window.addEventListener('DOMContentLoaded', () => {
    formationControl = new FormationControlSystem();
    formationManager = new FormationManager();
    formationMonitor = new FormationMonitor(formationControl);
    
    window.formationControl = formationControl;
    window.formationManager = formationManager;
    
    // 启动监控
    setInterval(() => {
        formationMonitor.update();
    }, 1000);
    
    // 响应窗口大小变化
    window.addEventListener('resize', () => {
        formationControl.handleResize();
    });
});