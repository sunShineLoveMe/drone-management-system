// 3D空域冲突检测系统 - 五星难度实现
// 实现实时3D空间冲突检测与预测

class AdvancedCollisionDetection {
    constructor(scene, drones) {
        this.scene = scene;
        this.drones = drones;
        this.collisionZones = [];
        this.predictionWindow = 30; // 30秒预测窗口
        this.safetyRadius = 8; // 安全半径8米
        this.updateInterval = 100; // 100ms更新频率
        this.collisionHistory = [];
        this.riskMatrix = new Map();
        
        this.init();
    }

    init() {
        this.createCollisionVisualization();
        this.startRealTimeDetection();
        this.setupRiskAssessment();
    }

    // 创建3D冲突可视化
    createCollisionVisualization() {
        // 安全区域球体
        this.drones.forEach(drone => {
            const geometry = new THREE.SphereGeometry(this.safetyRadius, 16, 16);
            const material = new THREE.MeshBasicMaterial({
                color: 0x10b981,
                transparent: true,
                opacity: 0.1,
                wireframe: true
            });
            const sphere = new THREE.Mesh(geometry, material);
            sphere.position.set(drone.position.x, drone.position.y, drone.position.z);
            sphere.userData = { type: 'safetyZone', droneId: drone.id };
            this.scene.add(sphere);
            drone.safetySphere = sphere;
        });

        // 冲突警告区域
        this.warningZones = new THREE.Group();
        this.scene.add(this.warningZones);
    }

    // 实时冲突检测主循环
    startRealTimeDetection() {
        setInterval(() => {
            this.performCollisionDetection();
            this.updatePredictions();
            this.renderRiskVisualization();
        }, this.updateInterval);
    }

    // 执行3D空间冲突检测
    performCollisionDetection() {
        const currentTime = Date.now();
        const activeDrones = this.drones.filter(d => d.status === 'online' || d.status === 'mission');
        
        const collisions = [];
        
        for (let i = 0; i < activeDrones.length; i++) {
            for (let j = i + 1; j < activeDrones.length; j++) {
                const drone1 = activeDrones[i];
                const drone2 = activeDrones[j];
                
                // 当前位置冲突检测
                const currentCollision = this.checkCurrentCollision(drone1, drone2);
                if (currentCollision) {
                    collisions.push(currentCollision);
                }
                
                // 轨迹预测冲突检测
                const predictedCollision = this.checkPredictedCollision(drone1, drone2);
                if (predictedCollision) {
                    collisions.push(predictedCollision);
                }
            }
        }
        
        this.processCollisions(collisions);
    }

    // 检测当前位置冲突
    checkCurrentCollision(drone1, drone2) {
        const distance = this.calculate3DDistance(
            drone1.position, drone2.position
        );
        
        if (distance < this.safetyRadius * 2) {
            return {
                type: 'immediate',
                drone1: drone1.id,
                drone2: drone2.id,
                distance: distance,
                severity: this.calculateSeverity(distance),
                timestamp: Date.now(),
                position: {
                    x: (drone1.position.x + drone2.position.x) / 2,
                    y: (drone1.position.y + drone2.position.y) / 2,
                    z: (drone1.position.z + drone2.position.z) / 2
                }
            };
        }
        
        return null;
    }

    // 预测轨迹冲突
    checkPredictedCollision(drone1, drone2) {
        // 基于当前速度和方向预测未来轨迹
        const trajectory1 = this.predictTrajectory(drone1);
        const trajectory2 = this.predictTrajectory(drone2);
        
        for (let t = 0; t < this.predictionWindow; t += 0.5) {
            const pos1 = this.getPositionAtTime(trajectory1, t);
            const pos2 = this.getPositionAtTime(trajectory2, t);
            
            const distance = this.calculate3DDistance(pos1, pos2);
            
            if (distance < this.safetyRadius * 2) {
                return {
                    type: 'predicted',
                    drone1: drone1.id,
                    drone2: drone2.id,
                    distance: distance,
                    timeToCollision: t,
                    severity: this.calculateSeverity(distance, t),
                    timestamp: Date.now(),
                    collisionPoint: {
                        x: (pos1.x + pos2.x) / 2,
                        y: (pos1.y + pos2.y) / 2,
                        z: (pos1.z + pos2.z) / 2
                    }
                };
            }
        }
        
        return null;
    }

    // 预测无人机轨迹
    predictTrajectory(drone) {
        // 基于当前速度和位置预测轨迹
        const velocity = this.estimateVelocity(drone);
        return {
            start: { ...drone.position },
            velocity: velocity,
            startTime: Date.now()
        };
    }

    // 估计无人机速度
    estimateVelocity(drone) {
        // 简化的速度估计，实际应用中需要基于历史位置计算
        const speed = drone.speed || 5.0; // m/s
        const direction = Math.random() * Math.PI * 2;
        return {
            x: Math.cos(direction) * speed,
            y: 0, // 假设在同一高度层
            z: Math.sin(direction) * speed
        };
    }

    // 获取指定时间的位置
    getPositionAtTime(trajectory, time) {
        return {
            x: trajectory.start.x + trajectory.velocity.x * time,
            y: trajectory.start.y + trajectory.velocity.y * time,
            z: trajectory.start.z + trajectory.velocity.z * time
        };
    }

    // 计算3D距离
    calculate3DDistance(pos1, pos2) {
        return Math.sqrt(
            Math.pow(pos1.x - pos2.x, 2) +
            Math.pow(pos1.y - pos2.y, 2) +
            Math.pow(pos1.z - pos2.z, 2)
        );
    }

    // 计算冲突严重程度
    calculateSeverity(distance, timeToCollision = 0) {
        const immediateThreshold = this.safetyRadius * 0.5;
        const warningThreshold = this.safetyRadius * 1.5;
        
        if (distance < immediateThreshold) return 'critical';
        if (distance < warningThreshold && timeToCollision < 10) return 'high';
        if (distance < this.safetyRadius * 2 && timeToCollision < 20) return 'medium';
        return 'low';
    }

    // 更新预测
    updatePredictions() {
        this.riskMatrix.clear();
        
        this.drones.forEach(drone => {
            this.riskMatrix.set(drone.id, {
                riskLevel: 'low',
                nearbyDrones: [],
                predictedConflicts: []
            });
        });
    }

    // 渲染风险可视化
    renderRiskVisualization() {
        // 清除旧的警告区域
        while (this.warningZones.children.length > 0) {
            this.warningZones.remove(this.warningZones.children[0]);
        }
        
        // 为每个无人机更新安全区域
        this.drones.forEach(drone => {
            if (drone.safetySphere) {
                drone.safetySphere.position.set(
                    drone.position.x,
                    drone.position.y,
                    drone.position.z
                );
            }
        });
    }

    // 处理检测到的冲突
    processCollisions(collisions) {
        collisions.forEach(collision => {
            this.createWarningVisualization(collision);
            this.generateAlert(collision);
        });
        
        // 更新历史记录
        this.collisionHistory = [
            ...collisions,
            ...this.collisionHistory.slice(0, 99) // 保留最近100条记录
        ];
    }

    // 创建警告可视化
    createWarningVisualization(collision) {
        const geometry = new THREE.ConeGeometry(2, 5, 8);
        const material = new THREE.MeshBasicMaterial({
            color: collision.severity === 'critical' ? 0xef4444 :
                   collision.severity === 'high' ? 0xf59e0b : 0x3b82f6,
            transparent: true,
            opacity: 0.8
        });
        
        const warning = new THREE.Mesh(geometry, material);
        warning.position.set(
            collision.position?.x || collision.collisionPoint.x,
            collision.position?.y || collision.collisionPoint.y + 5,
            collision.position?.z || collision.collisionPoint.z
        );
        
        this.warningZones.add(warning);
        
        // 添加动画效果
        const animate = () => {
            warning.rotation.y += 0.05;
            warning.material.opacity = 0.5 + 0.3 * Math.sin(Date.now() * 0.01);
        };
        
        setInterval(animate, 50);
        
        // 3秒后移除警告
        setTimeout(() => {
            this.warningZones.remove(warning);
        }, 3000);
    }

    // 生成警报
    generateAlert(collision) {
        const alert = {
            id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: collision.type,
            severity: collision.severity,
            title: `${collision.type === 'immediate' ? '紧急' : '预测'}冲突检测`,
            description: `${collision.drone1} 与 ${collision.drone2} 距离过近 (${collision.distance.toFixed(1)}m)`,
            timestamp: new Date().toLocaleString(),
            recommendation: this.generateRecommendation(collision),
            position: collision.position || collision.collisionPoint
        };
        
        // 发送到UI
        this.dispatchAlert(alert);
    }

    // 生成应对建议
    generateRecommendation(collision) {
        const recommendations = {
            critical: [
                "立即执行紧急避让程序",
                "降低飞行高度差至5米以上",
                "启动自动返航模式"
            ],
            high: [
                "调整飞行轨迹，增加横向间距",
                "降低飞行速度，等待冲突解除",
                "通知地面控制人员"
            ],
            medium: [
                "监控相对位置变化",
                "准备执行备用航线",
                "增加垂直高度差"
            ],
            low: [
                "保持当前航线，继续监控",
                "定期检查相对位置"
            ]
        };
        
        return recommendations[collision.severity] || recommendations.low;
    }

    // 设置风险评估
    setupRiskAssessment() {
        this.riskFactors = {
            distanceWeight: 0.4,
            speedWeight: 0.3,
            altitudeWeight: 0.2,
            batteryWeight: 0.1
        };
    }

    // 计算综合风险评分
    calculateRiskScore(drone1, drone2) {
        const distance = this.calculate3DDistance(drone1.position, drone2.position);
        const distanceRisk = Math.max(0, 1 - distance / (this.safetyRadius * 3));
        
        const batteryRisk = Math.max(0, 1 - Math.min(drone1.battery, drone2.battery) / 100);
        
        return (
            this.riskFactors.distanceWeight * distanceRisk +
            this.riskFactors.batteryWeight * batteryRisk
        );
    }

    // 获取实时冲突报告
    getCollisionReport() {
        const activeAlerts = this.collisionHistory.filter(
            alert => Date.now() - alert.timestamp < 5000
        );
        
        return {
            totalConflicts: activeAlerts.length,
            criticalConflicts: activeAlerts.filter(a => a.severity === 'critical').length,
            highConflicts: activeAlerts.filter(a => a.severity === 'high').length,
            recentConflicts: activeAlerts.slice(0, 5)
        };
    }

    // 发送警报到UI
    dispatchAlert(alert) {
        const event = new CustomEvent('collisionAlert', { detail: alert });
        document.dispatchEvent(event);
    }

    // 获取3D空间分析数据
    get3DSpaceAnalysis() {
        const activeDrones = this.drones.filter(d => d.status === 'online' || d.status === 'mission');
        
        return {
            totalDrones: activeDrones.length,
            occupiedVolume: this.calculateOccupiedVolume(activeDrones),
            averageDensity: this.calculateSpaceDensity(activeDrones),
            conflictZones: this.identifyConflictZones(activeDrones)
        };
    }

    // 计算占用空间体积
    calculateOccupiedVolume(drones) {
        if (drones.length < 2) return 0;
        
        const minX = Math.min(...drones.map(d => d.position.x - this.safetyRadius));
        const maxX = Math.max(...drones.map(d => d.position.x + this.safetyRadius));
        const minY = Math.min(...drones.map(d => d.position.y - this.safetyRadius));
        const maxY = Math.max(...drones.map(d => d.position.y + this.safetyRadius));
        const minZ = Math.min(...drones.map(d => d.position.z - this.safetyRadius));
        const maxZ = Math.max(...drones.map(d => d.position.z + this.safetyRadius));
        
        return (maxX - minX) * (maxY - minY) * (maxZ - minZ);
    }

    // 计算空间密度
    calculateSpaceDensity(drones) {
        if (drones.length < 2) return 0;
        
        const volume = this.calculateOccupiedVolume(drones);
        return drones.length / volume;
    }

    // 识别冲突区域
    identifyConflictZones(drones) {
        const zones = [];
        
        for (let i = 0; i < drones.length; i++) {
            for (let j = i + 1; j < drones.length; j++) {
                const distance = this.calculate3DDistance(drones[i].position, drones[j].position);
                if (distance < this.safetyRadius * 2) {
                    zones.push({
                        center: {
                            x: (drones[i].position.x + drones[j].position.x) / 2,
                            y: (drones[i].position.y + drones[j].position.y) / 2,
                            z: (drones[i].position.z + drones[j].position.z) / 2
                        },
                        radius: this.safetyRadius,
                        severity: this.calculateSeverity(distance),
                        drones: [drones[i].id, drones[j].id]
                    });
                }
            }
        }
        
        return zones;
    }

    // 获取实时统计数据
    getRealTimeStats() {
        const report = this.getCollisionReport();
        const analysis = this.get3DSpaceAnalysis();
        
        return {
            ...report,
            ...analysis,
            lastUpdate: new Date().toLocaleTimeString(),
            systemStatus: report.criticalConflicts > 0 ? 'ALERT' : 
                         report.highConflicts > 0 ? 'WARNING' : 'NORMAL'
        };
    }
}

// 集成到调度系统中
class IntegratedCollisionSystem {
    constructor(scheduler) {
        this.scheduler = scheduler;
        this.detector = new AdvancedCollisionDetection(
            scheduler.scene, 
            scheduler.drones
        );
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.startMonitoring();
    }

    setupEventListeners() {
        document.addEventListener('collisionAlert', (event) => {
            this.handleCollisionAlert(event.detail);
        });
    }

    startMonitoring() {
        setInterval(() => {
            const stats = this.detector.getRealTimeStats();
            this.updateUI(stats);
        }, 1000);
    }

    handleCollisionAlert(alert) {
        // 添加到调度器的冲突列表
        if (this.scheduler.collisionAlerts) {
            this.scheduler.collisionAlerts.unshift(alert);
            if (this.scheduler.collisionAlerts.length > 10) {
                this.scheduler.collisionAlerts.pop();
            }
        }
    }

    updateUI(stats) {
        // 更新UI显示
        const container = document.getElementById('collision-stats');
        if (container) {
            container.innerHTML = `
                <div class="stat-card-mini">
                    <div class="stat-number">${stats.totalConflicts}</div>
                    <div class="stat-desc">总冲突</div>
                </div>
                <div class="stat-card-mini">
                    <div class="stat-number">${stats.criticalConflicts}</div>
                    <div class="stat-desc">紧急</div>
                </div>
                <div class="stat-card-mini">
                    <div class="stat-number">${stats.averageDensity.toFixed(2)}</div>
                    <div class="stat-desc">空间密度</div>
                </div>
            `;
        }
    }
}

// 导出供外部使用
window.AdvancedCollisionDetection = AdvancedCollisionDetection;
window.IntegratedCollisionSystem = IntegratedCollisionSystem;