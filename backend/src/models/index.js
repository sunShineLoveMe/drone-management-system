/**
 * 数据库模型索引
 */
const UserModel = require('./user.model');
const DroneModel = require('./drone.model');
const MissionModel = require('./mission.model');
const AlertModel = require('./alert.model');
const SpatialZoneModel = require('./spatial-zone.model');

module.exports = {
  UserModel,
  DroneModel,
  MissionModel,
  AlertModel,
  SpatialZoneModel
};