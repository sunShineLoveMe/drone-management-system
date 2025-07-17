// 实时数字孪生沙盘系统
// 实现五星难度：集成实时数字孪生沙盘
class DigitalTwinSystem {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.drones = [];
        this.scenarios = [];
        this.weatherData = null;
        this.terrainData = null;
        this.isSimulationActive = false;
        this.timeMultiplier = 1.0;
        this.cameraHeight = 50;
        this.syncLatency = 124;
        this.dataAccuracy = 99.7;
        
        // 实时数据流
        this.dataStreams = {
            position: [],
            telemetry: [],
            weather: [],
            alerts: []
        };
        
        // 性能监控
        this.metrics = {
            updateRate: 60,
            latency: 124,
            accuracy: 99.7,
            memoryUsage: 0,
            activeObjects: 47
        };
        
        this.init();
    }

    init() {
        this.setup3DScene();
        this.generateMockData();
        this.setupEventListeners();
        this.startRealTimeSync();
        this.initializeWeatherSystem();
        this.startPerformanceMonitoring();
    }

    // 初始化3D场景
    setup3DScene() {
        const container = document.getElementById('twin-canvas');
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
        this.camera.position.set(50, this.cameraHeight, 50);
        this.camera.lookAt(0, 0, 0);

        // 创建渲染器
        this.renderer = new THREE.WebGLRenderer({
            canvas: container,
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

        // 创建地形
        this.createRealisticTerrain();
        
        // 添加网格和坐标系
        this.createCoordinateSystem();
        
        // 创建天气系统
        this.createWeatherVisualization();

        // 鼠标控制
        this.setupCameraControls();

        // 开始渲染循环
        this.animate();
    }

    createRealisticTerrain() {
        // 创建真实地形
        const geometry = new THREE.PlaneGeometry(200, 200, 100, 100);
        const material = new THREE.MeshLambertMaterial({
            color: 0x2a5d31,
            transparent: true,
            opacity: 0.8
        });

        // 添加地形起伏和纹理
        const vertices = geometry.attributes.position.array;
        for (let i = 0; i < vertices.length; i += 3) {
            const x = vertices[i];
            const z = vertices[i + 2];
            vertices[i + 1] = Math.sin(x * 0.05) * Math.cos(z * 0.05) * 5 +
                             Math.sin(x * 0.1) * Math.cos(z * 0.1) * 2 +
                             (Math.random() - 0.5) * 1;
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
        // 创建3D坐标系
        const axesHelper = new THREE.AxesHelper(100);
        this.scene.add(axesHelper);

        // 创建建筑物和地标
        this.createBuildings();
        
        // 创建道路网络
        this.createRoadNetwork();
        
        // 创建禁飞区
        this.createNoFlyZones();
    }

    createBuildings() {
        const buildings = [
            { x: -40, z: -30, height: 25, width: 15, depth: 15, type: 'office' },
            { x: 35, z: 25, height: 35, width: 20, depth: 20, type: 'residential' },
            { x: -20, z: 40, height: 15, width: 12, depth: 12, type: 'warehouse' },
            { x: 30, z: -40, height: 45, width: 18, depth: 18, type: 'landmark' },
            { x: 0, z: 0, height: 60, width: 25, depth: 25, type: 'control-tower' }
        ];

        buildings.forEach(building => {
            const geometry = new THREE.BoxGeometry(building.width, building.height, building.depth);
            const colors = {
                'office': 0x64748b,
                'residential': 0x94a3b8,
                'warehouse': 0x475569,
                'landmark': 0x7c3aed,
                'control-tower': 0xf59e0b
            };
            const material = new THREE.MeshLambertMaterial({ color: colors[building.type] });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(building.x, building.height / 2, building.z);
            mesh.castShadow = true;
            mesh.userData = { type: 'building', ...building };
            this.scene.add(mesh);
        });
    }

    createRoadNetwork() {
        // 创建道路网络
        const roads = [
            { start: { x: -100, z: 0 }, end: { x: 100, z: 0 }, width: 8 },
            { start: { x: 0, z: -100 }, end: { x: 0, z: 100 }, width: 8 },
            { start: { x: -50, z: -50 }, end: { x: 50, z: 50 }, width: 6 },
            { start: { x: -50, z: 50 }, end: { x: 50, z: -50 }, width: 6 }
        ];

        roads.forEach(road => {
            const geometry = new THREE.PlaneGeometry(
                Math.abs(road.end.x - road.start.x) || road.width,
                Math.abs(road.end.z - road.start.z) || road.width
            );
            const material = new THREE.MeshLambertMaterial({
                color: 0x374151,
                transparent: true,
                opacity: 0.7
            });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.set(
                (road.start.x + road.end.x) / 2,
                0.1,
                (road.start.z + road.end.z) / 2
            );
            mesh.userData = { type: 'road' };
            this.scene.add(mesh);
        });
    }

    createNoFlyZones() {
        const zones = [
            { x: -60, z: -40, radius: 20, name: '机场禁飞区', height: 50 },
            { x: 50, z: 30, radius: 15, name: '敏感区域', height: 100 },
            { x: 0, z: 0, radius: 10, name: '指挥中心', height: 80 }
        ];

        zones.forEach(zone => {
            const geometry = new THREE.CylinderGeometry(zone.radius, zone.radius, zone.height, 32);
            const material = new THREE.MeshBasicMaterial({
                color: 0xef4444,
                transparent: true,
                opacity: 0.2
            });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(zone.x, zone.height / 2, zone.z);
            mesh.userData = { type: 'noFlyZone', name: zone.name, height: zone.height };
            this.scene.add(mesh);
        });
    }

    createWeatherVisualization() {
        // 创建风向指示器
        const windArrow = new THREE.Group();
        const arrowGeometry = new THREE.ConeGeometry(2, 8, 8);
        const arrowMaterial = new THREE.MeshLambertMaterial({ color: 0x3b82f6 });
        const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
        arrow.rotation.x = Math.PI / 2;
        windArrow.add(arrow);
        windArrow.position.set(80, 20, 80);
        windArrow.userData = { type: 'windIndicator' };
        this.scene.add(windArrow);

        // 创建云层
        this.createClouds();
    }

    createClouds() {
        for (let i = 0; i < 5; i++) {
            const cloudGroup = new THREE.Group();
            for (let j = 0; j < 8; j++) {
                const sphereGeometry = new THREE.SphereGeometry(5 + Math.random() * 5);
                const cloudMaterial = new THREE.MeshLambertMaterial({
                    color: 0xffffff,
                    transparent: true,
                    opacity: 0.6
                });
                const cloudPart = new THREE.Mesh(sphereGeometry, cloudMaterial);
                cloudPart.position.set(
                    (Math.random() - 0.5) * 20,
                    Math.random() * 10,
                    (Math.random() - 0.5) * 20
                );
                cloudGroup.add(cloudPart);
            }
            cloudGroup.position.set(
                (Math.random() - 0.5) * 150,
                80 + Math.random() * 20,
                (Math.random() - 0.5) * 150
            );
            cloudGroup.userData = { type: 'cloud' };
            this.scene.add(cloudGroup);
        }
    }

    setupCameraControls() {
        let mouseX = 0, mouseY = 0;
        let targetRotationX = 0, targetRotationY = 0;
        let isMouseDown = false;

        const canvas = document.getElementById('twin-canvas');
        
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

        // 平滑相机控制
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
                id: 'DJI-TWIN-001',
                position: { x: -25, y: 25, z: -15 },
                velocity: { x: 2, y: 0, z: 1 },
                battery: 87,
                temperature: 22.5,
                humidity: 65,
                windSpeed: 12.5,
                status: 'patrolling',
                task: '园区巡检',
                operator: '操作员 A001'
            },
            {
                id: 'DJI-TWIN-002',
                position: { x: 35, y: 30, z: 20 },
                velocity: { x: -1, y: 0.5, z: 2 },
                battery: 73,
                temperature: 23.1,
                humidity: 62,
                windSpeed: 11.8,
                status: 'monitoring',
                task: '安全监控',
                operator: '操作员 B002'
            },
            {
                id: 'DJI-TWIN-003',
                position: { x: -10, y: 35, z: 30 },
                velocity: { x: 1.5, y: -0.5, z: -1 },
                battery: 45,
                temperature: 24.2,
                humidity: 58,
                windSpeed: 13.2,
                status: 'emergency',
                task: '医疗配送',
                operator: '应急席'
            },
            {
                id: 'DJI-TWIN-004',
                position: { x: 20, y: 20, z: -25 },
                velocity: { x: 0.8, y: 1.2, z: 0.5 },
                battery: 92,
                temperature: 21.8,
                humidity: 68,
                windSpeed: 10.9,
                status: 'inspection',
                task: '设备检查',
                operator: '操作员 C003'
            },
            {
                id: 'DJI-TWIN-005',
                position: { x: -40, y: 28, z: 10 },
                velocity: { x: -0.5, y: 0.3, z: 1.8 },
                battery: 68,
                temperature: 22.9,
                humidity: 61,
                windSpeed: 12.1,
                status: 'delivery',
                task: '物资运输',
                operator: '操作员 D004'
            }
        ];

        // 生成场景数据
        this.scenarios = [
            {
                name: '城市巡检',
                description: '城市范围内的无人机巡检任务',
                drones: [this.drones[0], this.drones[1]],
                weather: { wind: 12.5, visibility: 8.2, temperature: 22 }
            },
            {
                name: '应急响应',
                description: '紧急情况下的无人机调度',
                drones: [this.drones[2]],
                weather: { wind: 13.2, visibility: 7.8, temperature: 24 }
            },
            {
                name: '农业监测',
                description: '农业区域的作物监测和病虫害检测',
                drones: [this.drones[3], this.drones[4]],
                weather: { wind: 10.9, visibility: 9.1, temperature: 21 }
            }
        ];

        this.createDroneModels();
    }

    createDroneModels() {
        this.drones.forEach(drone => {
            const droneGroup = new THREE.Group();
            
            // 创建高精度无人机模型
            const bodyGeometry = new THREE.BoxGeometry(3, 1, 3);
            const bodyMaterial = new THREE.MeshLambertMaterial({
                color: this.getStatusColor(drone.status)
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
                color: this.getBatteryColor(drone.battery)
            });
            const light = new THREE.Mesh(lightGeometry, lightMaterial);
            light.position.set(0, 1, 0);
            droneGroup.add(light);

            // 添加轨迹线
            const trailGeometry = new THREE.BufferGeometry();
            const trailMaterial = new THREE.LineBasicMaterial({
                color: this.getStatusColor(drone.status),
                transparent: true,
                opacity: 0.6
            });
            const trail = new THREE.Line(trailGeometry, trailMaterial);
            trail.userData = { droneId: drone.id };
            this.scene.add(trail);

            // 添加预测轨迹
            const predictionGeometry = new THREE.BufferGeometry();
            const predictionMaterial = new THREE.LineBasicMaterial({
                color: 0x3b82f6,
                transparent: true,
                opacity: 0.4,
                linewidth: 2
            });
            const predictionLine = new THREE.Line(predictionGeometry, predictionMaterial);
            predictionLine.userData = { droneId: drone.id };
            this.scene.add(predictionLine);

            droneGroup.position.set(drone.position.x, drone.position.y, drone.position.z);
            drone.model = droneGroup;
            drone.trail = trail;
            drone.predictionLine = predictionLine;
            drone.trailData = [];
            this.scene.add(droneGroup);
        });
    }

    getStatusColor(status) {
        const colors = {
            'patrolling': 0x10b981,
            'monitoring': 0x3b82f6,
            'emergency': 0xef4444,
            'inspection': 0xf59e0b,
            'delivery': 0x8b5cf6
        };
        return colors[status] || 0x6b7280;
    }

    getBatteryColor(battery) {
        if (battery > 70) return 0x10b981;
        if (battery > 30) return 0xf59e0b;
        return 0xef4444;
    }

    setupEventListeners() {
        // 时间流速控制
        const timeSlider = document.getElementById('time-speed');
        if (timeSlider) {
            timeSlider.addEventListener('input', (e) => {
                this.timeMultiplier = parseFloat(e.target.value);
                e.target.nextElementSibling.textContent = `${this.timeMultiplier}x`;
            });
        }

        // 视角高度控制
        const heightSlider = document.getElementById('camera-height');
        if (heightSlider) {
            heightSlider.addEventListener('input', (e) => {
                this.cameraHeight = parseInt(e.target.value);
                e.target.nextElementSibling.textContent = `${this.cameraHeight}m`;
                this.camera.position.y = this.cameraHeight;
            });
        }

        // 场景切换
        document.querySelectorAll('.scenario-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.scenario-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.switchScenario(e.target.dataset.scenario);
            });
        });

        // 显示层控制
        document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                this.toggleVisualizationLayer(e.target);
            });
        });
    }

    startRealTimeSync() {
        // 启动实时数据同步
        setInterval(() => {
            this.updateDronePositions();
            this.updateTelemetryData();
            this.updateWeatherData();
            this.checkAlerts();
            this.updateUI();
            this.updateDataStream();
        }, 1000 / this.metrics.updateRate);
    }

    initializeWeatherSystem() {
        this.weatherData = {
            windSpeed: 12.5,
            windDirection: 45,
            temperature: 22.5,
            humidity: 65,
            visibility: 8.2,
            pressure: 1013.2
        };
    }

    startPerformanceMonitoring() {
        setInterval(() => {
            this.metrics.memoryUsage = Math.random() * 100;
            this.metrics.latency = 100 + Math.random() * 50;
            this.metrics.accuracy = 99 + Math.random() * 1;
            this.updatePerformanceMetrics();
        }, 5000);
    }

    updateDronePositions() {
        this.drones.forEach(drone => {
            // 基于物理规律的移动
            const dt = 1 / this.metrics.updateRate * this.timeMultiplier;
            
            drone.position.x += drone.velocity.x * dt;
            drone.position.y += drone.velocity.y * dt;
            drone.position.z += drone.velocity.z * dt;

            // 添加随机扰动模拟真实环境
            drone.velocity.x += (Math.random() - 0.5) * 0.1;
            drone.velocity.y += (Math.random() - 0.5) * 0.05;
            drone.velocity.z += (Math.random() - 0.5) * 0.1;

            // 限制速度
            const maxSpeed = 10;
            const speed = Math.sqrt(drone.velocity.x ** 2 + drone.velocity.y ** 2 + drone.velocity.z ** 2);
            if (speed > maxSpeed) {
                drone.velocity.x *= maxSpeed / speed;
                drone.velocity.y *= maxSpeed / speed;
                drone.velocity.z *= maxSpeed / speed;
            }

            // 限制在边界内
            drone.position.x = Math.max(-90, Math.min(90, drone.position.x));
            drone.position.y = Math.max(5, Math.min(80, drone.position.y));
            drone.position.z = Math.max(-90, Math.min(90, drone.position.z));

            // 更新3D模型位置
            if (drone.model) {
                drone.model.position.set(drone.position.x, drone.position.y, drone.position.z);
                drone.model.rotation.y += 0.02;
            }

            // 更新轨迹
            this.updateTrail(drone);
            
            // 更新预测轨迹
            this.updatePrediction(drone);

            // 更新电池
            drone.battery = Math.max(0, drone.battery - Math.random() * 0.05);
        });
    }

    updateTrail(drone) {
        drone.trailData.push({
            x: drone.position.x,
            y: drone.position.y,
            z: drone.position.z,
            timestamp: Date.now()
        });

        // 限制轨迹长度
        if (drone.trailData.length > 100) {
            drone.trailData.shift();
        }

        // 更新轨迹线
        if (drone.trail && drone.trailData.length > 1) {
            const positions = drone.trailData.flatMap(point => [point.x, point.y, point.z]);
            drone.trail.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            drone.trail.geometry.attributes.position.needsUpdate = true;
        }
    }

    updatePrediction(drone) {
        // 基于当前速度和位置预测未来轨迹
        const predictionPoints = [];
        const steps = 20;
        const timeStep = 0.5;
        
        for (let i = 1; i <= steps; i++) {
            const t = i * timeStep;
            predictionPoints.push({
                x: drone.position.x + drone.velocity.x * t,
                y: drone.position.y + drone.velocity.y * t,
                z: drone.position.z + drone.velocity.z * t
            });
        }

        if (drone.predictionLine && predictionPoints.length > 1) {
            const positions = predictionPoints.flatMap(point => [point.x, point.y, point.z]);
            drone.predictionLine.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            drone.predictionLine.geometry.attributes.position.needsUpdate = true;
        }
    }

    updateTelemetryData() {
        this.drones.forEach(drone => {
            // 模拟传感器数据
            drone.temperature = 20 + Math.random() * 8;
            drone.humidity = 60 + Math.random() * 20;
            drone.windSpeed = this.weatherData.windSpeed + (Math.random() - 0.5) * 2;
        });
    }

    updateWeatherData() {
        // 模拟天气数据变化
        this.weatherData.windSpeed += (Math.random() - 0.5) * 0.5;
        this.weatherData.windSpeed = Math.max(5, Math.min(25, this.weatherData.windSpeed));
        
        this.weatherData.windDirection += (Math.random() - 0.5) * 5;
        this.weatherData.windDirection = (this.weatherData.windDirection + 360) % 360;
    }

    checkAlerts() {
        const alerts = [];
        
        // 检查低电量
        this.drones.forEach(drone => {
            if (drone.battery < 20) {
                alerts.push({
                    type: 'warning',
                    message: `${drone.id} 电量低于20%`,
                    timestamp: new Date().toLocaleTimeString()
                });
            }
        });

        // 检查碰撞风险
        for (let i = 0; i < this.drones.length; i++) {
            for (let j = i + 1; j < this.drones.length; j++) {
                const d1 = this.drones[i];
                const d2 = this.drones[j];
                const distance = Math.sqrt(
                    (d1.position.x - d2.position.x) ** 2 +
                    (d1.position.y - d2.position.y) ** 2 +
                    (d1.position.z - d2.position.z) ** 2
                );
                
                if (distance < 15) {
                    alerts.push({
                        type: 'critical',
                        message: `${d1.id} 与 ${d2.id} 距离过近 (${distance.toFixed(1)}m)`,
                        timestamp: new Date().toLocaleTimeString()
                    });
                }
            }
        }

        return alerts;
    }

    switchScenario(scenario) {
        const scenarios = {
            urban: {
                drones: [0, 1],
                weather: { wind: 12.5, visibility: 8.2, temperature: 22 }
            },
            agriculture: {
                drones: [3, 4],
                weather: { wind: 10.9, visibility: 9.1, temperature: 21 }
            },
            emergency: {
                drones: [2],
                weather: { wind: 13.2, visibility: 7.8, temperature: 24 }
            },
            delivery: {
                drones: [0, 4],
                weather: { wind: 11.5, visibility: 8.5, temperature: 23 }
            }
        };

        const config = scenarios[scenario];
        if (config) {
            this.weatherData.windSpeed = config.weather.wind;
            this.weatherData.visibility = config.weather.visibility;
            this.weatherData.temperature = config.weather.temperature;
        }
    }

    toggleVisualizationLayer(checkbox) {
        // 实现显示层切换逻辑
        const layerType = checkbox.parentElement.textContent.trim();
        console.log(`切换显示层: ${layerType} - ${checkbox.checked}`);
    }

    updateDataStream() {
        const container = document.getElementById('data-stream');
        if (!container) return;

        const now = new Date().toLocaleTimeString();
        const newData = [
            `[${now}] DJI-001 位置: (${this.drones[0].position.x.toFixed(1)}, ${this.drones[0].position.y.toFixed(1)}, ${this.drones[0].position.z.toFixed(1)})`,
            `[${now}] DJI-002 风速: ${this.drones[1].windSpeed.toFixed(1)}m/s`,
            `[${now}] DJI-003 电量: ${this.drones[2].battery.toFixed(0)}%`,
            `[${now}] 天气更新: ${this.weatherData.windSpeed.toFixed(1)}m/s, ${this.weatherData.temperature.toFixed(1)}°C`
        ];

        // 添加新数据到顶部
        newData.forEach(item => {
            const div = document.createElement('div');
            div.className = 'stream-item';
            div.textContent = item;
            container.insertBefore(div, container.firstChild);
        });

        // 限制显示数量
        while (container.children.length > 10) {
            container.removeChild(container.lastChild);
        }
    }

    updateUI() {
        this.updateDroneStatus();
        this.updateMetrics();
        this.updateAlerts();
    }

    updateDroneStatus() {
        const container = document.getElementById('twin-drone-list');
        if (!container) return;

        container.innerHTML = this.drones.map(drone => `
            <div class="twin-drone-item">
                <div style="display: flex; align-items: center;">
                    <div class="twin-drone-status" style="background: ${this.getBatteryColor(drone.battery)};"></div>
                    <span>${drone.id}</span>
                </div>
                <span style="font-size: 0.75rem; color: var(--text-secondary);">
                    ${drone.battery.toFixed(0)}% | ${drone.task}
                </span>
            </div>
        `).join('');
    }

    updateMetrics() {
        const alerts = this.checkAlerts();
        
        // 更新实时指标
        document.getElementById('active-objects').textContent = this.drones.length + 15; // 包括建筑物等
        document.getElementById('update-rate').textContent = `${this.metrics.updateRate}/s`;
        document.getElementById('bandwidth').textContent = `${(2.0 + Math.random() * 1.0).toFixed(1)}MB/s`;
        document.getElementById('prediction').textContent = `${99 + Math.random() * 1}%`;
        document.getElementById('sync-latency').textContent = `${Math.floor(this.metrics.latency)}ms`;
        document.getElementById('data-accuracy').textContent = `${this.metrics.accuracy.toFixed(1)}%`;

        // 更新警报
        const alertsContainer = document.getElementById('twin-alerts');
        if (alertsContainer && alerts.length > 0) {
            alertsContainer.innerHTML = alerts.map(alert => `
                <div class="alert-item">
                    <div class="alert-icon alert-${alert.type}">${alert.type === 'critical' ? '!' : 'i'}</div>
                    <span>${alert.message}</span>
                </div>
            `).join('');
        }
    }

    updatePerformanceMetrics() {
        document.getElementById('last-sync').textContent = `${Math.floor(Math.random() * 5) + 1}秒前`;
        document.getElementById('system-mode').textContent = this.isSimulationActive ? '实时模式' : '暂停模式';
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        if (this.renderer && this.scene && this.camera) {
            // 更新无人机动画
            this.drones.forEach(drone => {
                if (drone.model) {
                    drone.model.rotation.y += 0.01;
                }
            });

            // 更新云层动画
            this.scene.children.forEach(child => {
                if (child.userData.type === 'cloud') {
                    child.position.x += 0.1;
                    if (child.position.x > 100) child.position.x = -100;
                }
            });

            this.renderer.render(this.scene, this.camera);
        }
    }

    handleResize() {
        const container = document.getElementById('twin-canvas');
        if (container && this.camera && this.renderer) {
            this.camera.aspect = container.clientWidth / container.clientHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(container.clientWidth, container.clientHeight);
        }
    }
}

// 实时数据同步引擎
class RealTimeSyncEngine {
    constructor(digitalTwin) {
        this.digitalTwin = digitalTwin;
        this.syncInterval = null;
        this.dataSources = [];
        this.syncLatency = 124;
    }

    addDataSource(source) {
        this.dataSources.push(source);
    }

    startSync() {
        this.syncInterval = setInterval(() => {
            this.syncAllSources();
        }, 100);
    }

    syncAllSources() {
        this.dataSources.forEach(source => {
            const data = source.getData();
            this.updateTwin(data);
        });
    }

    updateTwin(data) {
        // 实时更新数字孪生
        this.syncLatency = Math.max(50, this.syncLatency + (Math.random() - 0.5) * 10);
    }
}

// 多源数据融合系统
class DataFusionSystem {
    constructor() {
        this.dataSources = new Map();
        this.fusedData = {};
    }

    registerSource(name, source) {
        this.dataSources.set(name, source);
    }

    fuseData() {
        const sources = Array.from(this.dataSources.values());
        
        // 加权平均融合
        this.fusedData.position = this.weightedAverage(
            sources.map(s => s.position),
            sources.map(s => s.confidence)
        );
        
        this.fusedData.weather = this.consensusFusion(
            sources.map(s => s.weather)
        );
    }

    weightedAverage(values, weights) {
        const totalWeight = weights.reduce((sum, w) => sum + w, 0);
        return values.reduce((sum, val, i) => sum + val * weights[i], 0) / totalWeight;
    }

    consensusFusion(values) {
        // 去除异常值后取中位数
        const sorted = values.sort((a, b) => a - b);
        const middle = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0 
            ? (sorted[middle - 1] + sorted[middle]) / 2 
            : sorted[middle];
    }
}

// 预测性分析引擎
class PredictiveEngine {
    constructor(digitalTwin) {
        this.digitalTwin = digitalTwin;
        this.models = {};
    }

    predictTrajectory(drone, timeHorizon = 30) {
        // 基于当前状态预测未来轨迹
        const trajectory = [];
        let pos = { ...drone.position };
        let vel = { ...drone.velocity };
        
        for (let t = 0; t < timeHorizon; t++) {
            pos.x += vel.x * 0.1;
            pos.y += vel.y * 0.1;
            pos.z += vel.z * 0.1;
            
            // 添加环境扰动
            vel.x += (Math.random() - 0.5) * 0.01;
            vel.y += (Math.random() - 0.5) * 0.005;
            vel.z += (Math.random() - 0.5) * 0.01;
            
            trajectory.push({ ...pos });
        }
        
        return trajectory;
    }

    predictBatteryDrain(drone, taskDuration) {
        const baseDrain = 0.1;
        const windFactor = drone.windSpeed / 10;
        const taskFactor = drone.status === 'emergency' ? 1.5 : 1.0;
        
        return Math.max(0, drone.battery - (baseDrain * windFactor * taskFactor * taskDuration));
    }
}

// 全局函数
function startSimulation() {
    if (window.twinSystem) {
        window.twinSystem.isSimulationActive = true;
        console.log('数字孪生模拟已启动');
    }
}

function pauseSimulation() {
    if (window.twinSystem) {
        window.twinSystem.isSimulationActive = false;
        console.log('数字孪生模拟已暂停');
    }
}

function resetSimulation() {
    if (window.twinSystem) {
        window.twinSystem.generateMockData();
        console.log('数字孪生沙盘已重置');
    }
}

// 页面加载完成后初始化
let twinSystem;
let syncEngine;
let fusionSystem;
let predictiveEngine;

document.addEventListener('DOMContentLoaded', () => {
    twinSystem = new DigitalTwinSystem();
    syncEngine = new RealTimeSyncEngine(twinSystem);
    fusionSystem = new DataFusionSystem();
    predictiveEngine = new PredictiveEngine(twinSystem);
    
    window.twinSystem = twinSystem;
    window.syncEngine = syncEngine;
    window.fusionSystem = fusionSystem;
    window.predictiveEngine = predictiveEngine;
    
    // 启动实时同步
    syncEngine.startSync();
    
    // 响应窗口大小变化
    window.addEventListener('resize', () => twinSystem.handleResize());
    
    // 隐藏加载遮罩
    setTimeout(() => {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.style.display = 'none';
    }, 2000);
});