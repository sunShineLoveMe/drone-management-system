const Joi = require('joi');

/**
 * 验证用户注册数据
 * @param {Object} data - 注册数据
 * @returns {Object} 验证结果
 */
const validateRegistration = (data) => {
  const schema = Joi.object({
    username: Joi.string()
      .alphanum()
      .min(3)
      .max(30)
      .required()
      .messages({
        'string.base': '用户名必须是字符串',
        'string.empty': '用户名不能为空',
        'string.min': '用户名至少需要 {#limit} 个字符',
        'string.max': '用户名不能超过 {#limit} 个字符',
        'string.alphanum': '用户名只能包含字母和数字',
        'any.required': '用户名是必需的'
      }),
    
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.base': '邮箱必须是字符串',
        'string.empty': '邮箱不能为空',
        'string.email': '请提供有效的邮箱地址',
        'any.required': '邮箱是必需的'
      }),
    
    password: Joi.string()
      .min(8)
      .required()
      .messages({
        'string.base': '密码必须是字符串',
        'string.empty': '密码不能为空',
        'string.min': '密码至少需要 {#limit} 个字符',
        'any.required': '密码是必需的'
      }),
    
    role: Joi.string()
      .valid('admin', 'operator', 'viewer', 'emergency')
      .default('operator')
      .messages({
        'string.base': '角色必须是字符串',
        'any.only': '角色必须是以下之一: {#valids}'
      })
  });
  
  return schema.validate(data);
};

/**
 * 验证用户登录数据
 * @param {Object} data - 登录数据
 * @returns {Object} 验证结果
 */
const validateLogin = (data) => {
  const schema = Joi.object({
    username: Joi.string()
      .required()
      .messages({
        'string.base': '用户名必须是字符串',
        'string.empty': '用户名不能为空',
        'any.required': '用户名是必需的'
      }),
    
    password: Joi.string()
      .required()
      .messages({
        'string.base': '密码必须是字符串',
        'string.empty': '密码不能为空',
        'any.required': '密码是必需的'
      })
  });
  
  return schema.validate(data);
};

/**
 * 验证无人机数据
 * @param {Object} data - 无人机数据
 * @returns {Object} 验证结果
 */
const validateDrone = (data) => {
  const schema = Joi.object({
    drone_id: Joi.string()
      .required()
      .messages({
        'string.base': '无人机ID必须是字符串',
        'string.empty': '无人机ID不能为空',
        'any.required': '无人机ID是必需的'
      }),
    
    name: Joi.string()
      .required()
      .messages({
        'string.base': '名称必须是字符串',
        'string.empty': '名称不能为空',
        'any.required': '名称是必需的'
      }),
    
    model: Joi.string()
      .allow('')
      .optional(),
    
    serial_number: Joi.string()
      .allow('')
      .optional()
  });
  
  return schema.validate(data);
};

/**
 * 验证遥测数据
 * @param {Object} data - 遥测数据
 * @returns {Object} 验证结果
 */
const validateTelemetry = (data) => {
  const schema = Joi.object({
    latitude: Joi.number()
      .min(-90)
      .max(90)
      .required()
      .messages({
        'number.base': '纬度必须是数字',
        'number.min': '纬度必须大于或等于 {#limit}',
        'number.max': '纬度必须小于或等于 {#limit}',
        'any.required': '纬度是必需的'
      }),
    
    longitude: Joi.number()
      .min(-180)
      .max(180)
      .required()
      .messages({
        'number.base': '经度必须是数字',
        'number.min': '经度必须大于或等于 {#limit}',
        'number.max': '经度必须小于或等于 {#limit}',
        'any.required': '经度是必需的'
      }),
    
    altitude: Joi.number()
      .required()
      .messages({
        'number.base': '高度必须是数字',
        'any.required': '高度是必需的'
      }),
    
    battery_level: Joi.number()
      .min(0)
      .max(100)
      .required()
      .messages({
        'number.base': '电池电量必须是数字',
        'number.min': '电池电量必须大于或等于 {#limit}',
        'number.max': '电池电量必须小于或等于 {#limit}',
        'any.required': '电池电量是必需的'
      }),
    
    speed: Joi.number()
      .min(0)
      .required()
      .messages({
        'number.base': '速度必须是数字',
        'number.min': '速度必须大于或等于 {#limit}',
        'any.required': '速度是必需的'
      }),
    
    heading: Joi.number()
      .min(0)
      .max(360)
      .required()
      .messages({
        'number.base': '航向必须是数字',
        'number.min': '航向必须大于或等于 {#limit}',
        'number.max': '航向必须小于或等于 {#limit}',
        'any.required': '航向是必需的'
      }),
    
    temperature: Joi.number()
      .optional(),
    
    humidity: Joi.number()
      .min(0)
      .max(100)
      .optional(),
    
    wind_speed: Joi.number()
      .min(0)
      .optional(),
    
    signal_strength: Joi.number()
      .optional(),
    
    status: Joi.string()
      .valid('idle', 'flying', 'returning', 'landing', 'emergency', 'offline')
      .required()
      .messages({
        'string.base': '状态必须是字符串',
        'any.only': '状态必须是以下之一: {#valids}',
        'any.required': '状态是必需的'
      })
  });
  
  return schema.validate(data);
};

/**
 * 验证任务数据
 * @param {Object} data - 任务数据
 * @returns {Object} 验证结果
 */
const validateMission = (data) => {
  const schema = Joi.object({
    name: Joi.string()
      .required()
      .messages({
        'string.base': '名称必须是字符串',
        'string.empty': '名称不能为空',
        'any.required': '名称是必需的'
      }),
    
    description: Joi.string()
      .allow('')
      .optional(),
    
    mission_type: Joi.string()
      .valid('patrol', 'inspection', 'survey', 'delivery', 'emergency', 'custom')
      .required()
      .messages({
        'string.base': '任务类型必须是字符串',
        'any.only': '任务类型必须是以下之一: {#valids}',
        'any.required': '任务类型是必需的'
      }),
    
    priority: Joi.number()
      .min(1)
      .max(10)
      .default(1)
      .messages({
        'number.base': '优先级必须是数字',
        'number.min': '优先级必须大于或等于 {#limit}',
        'number.max': '优先级必须小于或等于 {#limit}'
      }),
    
    waypoints: Joi.array()
      .items(Joi.object({
        latitude: Joi.number().min(-90).max(90).required(),
        longitude: Joi.number().min(-180).max(180).required(),
        altitude: Joi.number().required(),
        action: Joi.string().optional(),
        hover_time: Joi.number().min(0).optional(),
        speed: Joi.number().min(0).optional()
      }))
      .optional(),
    
    area_coordinates: Joi.array()
      .items(Joi.object({
        latitude: Joi.number().min(-90).max(90).required(),
        longitude: Joi.number().min(-180).max(180).required()
      }))
      .optional(),
    
    scheduled_start: Joi.date()
      .iso()
      .optional(),
    
    estimated_duration: Joi.number()
      .min(0)
      .optional()
  });
  
  return schema.validate(data);
};

module.exports = {
  validateRegistration,
  validateLogin,
  validateDrone,
  validateTelemetry,
  validateMission
};