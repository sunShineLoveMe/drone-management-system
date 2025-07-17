// WebSocket实时通信客户端
class WebSocketClient {
    constructor(url = 'ws://localhost:8080/ws') {
        this.url = url;
        this.ws = null;
        this.reconnectInterval = 5000;
        this.maxReconnectAttempts = 10;
        this.reconnectAttempts = 0;
        this.listeners = new Map();
        this.isConnected = false;
        
        this.connect();
    }

    connect() {
        try {
            this.ws = new WebSocket(this.url);
            
            this.ws.onopen = () => {
                console.log('WebSocket连接已建立');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.emit('connected');
                
                // 发送身份验证
                this.send({
                    type: 'auth',
                    data: {
                        token: localStorage.getItem('auth_token') || 'demo_token',
                        clientId: 'dashboard_' + Date.now()
                    }
                });
            };

            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleMessage(message);
                } catch (error) {
                    console.error('消息解析错误:', error);
                }
            };

            this.ws.onclose = () => {
                console.log('WebSocket连接断开');
                this.isConnected = false;
                this.emit('disconnected');
                this.attemptReconnect();
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket错误:', error);
                this.emit('error', error);
            };

        } catch (error) {
            console.error('WebSocket连接失败:', error);
            this.attemptReconnect();
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('最大重连次数已达，停止重连');
            return;
        }

        this.reconnectAttempts++;
        console.log(`尝试第${this.reconnectAttempts}次重连...`);
        
        setTimeout(() => {
            this.connect();
        }, this.reconnectInterval);
    }

    handleMessage(message) {
        const { type, data, timestamp } = message;
        
        switch (type) {
            case 'drone_update':
                this.emit('drone_update', data);
                break;
            case 'mission_update':
                this.emit('mission_update', data);
                break;
            case 'alert':
                this.emit('alert', data);
                break;
            case 'system_status':
                this.emit('system_status', data);
                break;
            case 'ping':
                this.send({ type: 'pong', data: { timestamp } });
                break;
            default:
                this.emit(type, data);
        }
    }

    send(message) {
        if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.warn('WebSocket未连接，消息未发送:', message);
        }
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    off(event, callback) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('事件处理错误:', error);
                }
            });
        }
    }

    close() {
        if (this.ws) {
            this.ws.close();
        }
    }
}

// 实时数据管理器
class RealtimeDataManager {
    constructor(wsClient) {
        this.ws = wsClient;
        this.droneData = new Map();
        this.missionData = new Map();
        this.alertQueue = [];
        
        this.setupWebSocketListeners();
        this.startHeartbeat();
    }

    setupWebSocketListeners() {
        this.ws.on('drone_update', (data) => {
            this.updateDroneData(data);
        });

        this.ws.on('mission_update', (data) => {
            this.updateMissionData(data);
        });

        this.ws.on('alert', (data) => {
            this.handleAlert(data);
        });

        this.ws.on('system_status', (data) => {
            this.updateSystemStatus(data);
        });
    }

    updateDroneData(droneUpdates) {
        droneUpdates.forEach(drone => {
            this.droneData.set(drone.id, {
                ...this.droneData.get(drone.id),
                ...drone,
                lastUpdate: Date.now()
            });
        });
        
        // 触发UI更新
        this.notifyUIUpdate('drone');
    }

    updateMissionData(missionUpdates) {
        missionUpdates.forEach(mission => {
            this.missionData.set(mission.id, {
                ...this.missionData.get(mission.id),
                ...mission,
                lastUpdate: Date.now()
            });
        });
        
        this.notifyUIUpdate('mission');
    }

    handleAlert(alertData) {
        this.alertQueue.unshift({
            ...alertData,
            timestamp: Date.now(),
            id: 'alert_' + Date.now()
        });

        // 保持最多50条告警
        if (this.alertQueue.length > 50) {
            this.alertQueue = this.alertQueue.slice(0, 50);
        }

        // 显示告警通知
        this.showAlertNotification(alertData);
        this.notifyUIUpdate('alert');
    }

    showAlertNotification(alert) {
        // 浏览器通知
        if (Notification.permission === 'granted') {
            new Notification('无人机系统告警', {
                body: alert.message,
                icon: '/assets/alert-icon.png'
            });
        }

        // DOM通知
        const notification = document.createElement('div');
        notification.className = `alert-notification ${alert.severity}`;
        notification.innerHTML = `
            <div class="alert-content">
                <i class="fas fa-exclamation-triangle"></i>
                <span>${alert.message}</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    notifyUIUpdate(type) {
        const event = new CustomEvent('realtime_update', {
            detail: { type, data: this.getData(type) }
        });
        document.dispatchEvent(event);
    }

    getData(type) {
        switch (type) {
            case 'drone':
                return Array.from(this.droneData.values());
            case 'mission':
                return Array.from(this.missionData.values());
            case 'alert':
                return this.alertQueue;
            default:
                return {
                    drones: Array.from(this.droneData.values()),
                    missions: Array.from(this.missionData.values()),
                    alerts: this.alertQueue
                };
        }
    }

    startHeartbeat() {
        setInterval(() => {
            if (this.ws.isConnected) {
                this.ws.send({
                    type: 'heartbeat',
                    data: { timestamp: Date.now() }
                });
            }
        }, 30000);
    }

    // 请求实时数据
    requestRealtimeData() {
        this.ws.send({
            type: 'subscribe',
            data: {
                channels: ['drone_updates', 'mission_updates', 'alerts']
            }
        });
    }
}

// 导出供其他模块使用
window.WebSocketClient = WebSocketClient;
window.RealtimeDataManager = RealtimeDataManager;