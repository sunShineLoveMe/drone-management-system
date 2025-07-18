// 任务规划页面JavaScript
let map;
let currentTool = 'select';
let waypoints = [];
let missionRoute = null;
let selectedMission = null;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    setupEventListeners();
    loadMissions();
});

// 初始化地图
function initializeMap() {
    // 创建地图实例
    map = L.map('mission-map').setView([39.915, 116.404], 13);

    // 添加地图图层
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // 地图点击事件
    map.on('click', function(e) {
        handleMapClick(e);
    });

    // 添加地图控件
    addMapControls();
}

// 添加地图控件
function addMapControls() {
    // 比例尺
    L.control.scale().addTo(map);

    // 图层控制
    const baseLayers = {
        "街道地图": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'),
        "卫星地图": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}')
    };

    L.control.layers(baseLayers).addTo(map);
}

// 设置事件监听器
function setupEventListeners() {
    // 工具按钮事件
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            selectTool(this.dataset.tool);
        });
    });

    // 新建任务按钮
    document.getElementById('new-mission-btn').addEventListener('click', function() {
        showNewMissionModal();
    });

    // 保存任务按钮
    document.getElementById('save-mission-btn').addEventListener('click', function() {
        saveMission();
    });

    // 执行任务按钮
    document.getElementById('execute-mission-btn').addEventListener('click', function() {
        executeMission();
    });

    // 分配无人机按钮
    document.getElementById('assign-drone-btn').addEventListener('click', function() {
        assignDrone();
    });

    // 地图工具栏按钮
    document.getElementById('zoom-in-btn').addEventListener('click', function() {
        map.zoomIn();
    });

    document.getElementById('zoom-out-btn').addEventListener('click', function() {
        map.zoomOut();
    });

    document.getElementById('fullscreen-btn').addEventListener('click', function() {
        toggleFullscreen();
    });

    // 模态框事件
    document.getElementById('close-modal-btn').addEventListener('click', function() {
        hideNewMissionModal();
    });

    document.getElementById('cancel-btn').addEventListener('click', function() {
        hideNewMissionModal();
    });

    document.getElementById('create-mission-btn').addEventListener('click', function() {
        createNewMission();
    });

    // 任务列表点击事件
    document.querySelectorAll('.mission-item').forEach(item => {
        item.addEventListener('click', function() {
            selectMission(this.dataset.missionId);
        });
    });

    // 表单变化事件
    document.getElementById('mission-name').addEventListener('input', updateMissionProperties);
    document.getElementById('mission-type').addEventListener('change', updateMissionProperties);
    document.getElementById('mission-priority').addEventListener('change', updateMissionProperties);
    document.getElementById('flight-altitude').addEventListener('input', updateFlightParameters);
    document.getElementById('flight-speed').addEventListener('input', updateFlightParameters);
}

// 选择工具
function selectTool(tool) {
    currentTool = tool;
    
    // 更新工具按钮状态
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tool="${tool}"]`).classList.add('active');

    // 更新鼠标样式
    const mapContainer = document.getElementById('mission-map');
    mapContainer.className = `mission-map tool-${tool}`;
}

// 处理地图点击
function handleMapClick(e) {
    switch(currentTool) {
        case 'waypoint':
            addWaypoint(e.latlng);
            break;
        case 'area':
            // 区域绘制逻辑
            break;
        case 'route':
            // 航线绘制逻辑
            break;
        default:
            // 选择工具逻辑
            break;
    }
}

// 添加航点
function addWaypoint(latlng) {
    const waypointNumber = waypoints.length + 1;
    
    // 创建航点标记
    const marker = L.marker(latlng, {
        icon: L.divIcon({
            className: 'waypoint-marker',
            html: `<div class="waypoint-number">${waypointNumber}</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        }),
        draggable: true
    }).addTo(map);

    // 航点拖拽事件
    marker.on('dragend', function(e) {
        updateWaypointPosition(waypointNumber - 1, e.target.getLatLng());
    });

    // 航点右键菜单
    marker.on('contextmenu', function(e) {
        showWaypointContextMenu(e, waypointNumber - 1);
    });

    // 添加到航点数组
    const waypoint = {
        id: waypointNumber,
        latlng: latlng,
        marker: marker,
        altitude: parseInt(document.getElementById('flight-altitude').value),
        speed: parseInt(document.getElementById('flight-speed').value),
        hoverTime: parseInt(document.getElementById('hover-time').value)
    };

    waypoints.push(waypoint);

    // 更新航点列表
    updateWaypointList();
    
    // 更新航线
    updateRoute();
    
    // 更新任务预览
    updateMissionSummary();
}

// 更新航点列表
function updateWaypointList() {
    const waypointList = document.getElementById('waypoint-list');
    waypointList.innerHTML = '';

    waypoints.forEach((waypoint, index) => {
        const waypointItem = document.createElement('div');
        waypointItem.className = 'waypoint-item';
        waypointItem.innerHTML = `
            <div class="waypoint-info">
                <span class="waypoint-number">${waypoint.id}</span>
                <div class="waypoint-coords">
                    <small>${waypoint.latlng.lat.toFixed(6)}, ${waypoint.latlng.lng.toFixed(6)}</small>
                    <small>高度: ${waypoint.altitude}m</small>
                </div>
            </div>
            <div class="waypoint-actions">
                <button class="btn-icon" title="编辑" onclick="editWaypoint(${index})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon" title="删除" onclick="deleteWaypoint(${index})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        waypointList.appendChild(waypointItem);
    });
}

// 更新航线
function updateRoute() {
    // 移除现有航线
    if (missionRoute) {
        map.removeLayer(missionRoute);
    }

    // 如果有多个航点，绘制航线
    if (waypoints.length > 1) {
        const routeCoords = waypoints.map(wp => wp.latlng);
        missionRoute = L.polyline(routeCoords, {
            color: '#007bff',
            weight: 3,
            opacity: 0.8,
            dashArray: '10, 5'
        }).addTo(map);
    }
}

// 更新任务预览
function updateMissionSummary() {
    document.getElementById('total-waypoints').textContent = waypoints.length;
    
    // 计算总距离
    let totalDistance = 0;
    for (let i = 1; i < waypoints.length; i++) {
        totalDistance += waypoints[i-1].latlng.distanceTo(waypoints[i].latlng);
    }
    document.getElementById('total-distance').textContent = (totalDistance / 1000).toFixed(2) + ' km';
    
    // 估算时间和电池消耗
    const speed = parseInt(document.getElementById('flight-speed').value) || 10;
    const estimatedTime = Math.ceil(totalDistance / speed / 60);
    document.getElementById('estimated-time').textContent = estimatedTime + ' 分钟';
    
    const batteryUsage = Math.min(100, Math.ceil(estimatedTime * 2));
    document.getElementById('battery-usage').textContent = batteryUsage + '%';
}

// 删除航点
function deleteWaypoint(index) {
    if (confirm('确定要删除这个航点吗？')) {
        // 从地图移除标记
        map.removeLayer(waypoints[index].marker);
        
        // 从数组移除
        waypoints.splice(index, 1);
        
        // 重新编号
        waypoints.forEach((waypoint, i) => {
            waypoint.id = i + 1;
            waypoint.marker.setIcon(L.divIcon({
                className: 'waypoint-marker',
                html: `<div class="waypoint-number">${i + 1}</div>`,
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            }));
        });
        
        // 更新显示
        updateWaypointList();
        updateRoute();
        updateMissionSummary();
    }
}

// 编辑航点
function editWaypoint(index) {
    const waypoint = waypoints[index];
    // 这里可以打开一个编辑对话框
    console.log('编辑航点:', waypoint);
}

// 显示新建任务模态框
function showNewMissionModal() {
    document.getElementById('new-mission-modal').style.display = 'flex';
}

// 隐藏新建任务模态框
function hideNewMissionModal() {
    document.getElementById('new-mission-modal').style.display = 'none';
    // 清空表单
    document.getElementById('new-mission-name').value = '';
    document.getElementById('new-mission-description').value = '';
    document.getElementById('mission-template').value = '';
}

// 创建新任务
function createNewMission() {
    const name = document.getElementById('new-mission-name').value.trim();
    if (!name) {
        alert('请输入任务名称');
        return;
    }

    // 创建新任务对象
    const newMission = {
        id: 'mission-' + Date.now(),
        name: name,
        description: document.getElementById('new-mission-description').value,
        template: document.getElementById('mission-template').value,
        status: '规划中',
        waypoints: [],
        createdAt: new Date()
    };

    // 添加到任务列表
    addMissionToList(newMission);
    
    // 选择新任务
    selectMission(newMission.id);
    
    // 隐藏模态框
    hideNewMissionModal();
}

// 添加任务到列表
function addMissionToList(mission) {
    const missionList = document.getElementById('mission-list');
    const missionItem = document.createElement('div');
    missionItem.className = 'mission-item';
    missionItem.dataset.missionId = mission.id;
    missionItem.innerHTML = `
        <div class="mission-info">
            <h4>${mission.name}</h4>
            <p>状态: ${mission.status}</p>
            <p>无人机: 未分配</p>
        </div>
        <div class="mission-actions">
            <button class="btn-icon" title="编辑">
                <i class="fas fa-edit"></i>
            </button>
            <button class="btn-icon" title="删除">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
    
    // 添加点击事件
    missionItem.addEventListener('click', function() {
        selectMission(mission.id);
    });
    
    missionList.appendChild(missionItem);
}

// 选择任务
function selectMission(missionId) {
    // 更新任务列表选中状态
    document.querySelectorAll('.mission-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-mission-id="${missionId}"]`).classList.add('active');
    
    selectedMission = missionId;
    
    // 加载任务数据
    loadMissionData(missionId);
}

// 加载任务数据
function loadMissionData(missionId) {
    // 这里应该从服务器加载任务数据
    // 现在使用模拟数据
    if (missionId === 'mission-001') {
        // 清空现有航点
        clearWaypoints();
        
        // 添加示例航点
        addWaypoint(L.latLng(39.915, 116.404));
        addWaypoint(L.latLng(39.920, 116.410));
        addWaypoint(L.latLng(39.925, 116.415));
        
        // 更新任务属性
        document.getElementById('mission-name').value = '园区巡检任务';
        document.getElementById('mission-type').value = 'patrol';
        document.getElementById('mission-priority').value = '2';
    }
}

// 清空航点
function clearWaypoints() {
    waypoints.forEach(waypoint => {
        map.removeLayer(waypoint.marker);
    });
    waypoints = [];
    
    if (missionRoute) {
        map.removeLayer(missionRoute);
        missionRoute = null;
    }
    
    updateWaypointList();
    updateMissionSummary();
}

// 保存任务
function saveMission() {
    if (!selectedMission) {
        alert('请先选择一个任务');
        return;
    }

    const missionData = {
        id: selectedMission,
        name: document.getElementById('mission-name').value,
        type: document.getElementById('mission-type').value,
        priority: document.getElementById('mission-priority').value,
        duration: document.getElementById('mission-duration').value,
        altitude: document.getElementById('flight-altitude').value,
        speed: document.getElementById('flight-speed').value,
        waypoints: waypoints.map(wp => ({
            lat: wp.latlng.lat,
            lng: wp.latlng.lng,
            altitude: wp.altitude,
            speed: wp.speed,
            hoverTime: wp.hoverTime
        }))
    };

    // 这里应该发送到服务器保存
    console.log('保存任务:', missionData);
    alert('任务已保存');
}

// 执行任务
function executeMission() {
    if (!selectedMission) {
        alert('请先选择一个任务');
        return;
    }

    if (waypoints.length === 0) {
        alert('请先添加航点');
        return;
    }

    const droneSelect = document.getElementById('drone-select');
    if (!droneSelect.value) {
        alert('请先分配无人机');
        return;
    }

    if (confirm('确定要执行这个任务吗？')) {
        // 这里应该发送执行命令到服务器
        console.log('执行任务:', selectedMission);
        alert('任务已开始执行');
    }
}

// 分配无人机
function assignDrone() {
    const droneSelect = document.getElementById('drone-select');
    const selectedDrone = droneSelect.value;
    
    if (!selectedDrone) {
        alert('请选择一个无人机');
        return;
    }

    if (!selectedMission) {
        alert('请先选择一个任务');
        return;
    }

    // 更新任务显示
    const missionItem = document.querySelector(`[data-mission-id="${selectedMission}"]`);
    const droneInfo = missionItem.querySelector('.mission-info p:last-child');
    droneInfo.textContent = `无人机: ${droneSelect.options[droneSelect.selectedIndex].text}`;

    alert('无人机分配成功');
}

// 切换全屏
function toggleFullscreen() {
    const mapContainer = document.getElementById('mission-map');
    if (!document.fullscreenElement) {
        mapContainer.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
}

// 更新任务属性
function updateMissionProperties() {
    // 实时更新任务属性
}

// 更新飞行参数
function updateFlightParameters() {
    // 更新所有航点的飞行参数
    waypoints.forEach(waypoint => {
        waypoint.altitude = parseInt(document.getElementById('flight-altitude').value);
        waypoint.speed = parseInt(document.getElementById('flight-speed').value);
        waypoint.hoverTime = parseInt(document.getElementById('hover-time').value);
    });
    
    updateWaypointList();
    updateMissionSummary();
}

// 加载任务列表
function loadMissions() {
    // 这里应该从服务器加载任务列表
    // 现在使用模拟数据，已经在HTML中定义
}

// 添加CSS样式到页面
const style = document.createElement('style');
style.textContent = `
    .waypoint-marker {
        background: #007bff;
        border: 2px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
    }
    
    .waypoint-marker .waypoint-number {
        color: white;
        font-weight: bold;
        font-size: 12px;
    }
    
    .tool-waypoint {
        cursor: crosshair !important;
    }
    
    .tool-area {
        cursor: copy !important;
    }
    
    .tool-route {
        cursor: pointer !important;
    }
`;
document.head.appendChild(style);