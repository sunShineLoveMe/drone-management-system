// 毫秒级视频延迟控制系统 - 五星难度实现
// 模拟WebRTC + 自适应码率 + 延迟优化

class LowLatencyVideoSystem {
    constructor() {
        this.streams = new Map();
        this.latencyTargets = {
            critical: 100,   // 100ms - 紧急任务
            normal: 250,     // 250ms - 标准任务
            monitor: 500     // 500ms - 监控任务
        };
        this.currentLatency = 150;
        this.bandwidthUsage = 0;
        this.packetLoss = 0;
        this.adaptiveBitrate = 4000; // kbps
        this.frameRate = 30;
        this.resolution = '1920x1080';
        
        this.init();
    }

    init() {
        this.setupVideoPipeline();
        this.startLatencyMonitoring();
        this.setupAdaptiveStreaming();
    }

    // 设置视频管道
    setupVideoPipeline() {
        this.videoProcessors = {
            encoder: this.createMockEncoder(),
            network: this.createMockNetwork(),
            decoder: this.createMockDecoder()
        };
    }

    // 创建模拟编码器
    createMockEncoder() {
        return {
            type: 'H.265 Hardware',
            latency: 20, // ms
            bitrate: this.adaptiveBitrate,
            keyframeInterval: 30, // frames
            compressionRatio: 0.7
        };
    }

    // 创建模拟网络
    createMockNetwork() {
        return {
            protocol: 'WebRTC UDP',
            jitter: Math.random() * 5,
            packetLoss: Math.random() * 0.02,
            bandwidth: this.simulateBandwidth(),
            rtt: this.simulateRTT()
        };
    }

    // 模拟带宽变化
    simulateBandwidth() {
        // 模拟4G/5G/WiFi网络变化
        const scenarios = [
            { type: '5G', min: 50000, max: 100000 },
            { type: '4G', min: 10000, max: 50000 },
            { type: 'WiFi', min: 20000, max: 80000 }
        ];
        
        const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
        return Math.floor(Math.random() * (scenario.max - scenario.min) + scenario.min);
    }

    // 模拟往返时延
    simulateRTT() {
        const baseRTT = Math.random() * 50 + 20; // 20-70ms
        const jitter = (Math.random() - 0.5) * 10;
        return Math.max(10, baseRTT + jitter);
    }

    // 启动延迟监控
    startLatencyMonitoring() {
        setInterval(() => {
            this.measureLatency();
            this.updateAdaptiveBitrate();
            this.renderLatencyStats();
        }, 100);
    }

    // 测量当前延迟
    measureLatency() {
        const networkLatency = this.videoProcessors.network.rtt / 2;
        const encodeLatency = this.videoProcessors.encoder.latency;
        const decodeLatency = 10; // 解码延迟
        const bufferLatency = Math.random() * 20; // 缓冲延迟
        
        this.currentLatency = Math.round(
            networkLatency + encodeLatency + decodeLatency + bufferLatency
        );
        
        this.packetLoss = this.videoProcessors.network.packetLoss;
        this.bandwidthUsage = this.videoProcessors.network.bandwidth;
    }

    // 设置自适应码率
    setupAdaptiveStreaming() {
        this.adaptiveLogic = {
            targetLatency: this.latencyTargets.normal,
            minBitrate: 500,    // kbps
            maxBitrate: 8000,   // kbps
            stepSize: 500,      // kbps调整步长
            lastAdjustment: Date.now()
        };
    }

    // 更新自适应码率
    updateAdaptiveBitrate() {
        const now = Date.now();
        if (now - this.adaptiveLogic.lastAdjustment < 1000) return;
        
        const currentLatency = this.currentLatency;
        const targetLatency = this.adaptiveLogic.targetLatency;
        const networkBandwidth = this.bandwidthUsage;
        
        let adjustment = 0;
        
        // 基于延迟调整
        if (currentLatency > targetLatency * 1.2) {
            adjustment = -this.adaptiveLogic.stepSize;
        } else if (currentLatency < targetLatency * 0.8 && 
                   this.adaptiveBitrate < networkBandwidth * 0.8) {
            adjustment = this.adaptiveLogic.stepSize;
        }
        
        // 基于网络条件调整
        if (this.packetLoss > 0.05) {
            adjustment = -this.adaptiveLogic.stepSize * 2;
        }
        
        // 应用调整
        const newBitrate = Math.max(
            this.adaptiveLogic.minBitrate,
            Math.min(this.adaptiveLogic.maxBitrate, this.adaptiveBitrate + adjustment)
        );
        
        this.adaptiveBitrate = newBitrate;
        this.videoProcessors.encoder.bitrate = newBitrate;
        
        // 动态调整帧率
        this.adjustFrameRate();
        
        this.adaptiveLogic.lastAdjustment = now;
    }

    // 调整帧率
    adjustFrameRate() {
        const targetLatency = this.adaptiveLogic.targetLatency;
        
        if (this.currentLatency > targetLatency * 1.5) {
            this.frameRate = Math.max(15, this.frameRate - 5);
        } else if (this.currentLatency < targetLatency * 0.7) {
            this.frameRate = Math.min(60, this.frameRate + 5);
        }
    }

    // 开始视频流
    startStream(droneId, streamType = 'normal') {
        const stream = {
            id: droneId,
            type: streamType,
            startTime: Date.now(),
            frames: 0,
            bytes: 0,
            latency: this.latencyTargets[streamType] || this.latencyTargets.normal,
            quality: this.calculateQuality(),
            bufferHealth: 100
        };
        
        this.streams.set(droneId, stream);
        this.simulateStream(droneId);
        
        return stream;
    }

    // 模拟视频流
    simulateStream(droneId) {
        const stream = this.streams.get(droneId);
        if (!stream) return;
        
        setInterval(() => {
            if (this.streams.has(droneId)) {
                stream.frames++;
                stream.bytes += Math.floor(this.adaptiveBitrate / 8); // 每帧平均数据
                stream.bufferHealth = this.calculateBufferHealth();
                
                this.renderStreamStats(droneId, stream);
            }
        }, 1000 / this.frameRate);
    }

    // 计算视频质量
    calculateQuality() {
        const bitrateRatio = this.adaptiveBitrate / 8000;
        const latencyRatio = this.latencyTargets.normal / this.currentLatency;
        
        return Math.min(100, Math.floor((bitrateRatio + latencyRatio) * 50));
    }

    // 计算缓冲区健康度
    calculateBufferHealth() {
        const baseHealth = 100;
        const latencyPenalty = Math.max(0, (this.currentLatency - this.latencyTargets.normal) * 2);
        const packetLossPenalty = this.packetLoss * 50;
        
        return Math.max(0, baseHealth - latencyPenalty - packetLossPenalty);
    }

    // 停止视频流
    stopStream(droneId) {
        this.streams.delete(droneId);
    }

    // 获取所有流状态
    getAllStreamStatus() {
        const status = {
            totalStreams: this.streams.size,
            averageLatency: 0,
            totalBandwidth: 0,
            streams: []
        };
        
        let totalLatency = 0;
        let totalBandwidth = 0;
        
        this.streams.forEach((stream, id) => {
            totalLatency += this.currentLatency;
            totalBandwidth += this.adaptiveBitrate;
            
            status.streams.push({
                id: id,
                type: stream.type,
                latency: this.currentLatency,
                bitrate: this.adaptiveBitrate,
                quality: stream.quality,
                frames: stream.frames,
                bufferHealth: stream.bufferHealth
            });
        });
        
        status.averageLatency = this.streams.size > 0 
            ? Math.round(totalLatency / this.streams.size) : 0;
        status.totalBandwidth = totalBandwidth;
        
        return status;
    }

    // 渲染流统计
    renderStreamStats(droneId, stream) {
        const container = document.getElementById(`video-stats-${droneId}`);
        if (container) {
            container.innerHTML = `
                <div class="video-stat-row">
                    <span>延迟: ${this.currentLatency}ms</span>
                    <span class="latency-indicator ${this.currentLatency <= this.latencyTargets.normal ? 'good' : 'warning'}"></span>
                </div>
                <div class="video-stat-row">
                    <span>码率: ${this.adaptiveBitrate}kbps</span>
                    <div class="bandwidth-bar">
                        <div class="bandwidth-fill" style="width: ${(this.adaptiveBitrate/8000)*100}%"></div>
                    </div>
                </div>
                <div class="video-stat-row">
                    <span>质量: ${stream.quality}% (${this.resolution})</span>
                </div>
                <div class="video-stat-row">
                    <span>缓冲: ${stream.bufferHealth}% </span>
                    <div class="buffer-bar">
                        <div class="buffer-fill" style="width: ${stream.bufferHealth}%"></div>
                    </div>
                </div>
            `;
        }
    }

    // 优化特定流的延迟
    optimizeStreamLatency(droneId, targetLatency) {
        const stream = this.streams.get(droneId);
        if (stream) {
            this.adaptiveLogic.targetLatency = targetLatency;
            stream.latency = targetLatency;
        }
    }

    // 获取网络质量报告
    getNetworkQualityReport() {
        return {
            currentLatency: this.currentLatency,
            targetLatency: this.adaptiveLogic.targetLatency,
            adaptiveBitrate: this.adaptiveBitrate,
            frameRate: this.frameRate,
            resolution: this.resolution,
            packetLoss: this.packetLoss,
            bandwidth: this.bandwidthUsage,
            networkType: this.videoProcessors.network.protocol,
            quality: this.calculateQuality(),
            timestamp: new Date().toLocaleTimeString()
        };
    }

    // 模拟网络故障
    simulateNetworkIssue(type = 'packet_loss') {
        const issues = {
            packet_loss: () => {
                this.packetLoss = Math.min(0.3, this.packetLoss + 0.1);
            },
            bandwidth_drop: () => {
                this.bandwidthUsage = Math.max(5000, this.bandwidthUsage * 0.5);
            },
            high_latency: () => {
                this.videoProcessors.network.rtt *= 2;
            }
        };
        
        if (issues[type]) {
            issues[type]();
            setTimeout(() => this.recoverFromIssue(type), 5000);
        }
    }

    // 从网络故障恢复
    recoverFromIssue(type) {
        const recoveries = {
            packet_loss: () => {
                this.packetLoss = Math.max(0, this.packetLoss - 0.05);
            },
            bandwidth_drop: () => {
                this.bandwidthUsage = Math.min(100000, this.bandwidthUsage * 1.5);
            },
            high_latency: () => {
                this.videoProcessors.network.rtt = this.simulateRTT();
            }
        };
        
        if (recoveries[type]) {
            recoveries[type]();
        }
    }

    // 渲染实时仪表板
    renderDashboard() {
        const container = document.getElementById('video-dashboard');
        if (container) {
            const report = this.getNetworkQualityReport();
            const streamStatus = this.getAllStreamStatus();
            
            container.innerHTML = `
                <div class="video-dashboard-grid">
                    <div class="video-stat-card">
                        <h4>网络质量</h4>
                        <div class="metric-large">${report.currentLatency}ms</div>
                        <div class="metric-label">当前延迟</div>
                        <div class="latency-gauge">
                            <div class="gauge-fill" style="width: ${Math.min(100, (report.currentLatency/500)*100)}%"></div>
                        </div>
                    </div>
                    
                    <div class="video-stat-card">
                        <h4>码率自适应</h4>
                        <div class="metric-large">${report.adaptiveBitrate}kbps</div>
                        <div class="metric-label">当前码率</div>
                        <div class="bitrate-chart" id="bitrate-history"></div>
                    </div>
                    
                    <div class="video-stat-card">
                        <h4>流状态</h4>
                        <div class="metric-large">${streamStatus.totalStreams}</div>
                        <div class="metric-label">活跃流数</div>
                        <div class="stream-list" id="active-streams"></div>
                    </div>
                    
                    <div class="video-stat-card">
                        <h4>网络状态</h4>
                        <div class="network-metrics">
                            <div>丢包率: ${(report.packetLoss * 100).toFixed(1)}%</div>
                            <div>带宽: ${(report.bandwidth/1000).toFixed(0)}Mbps</div>
                            <div>网络: ${report.networkType}</div>
                        </div>
                    </div>
                </div>
            `;
            
            this.renderStreamList(streamStatus);
        }
    }

    // 渲染流列表
    renderStreamList(streamStatus) {
        const container = document.getElementById('active-streams');
        if (container) {
            container.innerHTML = streamStatus.streams.map(stream => `
                <div class="stream-item">
                    <span class="stream-id">${stream.id}</span>
                    <span class="stream-quality ${stream.quality > 80 ? 'good' : stream.quality > 50 ? 'medium' : 'poor'}">
                        ${stream.quality}%
                    </span>
                    <span class="stream-latency ${stream.latency < 200 ? 'good' : 'warning'}