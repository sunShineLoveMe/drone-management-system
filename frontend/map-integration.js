// 高德地图集成模块
class MapIntegration {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.map = null;
        this.droneMarkers = new Map();
        this.missionPolylines = new Map();
        this.geofencePolygons = new Map();
        this.heatmapLayer = null;
        this.options = {
            zoom: 15,
            center: [116.404, 39.915], // 北京天安门
            ...options
        };
        
        this.init();
    }

    init() {
        // 初始化高德地图
        if (typeof AMap === 'undefined') {
            console.error('高德地图API未加载');
            return;
        }

        this.map = new AMap.Map(this.containerId, {
            center: this.options.center,
            zoom: this.options.zoom,
            pitch: 45, // 倾斜角度
            rotation: 0,
            viewMode: '3D', // 开启3D模式
            resizeEnable: true,
            mapStyle: 'amap://styles/darkblue' // 暗色主题
        });

        // 添加控件
        this.map.addControl(new AMap.ControlBar({
            position: {
                top: '10px',
                right: '10px'
            }
        }));
        
        this.map.addControl(new AMap.Scale());
        this.map.addControl(new AMap.ToolBar({
            liteStyle: true
        }));

        // 添加卫星图层切换
        this.satelliteLayer = new AMap.TileLayer.Satellite();
        this.roadNetLayer = new AMap.TileLayer.RoadNet();
        
        this.map.add([this.satelliteLayer, this.roadNetLayer]);
        
        // 初始化热力图
        this.initHeatmap();
        
        // 绑定事件
        this.bindEvents();
    }

    initHeatmap() {
        this.heatmapLayer = new AMap.Heatmap(this.map, {
            radius: 25,
            opacity: [0, 0.8],
            gradient: {
                0.5: 'blue',
                0.65: 'rgb(117,211,248)',
                0.7: 'rgb(0, 255, 0)',
                0.9: '#ffea00',
                1.0: 'red'
            }
        });
    }

    bindEvents() {
        // 地图点击事件
        this.map.on('click', (e) => {
            const lnglat = e.lnglat;
            this.emit('mapClick', {
                lng: lnglat.lng,
                lat: lnglat.lat,
                pixel: e.pixel
            });
        });

        // 地图右键菜单
        this.map.on('rightclick', (e) => {
            this.showContextMenu(e.lnglat);
        });
    }

    // 添加无人机标记
    addDroneMarker(drone) {
        if (this.droneMarkers.has(drone.id)) {
            this.updateDroneMarker(drone);
            return;
        }

        const position = new AMap.LngLat(drone.lng, drone.lat);
        
        // 创建无人机图标
        const icon = new AMap.Icon({
            size: new AMap.Size(40, 40),
            image: this.getDroneIcon(drone.status),
            imageSize: new AMap.Size(40, 40)
        });

        const marker = new AMap.Marker({
            position: position,
            icon: icon,
            title: `${drone.id} - ${drone.name}`,
            extData: drone,
            angle: drone.heading || 0
        });

        // 添加标签
        const label = {
            content: `${drone.id}\n${drone.battery}%`,
            offset: new AMap.Pixel(20, -10),
            direction: 'right'
        };
        marker.setLabel(label);

        // 添加点击事件
        marker.on('click', () => {
            this.showDroneInfoWindow(drone);
        });

        this.map.add(marker);
        this.droneMarkers.set(drone.id, marker);

        // 添加轨迹线
        this.addDroneTrail(drone.id, [position]);
    }

    updateDroneMarker(drone) {
        const marker = this.droneMarkers.get(drone.id);
        if (!marker) return;

        const position = new AMap.LngLat(drone.lng, drone.lat);
        marker.setPosition(position);
        marker.setAngle(drone.heading || 0);
        
        // 更新图标
        marker.setIcon(new AMap.Icon({
            size: new AMap.Size(40, 40),
            image: this.getDroneIcon(drone.status),
            imageSize: new AMap.Size(40, 40)
        }));

        // 更新标签
        marker.setLabel({
            content: `${drone.id}\n${drone.battery}%`,
            offset: new AMap.Pixel(20, -10),
            direction: 'right'
        });

        // 更新轨迹
        this.updateDroneTrail(drone.id, position);
    }

    removeDroneMarker(droneId) {
        const marker = this.droneMarkers.get(droneId);
        if (marker) {
            this.map.remove(marker);
            this.droneMarkers.delete(droneId);
        }
    }

    // 添加任务航线
    addMissionPath(mission) {
        if (this.missionPolylines.has(mission.id)) {
            this.updateMissionPath(mission);
            return;
        }

        const path = mission.waypoints.map(wp => new AMap.LngLat(wp.lng, wp.lat));
        const polyline = new AMap.Polyline({
            path: path,
            strokeColor: this.getMissionColor(mission.status),
            strokeWeight: 4,
            strokeOpacity: 0.8,
            strokeStyle: 'solid',
            lineJoin: 'round',
            extData: mission
        });

        this.map.add(polyline);
        this.missionPolylines.set(mission.id, polyline);

        // 添加航点标记
        mission.waypoints.forEach((wp, index) => {
            this.addWaypointMarker(wp, index, mission.id);
        });
    }

    updateMissionPath(mission) {
        const polyline = this.missionPolylines.get(mission.id);
        if (!polyline) return;

        const path = mission.waypoints.map(wp => new AMap.LngLat(wp.lng, wp.lat));
        polyline.setPath(path);
        polyline.setOptions({
            strokeColor: this.getMissionColor(mission.status)
        });
    }

    removeMissionPath(missionId) {
        const polyline = this.missionPolylines.get(missionId);
        if (polyline) {
            this.map.remove(polyline);
            this.missionPolylines.delete(missionId);
        }
    }

    // 添加航点标记
    addWaypointMarker(waypoint, index, missionId) {
        const marker = new AMap.Marker({
            position: new AMap.LngLat(waypoint.lng, waypoint.lat),
            content: `<div class="waypoint-marker ${waypoint.type || 'normal'}">
                        <div class="waypoint-number">${index + 1}</div>
                     </div>`,
            extData: { waypoint, missionId, index }
        });

        marker.on('click', () => {
            this.showWaypointInfo(waypoint, index);
        });

        this.map.add(marker);
        return marker;
    }

    // 添加地理围栏
    addGeofence(geofence) {
        const path = geofence.coordinates.map(coord => new AMap.LngLat(coord.lng, coord.lat));
        const polygon = new AMap.Polygon({
            path: path,
            strokeColor: geofence.type === 'restricted' ? '#FF0000' : '#00FF00',
            strokeWeight: 2,
            strokeOpacity: 0.8,
            fillColor: geofence.type === 'restricted' ? '#FF0000' : '#00FF00',
            fillOpacity: 0.2,
            extData: geofence
        });

        this.map.add(polygon);
        this.geofencePolygons.set(geofence.id, polygon);

        // 添加标签
        const labelMarker = new AMap.Marker({
            position: polygon.getBounds().getCenter(),
            content: `<div class="geofence-label">${geofence.name}</div>`,
            offset: new AMap.Pixel(0, -10)
        });

        this.map.add(labelMarker);
    }

    // 更新热力图数据
    updateHeatmap(data) {
        const heatmapData = data.map(point => ({
            lng: point.lng,
            lat: point.lat,
            count: point.intensity || 1
        }));

        this.heatmapLayer.setDataSet({
            data: heatmapData,
            max: Math.max(...heatmapData.map(d => d.count))
        });
    }

    // 设置地图中心
    setCenter(lng, lat, zoom) {
        this.map.setCenter(new AMap.LngLat(lng, lat));
        if (zoom) {
            this.map.setZoom(zoom);
        }
    }

    // 获取地图范围
    getMapBounds() {
        return this.map.getBounds();
    }

    // 显示无人机信息窗口
    showDroneInfoWindow(drone) {
        const infoWindow = new AMap.InfoWindow({
            content: `<div class="drone-info-window">
                <h4>${drone.id}</h4>
                <p>名称: ${drone.name}</p>
                <p>状态: ${drone.status}</p>
                <p>电量: ${drone.battery}%</p>
                <p>信号: ${drone.signal}%</p>
                <p>位置: ${drone.position}</p>
                <p>高度: ${drone.altitude || '未知'}米</p>
                <p>速度: ${drone.speed || '未知'}km/h</p>
                <div class="info-actions">
                    <button onclick="controlDrone('${drone.id}')">控制</button>
                    <button onclick="viewDetails('${drone.id}')">详情</button>
                </div>
            </div>`,
            offset: new AMap.Pixel(0, -30)
        });

        const marker = this.droneMarkers.get(drone.id);
        if (marker) {
            infoWindow.open(this.map, marker.getPosition());
        }
    }

    // 获取无人机图标
    getDroneIcon(status) {
        const icons = {
            online: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiMxMEI5ODEiLz4KPHBhdGggZD0iTTEyIDIwSDI4TTE5IDEyVjI4IiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiLz4KPC9zdmc+',
            mission: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiNGNTlFMEIiLz4KPHBhdGggZD0iTTEyIDIwSDI4TTE5IDEyVjI4IiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiLz4KPC9zdmc+',
            offline: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiNFRjQ0NDQiLz4KPHBhdGggZD0iTTEyIDIwSDI4TTE5IDEyVjI4IiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiLz4KPC9zdmc+',
            error: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiNGRjAwMDAiLz4KPHBhdGggZD0iTTEyIDIwSDI4TTE5IDEyVjI4IiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiLz4KPC9zdmc+'
        };
        return icons[status] || icons.online;
    }

    // 获取任务颜色
    getMissionColor(status) {
        const colors = {
            active: '#10B981',
            pending: '#F59E0B',
            completed: '#3B82F6',
            cancelled: '#EF4444'
        };
        return colors[status] || '#6B7280';
    }

    // 显示右键菜单
    showContextMenu(lnglat) {
        const contextMenu = new AMap.ContextMenu();
        
        contextMenu.addItem('添加航点', () => {
            this.emit('addWaypoint', lnglat);
        }, 0);
        
        contextMenu.addItem('创建任务', () => {
            this.emit('createMission', lnglat);
        }, 1);
        
        contextMenu.addItem('创建围栏', () => {
            this.emit('createGeofence', lnglat);
        }, 2);
        
        contextMenu.open(this.map, lnglat);
    }

    // 事件系统
    on(event, callback) {
        if (!this._events) this._events = {};
        if (!this._events[event]) this._events[event] = [];
        this._events[event].push(callback);
    }

    emit(event, data) {
        if (this._events && this._events[event]) {
            this._events[event].forEach(callback => callback(data));
        }
    }

    // 清理资源
    destroy() {
        this.droneMarkers.forEach(marker => {
            this.map.remove(marker);
        });
        this.missionPolylines.forEach(polyline => {
            this.map.remove(polyline);
        });
        this.geofencePolygons.forEach(polygon => {
            this.map.remove(polygon);
        });
        
        this.map.destroy();
    }
}

// 导出供其他模块使用
window.MapIntegration = MapIntegration;