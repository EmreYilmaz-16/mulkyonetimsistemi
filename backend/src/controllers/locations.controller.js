const { query } = require('../config/database');

const getCities = async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT id, name, plate_code FROM cities ORDER BY name ASC'
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

const getDistricts = async (req, res, next) => {
  try {
    const { city_id } = req.query;
    if (!city_id) {
      return res.status(400).json({ success: false, message: 'city_id zorunludur' });
    }
    const { rows } = await query(
      'SELECT id, name FROM districts WHERE city_id = $1 ORDER BY name ASC',
      [city_id]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

module.exports = { getCities, getDistricts };
