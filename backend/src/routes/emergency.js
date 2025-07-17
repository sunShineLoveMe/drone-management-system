const express = require('express');
const router = express.Router();
const { authenticateToken, checkRole } = require('../middleware/auth');
const { EmergencyResponseService } = require('../services/emergency');
const { logger } = require('../utils/logger');

const emergencyService = new EmergencyResponseService();

// ú”%Í”
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { droneId, emergencyType, severity, location, description } = req.body;
    
    if (!droneId || !emergencyType || !severity) {
      return res.status(400).json({ 
        error: 'Missing required fields: droneId, emergencyType, severity' 
      });
    }

    const emergency = await emergencyService.createEmergency({
      droneId,
      emergencyType,
      severity,
      location,
      description,
      reportedBy: req.user.id
    });

    logger.info(`Emergency created: ${emergency.id} for drone ${droneId}`);
    res.status(201).json({ emergency });
  } catch (error) {
    logger.error('Failed to create emergency:', error);
    res.status(500).json({ error: 'Failed to create emergency' });
  }
});

// ·Ö@	”%Í”
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, severity, type, page = 1, limit = 20 } = req.query;
    const emergencies = await emergencyService.getEmergencies({
      status,
      severity,
      type,
      page: parseInt(page),
      limit: parseInt(limit)
    });
    
    res.json(emergencies);
  } catch (error) {
    logger.error('Failed to fetch emergencies:', error);
    res.status(500).json({ error: 'Failed to fetch emergencies' });
  }
});

// ·ÖU*”%Í”æÅ
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const emergency = await emergencyService.getEmergencyById(req.params.id);
    if (!emergency) {
      return res.status(404).json({ error: 'Emergency not found' });
    }
    
    res.json({ emergency });
  } catch (error) {
    logger.error('Failed to fetch emergency:', error);
    res.status(500).json({ error: 'Failed to fetch emergency' });
  }
});

// ô°”%Í”¶
router.put('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status, responseActions, assignedTeam, notes } = req.body;
    
    const emergency = await emergencyService.updateEmergencyStatus(req.params.id, {
      status,
      responseActions,
      assignedTeam,
      notes,
      updatedBy: req.user.id
    });

    logger.info(`Emergency ${req.params.id} status updated to ${status}`);
    res.json({ emergency });
  } catch (error) {
    logger.error('Failed to update emergency status:', error);
    res.status(500).json({ error: 'Failed to update emergency status' });
  }
});

// æÑ'%O®
router.post('/:id/trigger-protocol', authenticateToken, checkRole(['admin', 'emergency']), async (req, res) => {
  try {
    const { protocolType, autoLand, notifyEmergencyServices } = req.body;
    
    const result = await emergencyService.triggerEmergencyProtocol(req.params.id, {
      protocolType,
      autoLand,
      notifyEmergencyServices,
      triggeredBy: req.user.id
    });

    logger.info(`Emergency protocol triggered for ${req.params.id}`);
    res.json({ result });
  } catch (error) {
    logger.error('Failed to trigger emergency protocol:', error);
    res.status(500).json({ error: 'Failed to trigger emergency protocol' });
  }
});

// ·Ö'%O®!
router.get('/protocols/templates', authenticateToken, async (req, res) => {
  try {
    const templates = await emergencyService.getProtocolTemplates();
    res.json({ templates });
  } catch (error) {
    logger.error('Failed to fetch protocol templates:', error);
    res.status(500).json({ error: 'Failed to fetch protocol templates' });
  }
});

// ·Öžö'%Åµß¡
router.get('/stats/realtime', authenticateToken, async (req, res) => {
  try {
    const stats = await emergencyService.getRealtimeStats();
    res.json(stats);
  } catch (error) {
    logger.error('Failed to fetch emergency stats:', error);
    res.status(500).json({ error: 'Failed to fetch emergency stats' });
  }
});

// yÏ'%Åµ
router.post('/batch/resolve', authenticateToken, checkRole(['admin', 'emergency']), async (req, res) => {
  try {
    const { emergencyIds, resolution } = req.body;
    
    const results = await emergencyService.batchResolveEmergencies(emergencyIds, {
      resolution,
      resolvedBy: req.user.id
    });

    logger.info(`Batch resolved ${results.successful} emergencies`);
    res.json({ results });
  } catch (error) {
    logger.error('Failed to batch resolve emergencies:', error);
    res.status(500).json({ error: 'Failed to batch resolve emergencies' });
  }
});

// ·Ö'%Í”†ò
router.get('/history/:droneId', authenticateToken, async (req, res) => {
  try {
    const { droneId } = req.params;
    const { startDate, endDate } = req.query;
    
    const history = await emergencyService.getEmergencyHistory(droneId, {
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null
    });
    
    res.json({ history });
  } catch (error) {
    logger.error('Failed to fetch emergency history:', error);
    res.status(500).json({ error: 'Failed to fetch emergency history' });
  }
});

module.exports = router;