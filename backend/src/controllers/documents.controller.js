const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { query } = require('../config/database');
const { AUDIT_EVENT_TYPES } = require('../utils/organizationAudit');
const {
  ensureEntityBelongsToOrganization,
  deleteEntityBelongingToOrganization,
  recordOrganizationAuditEvent,
  createAppError
} = require('../utils/organization');

const uploadDir = path.resolve(__dirname, '../../uploads/documents');
fs.mkdirSync(uploadDir, { recursive: true });

const entityTableMap = {
  property: 'properties',
  tenant: 'tenants',
  contract: 'contracts'
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }
});

const ensureEntityExists = async (entityType, entityId, organizationId) => {
  const tableName = entityTableMap[entityType];

  if (!tableName) {
    throw createAppError('Geçersiz belge türü', 400);
  }

  return ensureEntityBelongsToOrganization({ tableName, entityId, organizationId, message: 'İlişkili kayıt bulunamadı' });
};

const list = async (req, res, next) => {
  try {
    const organizationId = req.organizationId;
    const { entity_type, entity_id } = req.query;

    if (!entity_type || !entity_id) {
      return res.status(400).json({ success: false, message: 'entity_type ve entity_id gerekli' });
    }

    await ensureEntityExists(entity_type, entity_id, organizationId);

    const { rows } = await query(
      `SELECT id, entity_type, entity_id, original_name, mime_type, file_size, created_at
       FROM documents
       WHERE organization_id = $1 AND entity_type = $2 AND entity_id = $3
       ORDER BY created_at DESC`,
      [organizationId, entity_type, entity_id]
    );

    res.json({
      success: true,
      data: rows.map((row) => ({
        ...row,
        download_url: `/api/v1/documents/${row.id}/download`
      }))
    });
  } catch (err) {
    next(err);
  }
};

const uploadDocument = async (req, res, next) => {
  try {
    const organizationId = req.organizationId;
    const { entity_type, entity_id } = req.body;

    if (!entity_type || !entity_id) {
      return res.status(400).json({ success: false, message: 'entity_type ve entity_id gerekli' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Dosya seçilmedi' });
    }

    await ensureEntityExists(entity_type, entity_id, organizationId);

    const { rows } = await query(
      `INSERT INTO documents (organization_id, entity_type, entity_id, file_name, original_name, mime_type, file_size, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, entity_type, entity_id, original_name, mime_type, file_size, created_at`,
      [
        organizationId,
        entity_type,
        entity_id,
        req.file.filename,
        req.file.originalname,
        req.file.mimetype || null,
        req.file.size || 0,
        req.user?.id || null
      ]
    );

    res.status(201).json({
      success: true,
      data: {
        ...rows[0],
        download_url: `/api/v1/documents/${rows[0].id}/download`
      }
    });

    await recordOrganizationAuditEvent({
      organizationId,
      actorUserId: req.user?.id || null,
      eventType: AUDIT_EVENT_TYPES.DOCUMENT_UPLOADED,
      entityType: 'document',
      entityId: rows[0].id,
      title: rows[0].original_name,
      description: `${entity_type} kaydina belge yuklendi`,
      metadata: { entity_type, entity_id, file_size: rows[0].file_size }
    });
  } catch (err) {
    if (req.file?.path) {
      fs.rmSync(req.file.path, { force: true });
    }
    next(err);
  }
};

const download = async (req, res, next) => {
  try {
    const organizationId = req.organizationId;
    const { rows } = await query('SELECT * FROM documents WHERE id = $1 AND organization_id = $2', [req.params.id, organizationId]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Belge bulunamadı' });
    }

    const document = rows[0];
    const filePath = path.join(uploadDir, document.file_name);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Dosya bulunamadı' });
    }

    res.download(filePath, document.original_name);
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const organizationId = req.organizationId;
    const removed = await deleteEntityBelongingToOrganization({ tableName: 'documents', entityId: req.params.id, organizationId, returningClause: '*', message: 'Belge bulunamadı' });
    const filePath = path.join(uploadDir, removed.file_name);
    fs.rmSync(filePath, { force: true });

    await recordOrganizationAuditEvent({
      organizationId,
      actorUserId: req.user?.id || null,
      eventType: AUDIT_EVENT_TYPES.DOCUMENT_DELETED,
      entityType: 'document',
      entityId: removed.id,
      title: removed.original_name,
      description: 'Belge silindi',
      metadata: { entity_type: removed.entity_type, entity_id: removed.entity_id }
    });

    res.json({ success: true, message: 'Belge silindi' });
  } catch (err) {
    next(err);
  }
};

module.exports = { list, uploadDocument, download, remove, upload };