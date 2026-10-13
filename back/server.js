const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "db.env") });
const analyzeImage = require("./gemini");
const multer = require("multer");
const fs = require("fs");
const crypto = require('crypto');
const bodyParser = require('body-parser');
const express = require('express');
const cors = require('cors');
const {Pool} = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { calculatePoints, verifyArrival, reconcileWeights } = require('./domain');
const app = express();

app.use(express.json({ limit: "10mb" })); // Allow profile images stored as data URLs
app.use(cors());

// ================= Upload Configuration =================

if (!fs.existsSync("uploads")) {
    fs.mkdirSync("uploads");
}

app.use("/uploads", express.static("uploads"));

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/");
    },

    filename: (req, file, cb) => {
        cb(
            null,
            Date.now() +
            "-" +
            Math.round(Math.random() * 1000000) +
            path.extname(file.originalname)
        );
    },
}); 


const upload = multer({
    storage,

    limits: {
        fileSize: 10 * 1024 * 1024,
    },

    fileFilter: (req, file, cb) => {

        const allowed = [
            "image/jpeg",
            "image/png",
            "image/jpg",
            "image/webp",
        ];

        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Only image files are allowed."));
        }
    },
});

const PORT = 4000;
// const userCode = "";
// let resultt=0;

const db = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) console.warn('JWT_SECRET is not configured. Set it before deploying Greenovation.');

const signToken = (user, role) => jwt.sign(
    { sub: user.id, role, email: user.email },
    JWT_SECRET || 'development-only-secret',
    { expiresIn: '8h' }
);

const authenticate = (req, res, next) => {
    const authorization = req.headers.authorization || '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    try {
        req.auth = jwt.verify(token, JWT_SECRET || 'development-only-secret');
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired session' });
    }
};

const authorize = (...roles) => (req, res, next) => {
    const role = req.auth?.role === 'seller' ? 'merchant' : req.auth?.role;
    if (!roles.includes(role)) return res.status(403).json({ error: 'Insufficient permissions' });
    next();
};

const audit = async (client, event) => {
    await client.query(
        `INSERT INTO audit_events
         (actor_id, actor_role, action, entity_type, entity_id, previous_value, new_value, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [event.actorId || null, event.actorRole || null, event.action, event.entityType,
            String(event.entityId || ''), event.previousValue || null, event.newValue || null, event.metadata || null]
    );
};

const enqueueNotification = async (client, event) => {
    await client.query(
        `INSERT INTO notification_outbox (recipient_id, recipient_role, event_type, entity_type, entity_id, payload)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [event.recipientId, event.recipientRole, event.eventType, event.entityType || null, String(event.entityId || ''), event.payload || {}]
    );
};

const processNotificationOutbox = async () => {
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const pending = await client.query(`SELECT * FROM notification_outbox
            WHERE status = 'pending' AND available_at <= CURRENT_TIMESTAMP
            ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 25`);
        for (const event of pending.rows) {
            await client.query(`INSERT INTO notifications (recipient_id, recipient_role, event_type, entity_type, entity_id, payload)
                VALUES ($1, $2, $3, $4, $5, $6)`, [event.recipient_id, event.recipient_role, event.event_type, event.entity_type, event.entity_id, event.payload]);
            await client.query(`UPDATE notification_outbox SET status = 'sent', attempts = attempts + 1, processed_at = CURRENT_TIMESTAMP WHERE id = $1`, [event.id]);
        }
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Notification outbox processing failed:', error.message);
    } finally { client.release(); }
};



// User signup endpoint
app.post('/users', async (req, res) => {
    const { email, password, phone, type ,registry, gps, name} = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        if (type === 'user') {
            const result = await db.query(
                'INSERT INTO users (email, password, phone,name, balance, points) VALUES ($1, $2, $3, $4, 0, 0) RETURNING *',
                [email, hashedPassword, phone,name]
            );
            res.json({ success: true, user: result.rows[0] });
         }
        else if (type === 'seller') {
            // Validate GPS coordinates
            if (!gps || gps.split(',').length !== 2) {
                return res.status(400).json({ error: 'Invalid GPS coordinates format. Expected: latitude,longitude' });
            }
            
            const [lat, lng] = gps.split(',');
            const result = await db.query(
                `INSERT INTO sellers (email, password, phone, name, registry, commercial_registration_number,
                    tax_registration_number, business_address, legal_name, business_activity, branch_name,
                    branch_address, responsible_person, gps, points, account_status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, POINT($15, $14), 0, 'PENDING_VERIFICATION') RETURNING *`,
                [email, hashedPassword, phone, name, registry, req.body.commercial_registration_number,
                    req.body.tax_registration_number, req.body.business_address, req.body.legal_name,
                    req.body.business_activity, req.body.branch_name, req.body.branch_address,
                    req.body.responsible_person, gps.split(',')[0] || '0', gps.split(',')[1] || '0']
            );
            res.json({ success: true, seller: result.rows[0] });
        } else if (type === 'collector') {
            // Validate GPS coordinates
            if (!gps || gps.split(',').length !== 2) {
                return res.status(400).json({ error: 'Invalid GPS coordinates format. Expected: latitude,longitude' });
            }
            
            const [lat, lng] = gps.split(',');
            const result = await db.query(
                'INSERT INTO collectors (email, password, phone,name, registry, gps, points) VALUES ($1, $2, $3, $4, $5, POINT($6, $7), 0) RETURNING *',
                [email, hashedPassword, phone, name, registry, gps.split(',')[1] || '0', gps.split(',')[0] || '0']
            );
            res.json({ success: true, collector: result.rows[0] });
        }
    } catch (error) {
        console.error('Error in signup:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Public, read-only collector profile. Never expose credentials.
app.get('/api/collectors/:id/public', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT c.id, c.name, c.age, c.phone, c.location_name, c.profile_image,
                    COUNT(r.id) FILTER (WHERE r.status = 'completed')::INTEGER AS completed_orders,
                    TRUE AS is_active
             FROM collectors c
             LEFT JOIN requests r ON r.collector_id = c.id
             WHERE c.id = $1
             GROUP BY c.id, c.name, c.age, c.phone, c.location_name, c.profile_image`,
            [req.params.id]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Collector not found' });
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching public collector profile:', error);
        res.status(500).json({ error: 'Failed to fetch collector profile' });
    }
});

app.post('/users/login', async (req, res) => {
  const { email, password, type} = req.body;

  if (!email ||!password ||!type) {
    return res.status(400).json({ error: 'Missing login credentials'});
}

  try {
    let result;

    if (type === 'user') {
      result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
} else if (type === 'seller') {
      result = await db.query('SELECT * FROM sellers WHERE email = $1', [email]);
} else if (type === 'collector') {
      result = await db.query('SELECT * FROM collectors WHERE email = $1', [email]);
} else {
      return res.status(400).json({ error: 'Invalid account type'});
}

    if (!result || result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials'});
}

    const user = result.rows[0];
    //code user
    // userCode = user.code_user;
    console.log('Retrieved user:', user);
    // console.log('code user:', userCode);
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials'});
    }

    const role = type === 'seller' ? 'merchant' : type;
    res.json({ success: true, user, token: signToken(user, role), role });
} catch (error) {
    console.error('Error in login:', error);
    res.status(500).json({ error: 'Login failed'});
}
});

app.put('/collectors/:id/profile', async (req, res) => {
    const { id } = req.params;
    const { name, phone, registry, gps, location_name, profile_image } = req.body;

    try {
        const result = await db.query(
            `UPDATE collectors
             SET name = COALESCE($1, name),
                     phone = COALESCE($2, phone),
                     registry = COALESCE($3, registry),
                     gps = COALESCE($4, gps),
                     location_name = COALESCE($5, location_name),
                     profile_image = COALESCE($6, profile_image)
             WHERE id = $7
             RETURNING *`,
            [name, phone, registry, gps, location_name, profile_image, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Collector not found' });
        }

        res.json({ success: true, user: result.rows[0] });
    } catch (error) {
        console.error('Error updating collector profile:', error);
        res.status(500).json({ error: 'Failed to update collector profile' });
    }
});

app.put('/accounts/:type/:id/profile', async (req, res) => {
    const tableByType = { user: 'users', seller: 'sellers', collector: 'collectors' };
    const accountType = req.params.type;
    const table = tableByType[accountType];
    const { id } = req.params;
    const { name, phone, registry, profile_image } = req.body;

    if (!table) return res.status(400).json({ error: 'Invalid account type' });

    try {
        const values = accountType === 'user'
            ? [name, phone, profile_image, id]
            : [name, phone, registry, profile_image, id];
        const profileFields = accountType === 'user'
            ? 'name = COALESCE($1, name), phone = COALESCE($2, phone), profile_image = COALESCE($3, profile_image)'
            : 'name = COALESCE($1, name), phone = COALESCE($2, phone), registry = COALESCE($3, registry), profile_image = COALESCE($4, profile_image)';
        const result = await db.query(
            `UPDATE ${table}
             SET ${profileFields}
             WHERE id = $${values.length} RETURNING *`,
            values
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Account not found' });
        res.json({ success: true, user: result.rows[0] });
    } catch (error) {
        console.error('Error updating account profile:', error);
        res.status(500).json({ error: error.message || 'Failed to update account profile' });
    }
});

// جلب طلبات المستخدم
app.get('/users/:id/requests', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'SELECT * FROM requests WHERE user_id = $1',
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// جلب أكواد المستخدم
app.get('/api/codes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'SELECT * FROM codes WHERE user_id = $1',
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch codes' });
  }
});

// جلب جامعي التاجر
app.get('/sellers/:id/collectors', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'SELECT * FROM collectors WHERE collector_id = $1',
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch collectors' });
  }
});

// جلب أكواد التاجر
app.get('/api/seller-codes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'SELECT * FROM codes WHERE seller_id = $1',
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch seller codes' });
  }
});
// جلب عروض الجامع
app.get('/api/offers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'SELECT * FROM offers WHERE collector_id = $1',
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch offers' });
  }
});

// Requests endpoints
app.get('/api/requests/all', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM requests ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching all requests:', error);
        res.status(500).json({ error: 'Failed to fetch requests' });
    }
});

app.get('/api/requests/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const result = await db.query(`
            SELECT r.*, 
                   c.name as collector_name, 
                    c.profile_image as collector_profile_image,
                    CASE WHEN r.status IN ('in_progress', 'completion_pending', 'completed')
                            THEN c.phone ELSE NULL END as collector_phone,
                       COALESCE((SELECT json_agg(json_build_object(
                           'id', candidate.collector_id,
                           'name', candidate_collector.name,
                           'profile_image', candidate_collector.profile_image
                       ) ORDER BY candidate.created_at)
                       FROM request_collector_candidates candidate
                       JOIN collectors candidate_collector ON candidate_collector.id = candidate.collector_id
                       WHERE candidate.request_id = r.id), '[]') as collector_candidates
            FROM requests r 
            LEFT JOIN collectors c ON r.collector_id = c.id 
            WHERE r.user_id = $1 
            ORDER BY r.created_at DESC
        `, [userId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching requests:', error);
        res.status(500).json({ error: 'Failed to fetch requests' });
    }
});

app.post('/api/requests', async (req, res) => {
    try {
        console.log('Request body received:', req.body);
        
        const { user_id, weight, location, description, gps, material_type } = req.body;
        
        console.log('Extracted data:', { user_id, weight, location, description, gps , material_type});
        
        const gpsValues = String(gps || '').split(',').map(value => Number(value.trim()));
        if (!user_id || !weight || !location || !material_type || gpsValues.length !== 2 || gpsValues.some(value => !Number.isFinite(value))) {
            return res.status(400).json({ error: 'Material, pickup location, valid pickup GPS, and weight are required' });
        }
        
        let query, values;
        
        if (gps && gps.split(',').length === 2) {
            const [lat, lng] = gps.split(',');
            query = 'INSERT INTO requests (user_id, weight, location, description, gps,material_type, status, created_at) VALUES ($1, $2, $3, $4, POINT($6, $5), $7, $8, CURRENT_TIMESTAMP) RETURNING *';
            values = [user_id, weight, location, description || null, lat.trim(), lng.trim(), material_type, 'pending'];
        }

        
        console.log('Executing query:', query);
        console.log('With values:', values);
        
        const result = await db.query(query, values);
        
        res.json({ success: true, request: result.rows[0] });
    } catch (error) {
        console.error('Error creating request:', error);
        res.status(500).json({ error: 'Failed to create request' });
    }
});

// Collectors endpoints
app.get('/api/requests/all', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM requests ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching all requests:', error);
        res.status(500).json({ error: 'Failed to fetch requests' });
    }
});

app.put('/api/requests/collect', async (req, res) => {
    try {
        const { request_id, collector_id, collector_location } = req.body;

        if (!request_id || !collector_id) {
            return res.status(400).json({
                error: 'Missing required fields'
            });
        }

        const candidateResult = await db.query(
            `INSERT INTO request_collector_candidates (request_id, collector_id)
             SELECT $1, $2 WHERE EXISTS (SELECT 1 FROM requests WHERE id = $1 AND status IN ('pending', 'CREATED'))
             ON CONFLICT (request_id, collector_id) DO NOTHING
             RETURNING *`,
            [request_id, collector_id]
        );
        if (!candidateResult.rows.length) {
            return res.status(409).json({ error: 'You have already selected this request or it does not exist' });
        }

        res.json({ success: true, candidate: candidateResult.rows[0], message: 'Your request to collect was sent to the user' });
        return;

        /* The old direct assignment flow is intentionally kept below as a reference. */
        let query;
        let values;

        if (collector_location) {
            const cleanLocation = collector_location
                .toString()
                .replace(/[()]/g, '')
                .trim();

            const [lat, lng] = cleanLocation
                .split(',')
                .map(v => v.trim());

            if (
                lat === undefined ||
                lng === undefined ||
                isNaN(parseFloat(lat)) ||
                isNaN(parseFloat(lng))
            ) {
                return res.status(400).json({
                    error: 'Invalid collector location'
                });
            }

            query = `
                UPDATE requests
                SET
                    status = $1,
                    collector_id = $2,
                    collector_gps = POINT($4, $3),
                    collected_at = CURRENT_TIMESTAMP
                WHERE id = $5
                RETURNING *
            `;

            values = [
                'assigned',
                collector_id,
                parseFloat(lat),
                parseFloat(lng),
                request_id
            ];

        } else {
            query = `
                UPDATE requests
                SET
                    status = $1,
                    collector_id = $2,
                    collected_at = CURRENT_TIMESTAMP
                WHERE id = $3
                RETURNING *
            `;

            values = [
                'assigned',
                collector_id,
                request_id
            ];
        }

        console.log('Collect request query:', query);
        console.log('Collect request values:', values);

        const result = await db.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Request not found'
            });
        }

        res.json({
            success: true,
            request: result.rows[0]
        });

    } catch (error) {
        console.error('Error collecting request:', error);

        res.status(500).json({
            error: 'Failed to collect request',
            details: error.message
        });
    }
});

app.put('/api/requests/select-collector', async (req, res) => {
    try {
        const { request_id, user_id, collector_id } = req.body;
        if (!request_id || !user_id || !collector_id) return res.status(400).json({ error: 'Missing required fields' });

        const result = await db.query(
            `UPDATE requests r
             SET status = 'in_progress', collector_id = $1, collected_at = CURRENT_TIMESTAMP
             WHERE r.id = $2 AND r.user_id = $3 AND r.status IN ('pending', 'CREATED')
               AND EXISTS (SELECT 1 FROM request_collector_candidates c WHERE c.request_id = r.id AND c.collector_id = $1)
             RETURNING r.*`,
            [collector_id, request_id, user_id]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Collector selection is no longer available' });
        const selected = await db.query(
            `SELECT r.*, c.name AS collector_name, c.phone AS collector_phone,
                    c.profile_image AS collector_profile_image
             FROM requests r LEFT JOIN collectors c ON c.id = r.collector_id
             WHERE r.id = $1`,
            [request_id]
        );
        res.json({ success: true, request: selected.rows[0] });
    } catch (error) {
        console.error('Error selecting collector:', error);
        res.status(500).json({ error: 'Failed to select collector' });
    }
});

// Secure workflow API. The legacy endpoints above remain for migration compatibility.
app.get('/api/v2/collector/dashboard', authenticate, authorize('collector'), async (req, res) => {
    try {
        const result = await db.query(`SELECT
            COUNT(*) FILTER (WHERE status IN ('ASSIGNED', 'assigned'))::int AS assigned_requests,
            COUNT(*) FILTER (WHERE status IN ('COLLECTOR_EN_ROUTE', 'in_progress'))::int AS in_progress,
            COUNT(*) FILTER (WHERE status IN ('AWAITING_USER_CONFIRMATION', 'completion_pending'))::int AS pending_confirmation,
            COUNT(*) FILTER (WHERE status IN ('COMPLETED', 'completed') AND completed_at::date = CURRENT_DATE)::int AS completed_today,
            COUNT(*) FILTER (WHERE status IN ('DISPUTED', 'disputed'))::int AS disputed_requests
            FROM requests WHERE collector_id = $1`, [req.auth.sub]);
        const materialTotals = await db.query(`SELECT material_type,
                SUM(COALESCE(actual_weight, collected_weight, 0))::numeric(12, 3) AS total_weight_kg
            FROM requests
            WHERE collector_id = $1 AND status IN ('COMPLETED', 'completed')
            GROUP BY material_type
            ORDER BY material_type`, [req.auth.sub]);
        res.json({ dashboard: { ...result.rows[0], material_totals: materialTotals.rows } });
    } catch (error) { console.error('Collector dashboard failed:', error); res.status(500).json({ error: 'Failed to load collector dashboard' }); }
});

app.get('/api/v2/collector/requests', authenticate, authorize('collector'), async (req, res) => {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 50);
    const offset = (page - 1) * limit;
    const allowedStatuses = ['CREATED', 'ASSIGNED', 'COLLECTOR_EN_ROUTE', 'ARRIVED', 'WEIGHING', 'AWAITING_USER_CONFIRMATION', 'DISPUTED', 'COMPLETED', 'CANCELLED', 'FAILED', 'assigned', 'in_progress', 'completion_pending', 'completed'];
    const values = [req.auth.sub, limit, offset];
    const conditions = ["(r.collector_id = $1 OR (r.collector_id IS NULL AND r.status IN ('CREATED', 'pending'))) "];
    if (req.query.status && allowedStatuses.includes(req.query.status)) { values.push(req.query.status); conditions.push(`r.status = $${values.length}`); }
    if (req.query.material) { values.push(String(req.query.material).slice(0, 80)); conditions.push(`r.material_type = $${values.length}`); }
    try {
        const result = await db.query(`SELECT r.id, r.public_reference, r.collector_id, r.material_type, r.weight AS estimated_weight,
                COALESCE(r.actual_weight, r.collected_weight) AS actual_weight, r.location, r.gps,
                r.status, r.preferred_pickup_at, r.created_at, u.name AS user_name, u.phone AS user_phone,
                CASE WHEN r.collector_id = $1 THEN 'assigned' ELSE 'available' END AS request_scope,
                EXISTS (SELECT 1 FROM request_collector_candidates candidate
                    WHERE candidate.request_id = r.id AND candidate.collector_id = $1) AS has_requested
            FROM requests r JOIN users u ON u.id = r.user_id
            WHERE ${conditions.join(' AND ')} ORDER BY r.created_at DESC LIMIT $2 OFFSET $3`, values);
        const countValues = [req.auth.sub];
        const countConditions = ["(r.collector_id = $1 OR (r.collector_id IS NULL AND r.status IN ('CREATED', 'pending'))) "];
        if (req.query.status && allowedStatuses.includes(req.query.status)) { countValues.push(req.query.status); countConditions.push(`r.status = $${countValues.length}`); }
        if (req.query.material) { countValues.push(String(req.query.material).slice(0, 80)); countConditions.push(`r.material_type = $${countValues.length}`); }
        const count = await db.query(`SELECT COUNT(*)::int AS total FROM requests r WHERE ${countConditions.join(' AND ')}`, countValues);
        res.json({ requests: result.rows, pagination: { page, limit, total: count.rows[0].total } });
    } catch (error) { console.error('Collector requests failed:', error); res.status(500).json({ error: 'Failed to load assigned requests' }); }
});

app.get('/api/v2/collector/requests/:id', authenticate, authorize('collector'), async (req, res) => {
    try {
        const result = await db.query(`SELECT r.id, r.public_reference, r.material_type, r.weight AS estimated_weight,
                COALESCE(r.actual_weight, r.collected_weight) AS actual_weight, r.location, r.gps, r.description,
                r.status, r.preferred_pickup_at, r.created_at, r.collected_at, r.completed_at,
                u.name AS user_name, u.phone AS user_phone
            FROM requests r JOIN users u ON u.id = r.user_id WHERE r.id = $1 AND r.collector_id = $2`, [req.params.id, req.auth.sub]);
        if (!result.rows.length) return res.status(404).json({ code: 'REQUEST_NOT_FOUND', error: 'Request not found' });
        res.json({ request: result.rows[0] });
    } catch (error) { res.status(500).json({ error: 'Failed to load request details' }); }
});

app.get('/api/v2/collector/notifications', authenticate, authorize('collector'), async (req, res) => {
    try {
        const result = await db.query(`SELECT id, event_type, entity_type, entity_id, payload, read_at, created_at
            FROM notifications WHERE recipient_id = $1 AND recipient_role = 'collector' ORDER BY created_at DESC LIMIT 50`, [req.auth.sub]);
        res.json({ notifications: result.rows });
    } catch (error) { res.status(500).json({ error: 'Failed to load notifications' }); }
});

app.post('/api/v2/collector/requests/:id/accept', authenticate, authorize('collector'), async (req, res) => {
    try {
        const result = await db.query(`UPDATE requests SET status = 'ASSIGNED' WHERE id = $1 AND collector_id = $2 AND status IN ('CREATED', 'pending') RETURNING *`, [req.params.id, req.auth.sub]);
        if (!result.rows.length) return res.status(409).json({ code: 'INVALID_ASSIGNMENT', error: 'Request is not assigned to this collector or is no longer available' });
        await audit(db, { actorId: req.auth.sub, actorRole: req.auth.role, action: 'REQUEST_ACCEPTED', entityType: 'request', entityId: req.params.id, newValue: { status: 'ASSIGNED' } });
        res.json({ request: result.rows[0] });
    } catch (error) { res.status(500).json({ error: 'Failed to accept request' }); }
});

app.post('/api/v2/collector/requests/:id/no-show', authenticate, authorize('collector'), async (req, res) => {
    const reason = String(req.body.reason || '').trim().slice(0, 500);
    if (!reason) return res.status(422).json({ code: 'REASON_REQUIRED', error: 'A reason is required' });
    try {
        const result = await db.query(`UPDATE requests SET status = 'USER_NO_SHOW' WHERE id = $1 AND collector_id = $2 AND status IN ('COLLECTOR_EN_ROUTE', 'ARRIVED') RETURNING *`, [req.params.id, req.auth.sub]);
        if (!result.rows.length) return res.status(409).json({ code: 'INVALID_STATE', error: 'No-show can only be reported during an active pickup' });
        await db.query("INSERT INTO request_status_history (request_id, old_status, new_status, changed_by_user_id, changed_by_role, reason) VALUES ($1, 'ARRIVED', 'USER_NO_SHOW', $2, 'collector', $3)", [req.params.id, req.auth.sub, reason]);
        await audit(db, { actorId: req.auth.sub, actorRole: req.auth.role, action: 'NO_SHOW_REPORTED', entityType: 'request', entityId: req.params.id, newValue: { status: 'USER_NO_SHOW' }, metadata: { reason } });
        res.json({ request: result.rows[0] });
    } catch (error) { res.status(500).json({ error: 'Failed to report user no-show' }); }
});

app.post('/api/v2/collector/requests/:id/cancellation-request', authenticate, authorize('collector'), async (req, res) => {
    const reason = String(req.body.reason || '').trim().slice(0, 500);
    if (!reason) return res.status(422).json({ code: 'REASON_REQUIRED', error: 'A reason is required' });
    try {
        const result = await db.query(`SELECT id, status FROM requests WHERE id = $1 AND collector_id = $2`, [req.params.id, req.auth.sub]);
        if (!result.rows.length) return res.status(404).json({ code: 'REQUEST_NOT_FOUND', error: 'Request not found' });
        await audit(db, { actorId: req.auth.sub, actorRole: req.auth.role, action: 'CANCELLATION_REQUESTED', entityType: 'request', entityId: req.params.id, metadata: { reason, status: result.rows[0].status } });
        res.status(202).json({ message: 'Cancellation request submitted for review' });
    } catch (error) { res.status(500).json({ error: 'Failed to submit cancellation request' }); }
});

app.post('/api/v2/requests', authenticate, authorize('user'), async (req, res) => {
    const { material_type, estimated_weight, location, gps, preferred_pickup_at, description } = req.body;
    const weight = Number(estimated_weight);
    const gpsValues = String(gps || '').split(',').map(value => Number(value.trim()));
    if (!material_type || !location || !Number.isFinite(weight) || weight <= 0 || gpsValues.length !== 2 || gpsValues.some(value => !Number.isFinite(value))) {
        return res.status(400).json({ error: 'Material, pickup location, valid pickup GPS, and a positive estimated weight are required' });
    }
            try {
        const result = await db.query(
            `INSERT INTO requests (user_id, material_type, weight, location, description, gps, preferred_pickup_at, status, public_reference)
             VALUES ($1, $2, $3, $4, $5, CASE WHEN $6::text IS NULL THEN NULL ELSE POINT(split_part($6::text, ',', 2)::double precision, split_part($6::text, ',', 1)::double precision) END, $7, 'CREATED', 'REQ-' || upper(substr(md5(random()::text), 1, 10)))
             RETURNING id, public_reference, material_type, weight AS estimated_weight, location, gps, preferred_pickup_at, status, created_at`,
            [req.auth.sub, material_type, weight, location, description || null, gps || null, preferred_pickup_at || null]
        );
        await audit(db, { actorId: req.auth.sub, actorRole: req.auth.role, action: 'REQUEST_CREATED', entityType: 'request', entityId: result.rows[0].id, newValue: result.rows[0] });
        res.status(201).json({ request: result.rows[0] });
    } catch (error) {
        console.error('v2 request creation failed:', error);
        res.status(500).json({ error: 'Failed to create collection request' });
    }
});

app.post('/api/v2/requests/:id/trip/start', authenticate, authorize('collector'), async (req, res) => {
    const { latitude, longitude } = req.body;
    if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) return res.status(400).json({ error: 'Valid GPS coordinates are required' });
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const collector = await client.query("SELECT account_status, availability_status FROM collectors WHERE id = $1 FOR UPDATE", [req.auth.sub]);
        const current = await client.query('SELECT * FROM requests WHERE id = $1 AND collector_id = $2 FOR UPDATE', [req.params.id, req.auth.sub]);
        if (!collector.rows.length || !['active', 'pending'].includes(collector.rows[0].account_status)) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Collector account is not approved for operations' });
        }
        if (!current.rows.length || !["ASSIGNED", "in_progress"].includes(current.rows[0].status)) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Request is not ready for a trip' });
        }
        const updated = await client.query("UPDATE requests SET status = 'COLLECTOR_EN_ROUTE', collected_at = COALESCE(collected_at, CURRENT_TIMESTAMP) WHERE id = $1 AND collector_id = $2 RETURNING *", [req.params.id, req.auth.sub]);
        await client.query("UPDATE collectors SET availability_status = 'on_trip' WHERE id = $1", [req.auth.sub]);
        await client.query("INSERT INTO request_status_history (request_id, old_status, new_status, changed_by_user_id, changed_by_role) VALUES ($1, $2, 'COLLECTOR_EN_ROUTE', $3, 'collector')", [req.params.id, current.rows[0].status, req.auth.sub]);
        await client.query(`INSERT INTO pickup_events (request_id, collector_id, event_type, latitude, longitude) VALUES ($1, $2, 'TRIP_STARTED', $3, $4)`, [req.params.id, req.auth.sub, latitude, longitude]);
        await enqueueNotification(client, { recipientId: current.rows[0].user_id, recipientRole: 'user', eventType: 'TRIP_STARTED', entityType: 'request', entityId: req.params.id, payload: { message: 'Your Collector is on the way.' } });
        await audit(client, { actorId: req.auth.sub, actorRole: req.auth.role, action: 'TRIP_STARTED', entityType: 'request', entityId: req.params.id, newValue: { latitude, longitude } });
        await client.query('COMMIT');
        res.json({ request: updated.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Trip start failed:', error);
        res.status(500).json({ error: 'Failed to start trip' });
    } finally { client.release(); }
});

app.post('/api/v2/requests/:id/arrival', authenticate, authorize('collector'), async (req, res) => {
    const { latitude, longitude, accuracy } = req.body;
    if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) return res.status(400).json({ error: 'Valid GPS coordinates are required' });
    const toleranceResult = await db.query("SELECT rule_value FROM platform_rules WHERE rule_key = 'arrival_tolerance_meters'");
    const tolerance = Number(toleranceResult.rows[0]?.rule_value || 150);
    try {
        const requestResult = await db.query(`SELECT id, user_id, gps, status FROM requests WHERE id = $1 AND collector_id = $2`, [req.params.id, req.auth.sub]);
        if (!requestResult.rows.length) return res.status(404).json({ error: 'Assigned request not found' });
        const pickup = requestResult.rows[0].gps;
        const pickupPosition = typeof pickup === 'object' ? [Number(pickup.y), Number(pickup.x)] : String(pickup || '').replace(/[()]/g, '').split(',').map(Number).reverse();
        if (pickupPosition.length !== 2 || pickupPosition.some(value => !Number.isFinite(value))) return res.status(422).json({ code: 'PICKUP_LOCATION_MISSING', error: 'Pickup coordinates are unavailable for this request' });
        const verification = verifyArrival({ collectorPosition: [Number(latitude), Number(longitude)], pickupPosition, toleranceMeters: tolerance });
        const verified = verification.valid;
        const event = await db.query(`INSERT INTO pickup_events (request_id, collector_id, event_type, latitude, longitude, distance_meters, verified) VALUES ($1, $2, 'ARRIVAL', $3, $4, $5, $6) RETURNING *`, [req.params.id, req.auth.sub, latitude, longitude, verification.distanceMeters, verified]);
        await db.query(`INSERT INTO arrival_verifications
            (request_id, collector_id, user_latitude, user_longitude, collector_latitude, collector_longitude, distance_meters, allowed_radius_meters, accuracy_meters, verified, rejection_reason)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [req.params.id, req.auth.sub, pickupPosition[0], pickupPosition[1], latitude, longitude,
                verification.distanceMeters, tolerance, accuracy, verified,
                verified ? null : 'OUTSIDE_ALLOWED_RADIUS']);
        if (!verified) return res.status(422).json({
            error: 'Collector is outside the configured arrival radius',
            code: 'ARRIVAL_OUTSIDE_RADIUS',
            distance_meters: verification.distanceMeters,
            tolerance_meters: tolerance,
            event: event.rows[0]
        });
        const updated = await db.query("UPDATE requests SET status = 'ARRIVED' WHERE id = $1 AND status = 'COLLECTOR_EN_ROUTE' RETURNING *", [req.params.id]);
        if (!updated.rows.length) return res.status(409).json({ error: 'Invalid request status transition' });
        await db.query("INSERT INTO request_status_history (request_id, old_status, new_status, changed_by_user_id, changed_by_role) VALUES ($1, 'COLLECTOR_EN_ROUTE', 'ARRIVED', $2, 'collector')", [req.params.id, req.auth.sub]);
        await enqueueNotification(db, { recipientId: requestResult.rows[0].user_id, recipientRole: 'user', eventType: 'ARRIVAL_VERIFIED', entityType: 'request', entityId: req.params.id, payload: { message: 'Your Collector has arrived.' } });
        await audit(db, { actorId: req.auth.sub, actorRole: req.auth.role, action: 'ARRIVAL_VERIFIED', entityType: 'request', entityId: req.params.id, newValue: verification });
        res.json({ request: updated.rows[0], verification });
    } catch (error) {
        console.error('Arrival verification failed:', error);
        res.status(500).json({ error: 'Failed to verify arrival' });
    }
});

app.post('/api/v2/requests/:id/weight', authenticate, authorize('collector'), async (req, res) => {
    const actualWeight = Number(req.body.actual_weight);
    if (!Number.isFinite(actualWeight) || actualWeight <= 0) return res.status(400).json({ error: 'A positive actual weight is required' });
    const { latitude, longitude, accuracy } = req.body;
    if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) return res.status(400).json({ error: 'Valid collector GPS coordinates are required' });
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const result = await client.query(`UPDATE requests SET actual_weight = $1, collected_weight = $1, status = 'AWAITING_USER_CONFIRMATION' WHERE id = $2 AND collector_id = $3 AND status = 'ARRIVED' AND actual_weight IS NULL AND EXISTS (SELECT 1 FROM arrival_verifications verification WHERE verification.request_id = requests.id AND verification.collector_id = $3 AND verification.verified = TRUE) RETURNING *`, [actualWeight, req.params.id, req.auth.sub]);
        if (!result.rows.length) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Weight can only be recorded once after verified arrival' });
        }        
        await client.query(`INSERT INTO weight_records (request_id, user_id, collector_id, estimated_weight_snapshot, actual_weight, unit, latitude, longitude, gps_accuracy)
            VALUES ($1, $2, $3, $4, $5, 'kg', $6, $7, $8)`, [req.params.id, result.rows[0].user_id, req.auth.sub, result.rows[0].weight, actualWeight, latitude, longitude, accuracy ?? null]);
        await client.query("INSERT INTO request_status_history (request_id, old_status, new_status, changed_by_user_id, changed_by_role) VALUES ($1, 'ARRIVED', 'AWAITING_USER_CONFIRMATION', $2, 'collector')", [req.params.id, req.auth.sub]);
        await enqueueNotification(client, { recipientId: result.rows[0].user_id, recipientRole: 'user', eventType: 'WEIGHT_SUBMITTED', entityType: 'request', entityId: req.params.id, payload: { actual_weight: actualWeight, message: 'Your material was weighed. Please confirm the weight.' } });
        await audit(client, { actorId: req.auth.sub, actorRole: req.auth.role, action: 'ACTUAL_WEIGHT_RECORDED', entityType: 'request', entityId: req.params.id, newValue: { actual_weight: actualWeight } });
        await client.query('COMMIT');
        res.json({ request: result.rows[0] });
    } catch (error) { await client.query('ROLLBACK'); console.error('Weight record failed:', error); res.status(500).json({ error: 'Failed to record actual weight' }); }
    finally { client.release(); }
});

app.post('/api/v2/requests/:id/weight-confirmation', authenticate, authorize('user'), async (req, res) => {
    const { action, reason } = req.body;
    if (!['confirm', 'dispute'].includes(action)) return res.status(400).json({ error: 'Action must be confirm or dispute' });
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const current = await client.query('SELECT * FROM requests WHERE id = $1 AND user_id = $2 FOR UPDATE', [req.params.id, req.auth.sub]);
        const confirmationStatuses = ['AWAITING_USER_CONFIRMATION', 'completion_pending', 'waiting_user_weight_confirmation'];
        if (!current.rows.length || !confirmationStatuses.includes(current.rows[0].status)) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Weight is not awaiting confirmation' }); }
        const request = current.rows[0];
        const actualWeight = Number(request.actual_weight ?? request.collected_weight);
        if (!Number.isFinite(actualWeight) || actualWeight <= 0) {
            await client.query('ROLLBACK');
            return res.status(422).json({ error: 'The collector has not submitted a valid actual weight' });
        }
        if (action === 'dispute') {
            const updated = await client.query("UPDATE requests SET status = 'DISPUTED', disputed_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *", [req.params.id]);
            await client.query('INSERT INTO disputes (request_id, opened_by, reason, original_value) VALUES ($1, $2, $3, $4)', [req.params.id, req.auth.sub, reason || 'User disputed recorded weight', JSON.stringify({ actual_weight: actualWeight })]);
            await audit(client, { actorId: req.auth.sub, actorRole: req.auth.role, action: 'WEIGHT_DISPUTED', entityType: 'request', entityId: req.params.id, previousValue: { status: request.status, actual_weight: request.actual_weight }, newValue: { status: 'DISPUTED' }, metadata: { reason } });
            await client.query("INSERT INTO request_status_history (request_id, old_status, new_status, changed_by_user_id, changed_by_role) VALUES ($1, $2, 'DISPUTED', $3, 'user')", [req.params.id, request.status, req.auth.sub]);
            await client.query('COMMIT');
            return res.json({ request: updated.rows[0] });
        }
        const material = await client.query('SELECT points_per_kg, rounding FROM material_types WHERE lower(trim(code)) = lower(trim($1)) AND active = TRUE', [request.material_type]);
        if (!material.rows.length) {
            await client.query('ROLLBACK');
            return res.status(422).json({ error: `No active points rule exists for material "${request.material_type}". Apply the backend migration and activate its points rule before confirming.` });
        }
        const points = calculatePoints({ actualWeight, pointsPerKg: material.rows[0].points_per_kg, rounding: material.rows[0].rounding });
        const updated = await client.query("UPDATE requests SET status = 'COMPLETED', actual_weight = $4, completed_at = CURRENT_TIMESTAMP, weight_confirmed_at = CURRENT_TIMESTAMP, weight_confirmed_by = $1, points_awarded = $2 WHERE id = $3 AND status IN ('AWAITING_USER_CONFIRMATION', 'completion_pending', 'waiting_user_weight_confirmation') RETURNING *", [req.auth.sub, points, req.params.id, actualWeight]);
        await client.query('INSERT INTO point_ledger (user_id, request_id, points, reason) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING', [req.auth.sub, req.params.id, points, 'verified_collection']);
        await client.query('UPDATE users SET points = COALESCE(points, 0) + $1 WHERE id = $2', [points, req.auth.sub]);
        const reward = await client.query(`INSERT INTO rewards (name, points_cost, value_amount, currency, active)
            VALUES ('Recycling reward', 0, $1, 'POINTS', TRUE) RETURNING id`, [points]);
        const rawCode = crypto.randomBytes(18).toString('hex').toUpperCase();
        const codeHash = crypto.createHash('sha256').update(rawCode).digest('hex');
        const coupon = await client.query(`INSERT INTO coupons (public_reference, code, secure_code_hash, reward_id, user_id, user_name, request_id, final_weight, reward_value, points_earned)
            VALUES ('CPN-' || upper(substr(md5(random()::text), 1, 10)), $1, $2, $3, $4, (SELECT name FROM users WHERE id = $4), $5, $6, $7, $8)
            ON CONFLICT (request_id) DO NOTHING
            RETURNING id, public_reference, code, reward_id, user_id, user_name, request_id, final_weight, reward_value, points_earned, status, created_at`, [rawCode, codeHash, reward.rows[0].id, req.auth.sub, req.params.id, actualWeight, points, points]);
        const issuedCoupon = coupon.rows[0] ? { ...coupon.rows[0], code: rawCode, reward_value: points } : null;
        if (coupon.rows[0]) await client.query('INSERT INTO coupon_events (coupon_id, event_type, metadata) VALUES ($1, $2, $3)', [coupon.rows[0].id, 'ISSUED', JSON.stringify({ request_id: req.params.id, points })]);
        await client.query(`INSERT INTO material_batches (public_reference, request_id, material_type, collection_weight, status)
            VALUES ('BAT-' || upper(substr(md5(random()::text), 1, 10)), $1, $2, $3, 'created') ON CONFLICT (request_id) DO NOTHING`, [req.params.id, request.material_type, actualWeight]);
        await client.query("INSERT INTO request_status_history (request_id, old_status, new_status, changed_by_user_id, changed_by_role) VALUES ($1, $2, 'COMPLETED', $3, 'user')", [req.params.id, request.status, req.auth.sub]);
        await audit(client, { actorId: req.auth.sub, actorRole: req.auth.role, action: 'WEIGHT_CONFIRMED_AND_POINTS_CALCULATED', entityType: 'request', entityId: req.params.id, previousValue: { status: request.status }, newValue: { status: 'COMPLETED', points, final_weight: actualWeight } });
        const user = await client.query('SELECT id, name, email, points FROM users WHERE id = $1', [req.auth.sub]);
        await client.query('COMMIT');
        res.json({ request: updated.rows[0], points_added: points, coupon: issuedCoupon, user: user.rows[0] });
    } catch (error) { await client.query('ROLLBACK'); console.error('Weight confirmation failed:', error); res.status(500).json({ error: 'Failed to process weight confirmation' }); }
    finally { client.release(); }
});

app.post('/api/v2/batches/:id/receive', authenticate, authorize('recycler'), async (req, res) => {
    const receivingWeight = Number(req.body.receiving_weight);
    if (!Number.isFinite(receivingWeight) || receivingWeight <= 0) return res.status(400).json({ error: 'A positive receiving weight is required' });
    try {
        const batchResult = await db.query('SELECT b.*, mt.allowed_variance_percent FROM material_batches b LEFT JOIN material_types mt ON mt.code = b.material_type WHERE b.id = $1 FOR UPDATE', [req.params.id]);
        if (!batchResult.rows.length) return res.status(404).json({ error: 'Material batch not found' });
        const batch = batchResult.rows[0];
        if (batch.status === 'received') return res.status(409).json({ error: 'Batch has already been received' });
        const reconciliation = reconcileWeights({ collectionWeight: batch.collection_weight, receivingWeight, allowedVariancePercent: batch.allowed_variance_percent ?? 5 });
        const updated = await db.query(`UPDATE material_batches SET receiving_weight = $1, recycler_id = $2, status = 'received', received_at = CURRENT_TIMESTAMP, variance_flagged = $3 WHERE id = $4 RETURNING *`, [receivingWeight, req.auth.sub, reconciliation.flagged, req.params.id]);
        await db.query("UPDATE requests SET status = 'RECEIVED_BY_RECYCLER' WHERE id = $1 AND status IN ('CONFIRMED', 'COMPLETED', 'SENT_TO_RECYCLER')", [batch.request_id]);
        await audit(db, { actorId: req.auth.sub, actorRole: req.auth.role, action: 'RECYCLER_RECEIPT_RECORDED', entityType: 'material_batch', entityId: req.params.id, newValue: { receivingWeight, reconciliation } });
        res.json({ batch: updated.rows[0], reconciliation });
    } catch (error) { console.error('Batch receipt failed:', error); res.status(500).json({ error: 'Failed to record recycling receipt' }); }
});

app.get('/api/v2/recycler/batches', authenticate, authorize('recycler'), async (req, res) => {
    try {
        const result = await db.query(`SELECT b.id, b.public_reference, b.material_type, b.collection_weight,
                b.receiving_weight, b.status, b.variance_flagged, b.created_at, b.received_at
            FROM material_batches b WHERE b.status <> 'received' OR b.recycler_id = $1
            ORDER BY b.created_at DESC LIMIT 50`, [req.auth.sub]);
        res.json({ batches: result.rows });
    } catch (error) { res.status(500).json({ error: 'Failed to load material batches' }); }
});

app.get('/api/v2/admin/overview', authenticate, authorize('admin'), async (req, res) => {
    try {
        const result = await db.query(`SELECT
            (SELECT COUNT(*) FROM users WHERE account_status = 'active')::int AS users,
            (SELECT COUNT(*) FROM collectors WHERE account_status = 'active')::int AS active_collectors,
            (SELECT COUNT(*) FROM recycling_partners WHERE account_status = 'active')::int AS recycling_partners,
            (SELECT COUNT(*) FROM merchants WHERE account_status = 'active')::int AS merchants,
            (SELECT COUNT(*) FROM requests WHERE status IN ('CREATED', 'pending'))::int AS pending_requests,
            (SELECT COUNT(*) FROM requests WHERE status IN ('COMPLETED', 'completed'))::int AS completed_collections,
            (SELECT COUNT(*) FROM disputes WHERE status = 'open')::int AS open_disputes,
            (SELECT COUNT(*) FROM material_batches WHERE variance_flagged = TRUE)::int AS flagged_batches,
            (SELECT COUNT(*) FROM coupons WHERE status = 'REDEEMED')::int AS redeemed_coupons`);
        await audit(db, { actorId: req.auth.sub, actorRole: req.auth.role, action: 'ADMIN_OVERVIEW_VIEWED', entityType: 'platform', entityId: 'overview' });
        res.json({ overview: result.rows[0] });
    } catch (error) { res.status(500).json({ error: 'Failed to load admin overview' }); }
});

app.patch('/api/v2/admin/collectors/:id/status', authenticate, authorize('admin'), async (req, res) => {
    const allowedStatuses = ['pending', 'active', 'suspended', 'inactive'];
    if (!allowedStatuses.includes(req.body.status)) return res.status(422).json({ error: 'Invalid collector account status' });
    try {
        const result = await db.query('UPDATE collectors SET account_status = $1 WHERE id = $2 RETURNING id, name, account_status, availability_status', [req.body.status, req.params.id]);
        if (!result.rows.length) return res.status(404).json({ error: 'Collector not found' });
        await audit(db, { actorId: req.auth.sub, actorRole: req.auth.role, action: 'COLLECTOR_STATUS_CHANGED', entityType: 'collector', entityId: req.params.id, newValue: result.rows[0] });
        res.json({ collector: result.rows[0] });
    } catch (error) { res.status(500).json({ error: 'Failed to update collector status' }); }
});

app.post('/api/v2/admin/login', async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    try {
        const result = await db.query(
            'SELECT id, name, email, password_hash, active FROM admins WHERE email = $1',
            [email]
        );
        if (!result.rows.length || !result.rows[0].active ||
            !(await bcrypt.compare(password, result.rows[0].password_hash))) {
            return res.status(401).json({ error: 'Invalid admin credentials' });
        }
        const admin = result.rows[0];
        res.json({
            admin: { id: admin.id, name: admin.name, email: admin.email },
            token: signToken(admin, 'admin')
        });
    } catch (error) {
        console.error('Admin login failed:', error);
        res.status(500).json({ error: 'Admin login failed' });
    }
});

app.get('/api/v2/admin/sellers', authenticate, authorize('admin'), async (req, res) => {
    try {
        const result = await db.query(`SELECT id, name, legal_name, email, phone,
                commercial_registration_number, tax_registration_number, business_activity,
                business_address, branch_name, branch_address, responsible_person,
                account_status, rejection_reason, verified_at, verified_by, created_at
            FROM sellers ORDER BY created_at DESC`);
        res.json({ sellers: result.rows });
    } catch (error) { res.status(500).json({ error: 'Failed to load seller registrations' }); }
});

app.patch('/api/v2/admin/sellers/:id/status', authenticate, authorize('admin'), async (req, res) => {
    const statusMap = { approve: 'VERIFIED', verify: 'VERIFIED', reject: 'REJECTED', suspend: 'SUSPENDED' };
    const status = statusMap[String(req.body.status || '').toLowerCase()];
    if (!status) return res.status(422).json({ error: 'Status must be approve, reject, or suspend' });
    try {
        const result = await db.query(`UPDATE sellers SET account_status = $1,
                verified_at = CASE WHEN $1 = 'VERIFIED' THEN CURRENT_TIMESTAMP ELSE verified_at END,
                verified_by = CASE WHEN $1 = 'VERIFIED' THEN $2 ELSE verified_by END,
                rejection_reason = CASE WHEN $1 = 'REJECTED' THEN $3 ELSE NULL END,
                updated_at = CURRENT_TIMESTAMP WHERE id = $4
            RETURNING id, name, email, account_status, rejection_reason, verified_at, verified_by`,
            [status, req.auth.sub, req.body.rejection_reason || null, req.params.id]);
        if (!result.rows.length) return res.status(404).json({ error: 'Seller not found' });
        await audit(db, { actorId: req.auth.sub, actorRole: req.auth.role, action: 'SELLER_STATUS_CHANGED', entityType: 'seller', entityId: req.params.id, newValue: result.rows[0] });
        res.json({ seller: result.rows[0] });
    } catch (error) { res.status(500).json({ error: 'Failed to update seller status' }); }
});

app.get('/api/v2/products', authenticate, authorize('user'), async (req, res) => {
    try {
        const result = await db.query(`SELECT p.id, p.name, p.description, p.points_cost, p.stock,
                p.seller_id, s.name AS seller_name, s.account_status AS seller_status
            FROM seller_products p
            JOIN sellers s ON s.id = p.seller_id
            WHERE p.active = TRUE AND p.stock > 0
            ORDER BY p.created_at DESC`);
        res.json({ products: result.rows });
    } catch (error) {
        console.error('Product catalog load failed:', error);
        res.status(500).json({ error: 'Failed to load products' });
    }
});

app.get('/api/v2/user/product-orders', authenticate, authorize('user'), async (req, res) => {
    try {
        const result = await db.query(`SELECT o.id, o.product_id, o.product_name, o.points_cost, o.status,
                o.created_at, o.updated_at, s.name AS seller_name
            FROM product_orders o
            JOIN sellers s ON s.id = o.seller_id
            WHERE o.user_id = $1
            ORDER BY o.created_at DESC`, [req.auth.sub]);
        const userResult = await db.query('SELECT COALESCE(points, 0) AS points FROM users WHERE id = $1', [req.auth.sub]);
        res.json({ orders: result.rows, points: Number(userResult.rows[0]?.points || 0) });
    } catch (error) {
        console.error('Product order history load failed:', error);
        res.status(500).json({ error: 'Failed to load product orders' });
    }
});

app.post('/api/v2/products/:productId/redeem', authenticate, authorize('user'), async (req, res) => {
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const userResult = await client.query('SELECT points FROM users WHERE id = $1 FOR UPDATE', [req.auth.sub]);
        if (!userResult.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'User account not found' });
        }
        const productResult = await client.query(`SELECT p.id, p.seller_id, p.name, p.points_cost, p.stock
            FROM seller_products p
            JOIN sellers s ON s.id = p.seller_id
            WHERE p.id = $1 AND p.active = TRUE AND s.account_status = 'VERIFIED'
            FOR UPDATE OF p`, [req.params.productId]);
        if (!productResult.rows.length || productResult.rows[0].stock < 1) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Product is unavailable' });
        }
        const product = productResult.rows[0];
        if (Number(userResult.rows[0].points) < product.points_cost) {
            await client.query('ROLLBACK');
            return res.status(422).json({ error: 'Insufficient points' });
        }
        const stockResult = await client.query(`UPDATE seller_products
            SET stock = stock - 1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND stock > 0 RETURNING stock`, [product.id]);
        if (!stockResult.rows.length) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Product is no longer in stock' });
        }
        const orderResult = await client.query(`INSERT INTO product_orders
            (product_id, seller_id, user_id, product_name, points_cost, points_deducted)
            VALUES ($1, $2, $3, $4, $5, FALSE)
            RETURNING id, product_id, product_name, points_cost, status, points_deducted, created_at`,
            [product.id, product.seller_id, req.auth.sub, product.name, product.points_cost]);
        await audit(client, {
            actorId: req.auth.sub,
            actorRole: 'user',
            action: 'PRODUCT_ORDER_REQUESTED',
            entityType: 'product_order',
            entityId: orderResult.rows[0].id,
            newValue: orderResult.rows[0]
        });
        await client.query('COMMIT');
        res.status(201).json({
            order: orderResult.rows[0],
            points: Number(userResult.rows[0].points),
            stock: stockResult.rows[0].stock
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Product redemption failed:', error);
        res.status(500).json({ error: 'Failed to redeem product' });
    } finally {
        client.release();
    }
});

app.get('/api/v2/seller/products', authenticate, authorize('merchant'), async (req, res) => {
    try {
        const result = await db.query(`SELECT id, name, description, points_cost, stock, active, created_at
            FROM seller_products WHERE seller_id = $1 ORDER BY created_at DESC`, [req.auth.sub]);
        res.json({ products: result.rows });
    } catch (error) {
        console.error('Seller product list failed:', error);
        res.status(500).json({ error: 'Failed to load seller products' });
    }
});

app.post('/api/v2/seller/products', authenticate, authorize('merchant'), async (req, res) => {
    const name = String(req.body.name || '').trim();
    const description = String(req.body.description || '').trim();
    const pointsCost = Number(req.body.points_cost);
    const stock = Number(req.body.stock);
    if (!name || name.length > 255 || !Number.isSafeInteger(pointsCost) || pointsCost < 1 ||
        !Number.isSafeInteger(stock) || stock < 0) {
        return res.status(422).json({ error: 'Provide a product name, positive whole-number points cost, and non-negative whole-number stock' });
    }
    try {
        const seller = await db.query('SELECT account_status FROM sellers WHERE id = $1', [req.auth.sub]);
        if (!seller.rows.length || seller.rows[0].account_status !== 'VERIFIED') {
            return res.status(403).json({ error: 'Seller verification is required to list products' });
        }
        const result = await db.query(`INSERT INTO seller_products
            (seller_id, name, description, points_cost, stock)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, name, description, points_cost, stock, active, created_at`,
            [req.auth.sub, name, description || null, pointsCost, stock]);
        res.status(201).json({ product: result.rows[0] });
    } catch (error) {
        console.error('Seller product creation failed:', error);
        res.status(500).json({ error: 'Failed to create product' });
    }
});

app.patch('/api/v2/seller/products/:productId', authenticate, authorize('merchant'), async (req, res) => {
    const updates = [];
    const values = [];
    if (req.body.active !== undefined) {
        if (typeof req.body.active !== 'boolean') {
            return res.status(422).json({ error: 'Product active status must be true or false' });
        }
        values.push(req.body.active);
        updates.push(`active = $${values.length}`);
    }
    if (req.body.stock !== undefined) {
        const stock = Number(req.body.stock);
        if (!Number.isSafeInteger(stock) || stock < 0) {
            return res.status(422).json({ error: 'Product stock must be a non-negative whole number' });
        }
        values.push(stock);
        updates.push(`stock = $${values.length}`);
    }
    if (!updates.length) return res.status(422).json({ error: 'Provide a product field to update' });
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.params.productId, req.auth.sub);
    try {
        const result = await db.query(`UPDATE seller_products SET ${updates.join(', ')}
            WHERE id = $${values.length - 1} AND seller_id = $${values.length}
            RETURNING id, name, description, points_cost, stock, active, created_at`,
            values);
        if (!result.rows.length) return res.status(404).json({ error: 'Product not found' });
        res.json({ product: result.rows[0] });
    } catch (error) {
        console.error('Seller product update failed:', error);
        res.status(500).json({ error: 'Failed to update product' });
    }
});

app.get('/api/v2/seller/product-orders', authenticate, authorize('merchant'), async (req, res) => {
    try {
        const result = await db.query(`SELECT o.id, o.product_id, o.product_name, o.points_cost, o.status,
                o.created_at, o.updated_at, u.name AS user_name, u.email AS user_email
            FROM product_orders o
            JOIN users u ON u.id = o.user_id
            WHERE o.seller_id = $1
            ORDER BY o.created_at DESC`, [req.auth.sub]);
        res.json({ orders: result.rows });
    } catch (error) {
        console.error('Seller product order load failed:', error);
        res.status(500).json({ error: 'Failed to load product orders' });
    }
});

app.patch('/api/v2/seller/product-orders/:orderId', authenticate, authorize('merchant'), async (req, res) => {
    const status = req.body.status;
    if (!['approved', 'rejected', 'fulfilled'].includes(status)) {
        return res.status(422).json({ error: 'Status must be approved, rejected, or fulfilled' });
    }
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const orderResult = await client.query(`SELECT id, product_id, user_id, product_name, points_cost,
                status, points_deducted
            FROM product_orders WHERE id = $1 AND seller_id = $2 FOR UPDATE`, [req.params.orderId, req.auth.sub]);
        if (!orderResult.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Product order not found' });
        }
        const order = orderResult.rows[0];
        const allowedTransition = (order.status === 'pending' && ['approved', 'rejected'].includes(status)) ||
            (order.status === 'approved' && status === 'fulfilled');
        if (!allowedTransition) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'This order cannot be moved to the requested status' });
        }
        let updatedUserPoints = null;
        if (status === 'approved' && !order.points_deducted) {
            const userResult = await client.query('SELECT points FROM users WHERE id = $1 FOR UPDATE', [order.user_id]);
            if (!userResult.rows.length || Number(userResult.rows[0].points) < order.points_cost) {
                await client.query('ROLLBACK');
                return res.status(422).json({ error: 'The customer no longer has enough points to confirm this order' });
            }
            const debitResult = await client.query(`UPDATE users SET points = points - $1
                WHERE id = $2 AND points >= $1 RETURNING points`, [order.points_cost, order.user_id]);
            if (!debitResult.rows.length) {
                await client.query('ROLLBACK');
                return res.status(422).json({ error: 'The customer no longer has enough points to confirm this order' });
            }
            updatedUserPoints = Number(debitResult.rows[0].points);
            await client.query(`INSERT INTO point_ledger (user_id, request_id, points, reason)
                VALUES ($1, NULL, $2, 'product_redemption')`, [order.user_id, -order.points_cost]);
        }
        if (status === 'rejected') {
            if (order.points_deducted) {
                const refundResult = await client.query('UPDATE users SET points = points + $1 WHERE id = $2 RETURNING points', [order.points_cost, order.user_id]);
                updatedUserPoints = Number(refundResult.rows[0].points);
                await client.query(`INSERT INTO point_ledger (user_id, request_id, points, reason)
                    VALUES ($1, NULL, $2, 'product_redemption_refund')`, [order.user_id, order.points_cost]);
            }
            if (order.product_id) {
                await client.query(`UPDATE seller_products SET stock = stock + 1, updated_at = CURRENT_TIMESTAMP
                    WHERE id = $1`, [order.product_id]);
            }
        }
        const updated = await client.query(`UPDATE product_orders
            SET status = $1::varchar,
                points_deducted = CASE WHEN $1::text = 'approved' THEN TRUE ELSE points_deducted END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING id, product_id, product_name, points_cost, status, points_deducted, created_at, updated_at`,
            [status, order.id]);
        await audit(client, {
            actorId: req.auth.sub,
            actorRole: 'merchant',
            action: `PRODUCT_ORDER_${status.toUpperCase()}`,
            entityType: 'product_order',
            entityId: order.id,
            previousValue: { status: order.status },
            newValue: { status }
        });
        await client.query('COMMIT');
        res.json({ order: updated.rows[0], ...(updatedUserPoints !== null ? { points: updatedUserPoints } : {}) });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Seller product order update failed:', error);
        res.status(500).json({ error: 'Failed to update product order' });
    } finally {
        client.release();
    }
});

app.post('/api/v2/rewards/:rewardId/issue', authenticate, authorize('user'), async (req, res) => {
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const rewardResult = await client.query('SELECT * FROM rewards WHERE id = $1 AND active = TRUE AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP) FOR UPDATE', [req.params.rewardId]);
        if (!rewardResult.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Reward is not available' }); }
        const reward = rewardResult.rows[0];
        const userResult = await client.query('SELECT points FROM users WHERE id = $1 FOR UPDATE', [req.auth.sub]);
        if (!userResult.rows.length || Number(userResult.rows[0].points) < Number(reward.points_cost)) { await client.query('ROLLBACK'); return res.status(422).json({ error: 'Insufficient points' }); }
        const rawCode = crypto.randomBytes(18).toString('hex').toUpperCase();
        const codeHash = crypto.createHash('sha256').update(rawCode).digest('hex');
        const coupon = await client.query(`INSERT INTO coupons (public_reference, code, secure_code_hash, reward_id, user_id, seller_id, user_name, expires_at)
            VALUES ('CPN-' || upper(substr(md5(random()::text), 1, 10)), $1, $2, $3, $4, $5, (SELECT name FROM users WHERE id = $4), $6)
            RETURNING id, public_reference, code, reward_id, user_id, seller_id, user_name, status, expires_at, created_at`, [rawCode, codeHash, reward.id, req.auth.sub, reward.seller_id, reward.expires_at]);
        await client.query('UPDATE users SET points = points - $1 WHERE id = $2', [reward.points_cost, req.auth.sub]);
        await client.query('INSERT INTO coupon_events (coupon_id, event_type, metadata) VALUES ($1, $2, $3)', [coupon.rows[0].id, 'ISSUED', JSON.stringify({ reward_id: reward.id })]);
        await audit(client, { actorId: req.auth.sub, actorRole: req.auth.role, action: 'COUPON_CREATED', entityType: 'coupon', entityId: coupon.rows[0].id, newValue: coupon.rows[0] });
        await client.query('COMMIT');
        res.status(201).json({ coupon: { ...coupon.rows[0], code: rawCode } });
    } catch (error) { await client.query('ROLLBACK'); console.error('Coupon issue failed:', error); res.status(500).json({ error: 'Failed to issue coupon' }); }
    finally { client.release(); }
});

app.get('/api/v2/user/coupons', authenticate, authorize('user'), async (req, res) => {
    try {
        const result = await db.query(`SELECT c.id, c.public_reference, c.code, c.request_id,
                c.final_weight, c.reward_value, c.points_earned, c.status, c.created_at,
                c.redeemed_at, c.redeemed_by, redeemed_seller.name AS redeemed_by_name,
                r.name AS reward_name,
                CASE WHEN c.status = 'REDEEMED' OR (c.expires_at IS NOT NULL AND c.expires_at <= CURRENT_TIMESTAMP)
                    THEN 'inactive' ELSE 'active' END AS coupon_group,
                c.expires_at
            FROM coupons c
            LEFT JOIN rewards r ON r.id = c.reward_id
            LEFT JOIN sellers redeemed_seller ON redeemed_seller.id = c.redeemed_by
            WHERE c.user_id = $1
            ORDER BY c.created_at DESC`, [req.auth.sub]);
        const user = await db.query('SELECT COALESCE(points, 0) AS points FROM users WHERE id = $1', [req.auth.sub]);
        res.json({ coupons: result.rows, points: user.rows[0]?.points ?? 0 });
    } catch (error) {
        console.error('User coupons failed:', error);
        res.status(500).json({ error: 'Failed to load coupons' });
    }
});

app.post('/api/v2/merchant/coupons/user-lookup', authenticate, authorize('merchant'), async (req, res) => {
    const email = String(req.body.email || '').trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'A valid customer email is required' });
    }
    try {
        const seller = await db.query('SELECT account_status FROM sellers WHERE id = $1', [req.auth.sub]);
        if (!seller.rows.length || seller.rows[0].account_status !== 'VERIFIED') {
            return res.status(403).json({ error: 'Seller account must be VERIFIED to verify coupons' });
        }
        const result = await db.query(`SELECT c.id, c.public_reference, c.status, c.expires_at,
                c.created_at, c.reward_value, c.final_weight, u.id AS user_id, u.name AS user_name,
                u.email AS user_email, u.profile_image AS user_profile_image,
                r.name AS reward_name, r.value_amount, r.currency
            FROM coupons c
            JOIN users u ON u.id = c.user_id
            LEFT JOIN rewards r ON r.id = c.reward_id
            WHERE lower(u.email) = lower($1)
                AND (c.seller_id = $2 OR c.seller_id IS NULL)
                AND c.status = 'ACTIVE'
                AND (c.expires_at IS NULL OR c.expires_at > CURRENT_TIMESTAMP)
            ORDER BY c.created_at DESC`, [email, req.auth.sub]);
        await audit(db, {
            actorId: req.auth.sub,
            actorRole: req.auth.role,
            action: 'COUPONS_LOOKED_UP_BY_EMAIL',
            entityType: 'user',
            entityId: result.rows[0]?.user_id,
            metadata: { active_coupon_count: result.rows.length }
        });
        res.json({ coupons: result.rows });
    } catch (error) {
        console.error('Coupon email lookup failed:', error);
        res.status(500).json({ error: 'Failed to find active coupons' });
    }
});

app.post('/api/v2/merchant/coupons/:couponId/redeem', authenticate, authorize('merchant'), async (req, res) => {
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const seller = await client.query('SELECT account_status FROM sellers WHERE id = $1', [req.auth.sub]);
        if (!seller.rows.length || seller.rows[0].account_status !== 'VERIFIED') {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Seller account must be VERIFIED to redeem coupons' });
        }
        const result = await client.query(`UPDATE coupons
            SET status = 'REDEEMED', seller_id = $1, redeemed_at = CURRENT_TIMESTAMP, redeemed_by = $1
            WHERE id = $2 AND (seller_id = $1 OR seller_id IS NULL) AND status = 'ACTIVE'
                AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
            RETURNING id, public_reference, status, redeemed_at`,
        [req.auth.sub, req.params.couponId]);
        if (!result.rows.length) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Coupon is invalid, expired, or already redeemed' });
        }
        await client.query(
            'INSERT INTO coupon_events (coupon_id, merchant_id, event_type) VALUES ($1, $2, $3)',
            [result.rows[0].id, req.auth.sub, 'REDEEMED']
        );
        await audit(client, {
            actorId: req.auth.sub,
            actorRole: req.auth.role,
            action: 'COUPON_REDEEMED',
            entityType: 'coupon',
            entityId: result.rows[0].id,
            newValue: { status: 'REDEEMED' }
        });
        await client.query('COMMIT');
        res.json({ coupon: result.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Coupon redemption failed:', error);
        res.status(500).json({ error: 'Failed to redeem coupon' });
    } finally {
        client.release();
    }
});

app.post('/api/v2/merchant/coupons/lookup', authenticate, authorize('merchant'), async (req, res) => {
    const codeHash = crypto.createHash('sha256').update(String(req.body.code || '')).digest('hex');
    if (!req.body.code) return res.status(400).json({ error: 'Coupon code is required' });
    try {
        const seller = await db.query('SELECT id, name, account_status FROM sellers WHERE id = $1', [req.auth.sub]);
        if (!seller.rows.length || seller.rows[0].account_status !== 'VERIFIED') return res.status(403).json({ error: 'Seller account must be VERIFIED to verify coupons' });
        const result = await db.query(`SELECT c.public_reference, c.status, c.expires_at, c.created_at,
            c.redeemed_at, redeemed_seller.name AS redeemed_by_name,
            CASE
                WHEN c.status = 'REDEEMED' THEN 'REDEEMED'
                WHEN c.expires_at IS NOT NULL AND c.expires_at <= CURRENT_TIMESTAMP THEN 'EXPIRED'
                ELSE c.status
            END AS effective_status,
            c.user_id, u.name AS user_name, u.profile_image AS user_profile_image,
            c.request_id, c.final_weight, c.reward_value,
            c.seller_id, s.name AS seller_name, r.name AS reward_name, r.value_amount, r.currency
            FROM coupons c
            JOIN rewards r ON r.id = c.reward_id
            LEFT JOIN users u ON u.id = c.user_id
            LEFT JOIN requests req ON req.id = c.request_id
            LEFT JOIN sellers s ON s.id = c.seller_id
            LEFT JOIN sellers redeemed_seller ON redeemed_seller.id = c.redeemed_by
            WHERE c.secure_code_hash = $1 AND (c.seller_id = $2 OR c.seller_id IS NULL)`, [codeHash, req.auth.sub]);
        await audit(db, { actorId: req.auth.sub, actorRole: req.auth.role, action: 'COUPON_LOOKUP', entityType: 'coupon', entityId: result.rows[0]?.public_reference, metadata: { found: Boolean(result.rows.length) } });
        if (!result.rows.length) return res.status(404).json({ error: 'Coupon not found' });
        const coupon = result.rows[0];
        const valid = coupon.effective_status === 'ACTIVE';
        res.json({ coupon, valid });
    } catch (error) { res.status(500).json({ error: 'Failed to lookup coupon' }); }
});

app.post('/api/v2/merchant/coupons/redeem', authenticate, authorize('merchant'), async (req, res) => {
    const codeHash = crypto.createHash('sha256').update(String(req.body.code || '')).digest('hex');
    if (!req.body.code) return res.status(400).json({ error: 'Coupon code is required' });
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const seller = await client.query('SELECT account_status FROM sellers WHERE id = $1', [req.auth.sub]);
        if (!seller.rows.length || seller.rows[0].account_status !== 'VERIFIED') { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Seller account must be VERIFIED to redeem coupons' }); }
        const result = await client.query(`UPDATE coupons
            SET status = 'REDEEMED', redeemed_at = CURRENT_TIMESTAMP, redeemed_by = $1, seller_id = $1
            WHERE secure_code_hash = $2 AND (seller_id = $1 OR seller_id IS NULL)
                AND status = 'ACTIVE' AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
            RETURNING *`, [req.auth.sub, codeHash]);
        if (!result.rows.length) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Coupon is invalid, expired, or already redeemed' }); }
        await client.query('INSERT INTO coupon_events (coupon_id, merchant_id, event_type) VALUES ($1, $2, $3)', [result.rows[0].id, req.auth.sub, 'REDEEMED']);
        await audit(client, { actorId: req.auth.sub, actorRole: req.auth.role, action: 'COUPON_REDEEMED', entityType: 'coupon', entityId: result.rows[0].id, newValue: { status: 'REDEEMED' } });
        await client.query('COMMIT');
        res.json({ coupon: result.rows[0] });
    } catch (error) { await client.query('ROLLBACK'); res.status(500).json({ error: 'Failed to redeem coupon' }); }
    finally { client.release(); }
});

// Offers endpoints
app.get('/api/offers', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM offers ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching all offers:', error);
        res.status(500).json({ error: 'Failed to fetch offers' });
    }
});

app.get('/api/offers/:sellerId', async (req, res) => {
    try {
        const { sellerId } = req.params;
        const result = await db.query('SELECT * FROM offers WHERE seller_id = $1 ORDER BY created_at DESC', [sellerId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching offers:', error);
        res.status(500).json({ error: 'Failed to fetch offers' });
    }
});

app.post('/api/offers', async (req, res) => {
    try {
        const { seller_id, title, description, price, location, gps, material_type } = req.body;
        
        if (!seller_id || !title || !price || !location) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        let query, values;
        
        if (gps && gps.split(',').length === 2) {
            const [lat, lng] = gps.split(',');
            // query = 'INSERT INTO offers (seller_id, title, description, price, location, gps, material_type, status, created_at) VALUES ($1, $2, $3, $4, $5, POINT($7, $6), $8, CURRENT_TIMESTAMP) RETURNING *';
            // values = [seller_id, title, description || null, price, location,  lat.trim(), lng.trim(), material_type || 'plastic','active',];
             query = 'INSERT INTO offers (seller_id, title, description, price, location, gps, material_type, status) VALUES ($1, $2, $3, $4, $5, POINT($7, $6), $8,$9) RETURNING *';
            values = [seller_id, title, description || null, price, location, gps.split(',')[1] || '0', gps.split(',')[0] || '0', material_type || 'plastic','active'];
       
        } else {
            query = 'INSERT INTO offers (seller_id, title, description, price, location, material_type, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *';
            values = [seller_id, title, description || null, price, location, material_type || 'plastic', 'active'];
        }
        
        const result = await db.query(query, values);
        
        res.json({ success: true, offer: result.rows[0] });
    } catch (error) {
        console.error('Error creating offer:', error);
        res.status(500).json({ error: 'Failed to create offer' });
    }
});

app.delete('/api/offers/:offerId', async (req, res) => {
    try {
        const { offerId } = req.params;
        
        // First get the offer to verify ownership
        const offerResult = await db.query('SELECT * FROM offers WHERE id = $1', [offerId]);
        
        if (offerResult.rows.length === 0) {
            return res.status(404).json({ error: 'Offer not found' });
        }
        
        const offer = offerResult.rows[0];
        
        // Delete the offer
        const deleteResult = await db.query('DELETE FROM offers WHERE id = $1 RETURNING *', [offerId]);
        
        res.json({ success: true, offer: deleteResult.rows[0] });
    } catch (error) {
        console.error('Error deleting offer:', error);
        res.status(500).json({ error: 'Failed to delete offer' });
    }
});

app.put('/api/requests/complete', async (req, res) => {
    return res.status(410).json({ error: 'This workflow is retired. Use the verified v2 weight endpoint.' });
    try {
        const { request_id, collector_id, collected_weight } = req.body;
        const actualWeight = Number(collected_weight);
        
        if (!request_id || !collector_id || !Number.isFinite(actualWeight) || actualWeight <= 0) {
            return res.status(400).json({ error: 'A valid collected quantity is required' });
        }
        
        const result = await db.query(
            'UPDATE requests SET status = $1, collected_weight = $2, actual_weight = $2 WHERE id = $3 AND collector_id = $4 AND status IN ($5, $6) AND actual_weight IS NULL RETURNING *',
            ['completion_pending', actualWeight, request_id, collector_id, 'assigned', 'in_progress']
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Request not found or unauthorized' });
        }
        
        res.json({ success: true, request: result.rows[0], message: 'Waiting for user confirmation' });
    } catch (error) {
        console.error('Error completing request:', error);
        res.status(500).json({ error: 'Failed to complete request' });
    }
});

app.put('/api/requests/respond', async (req, res) => {
    try {
        const { request_id, user_id, action } = req.body; // action: 'accept' or 'reject'
        
        if (!request_id || !user_id || !action) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        if (action === 'accept') {
            const result = await db.query(
                'UPDATE requests SET status = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
                ['in_progress', request_id, user_id]
            );
            
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Request not found or unauthorized' });
            }
            
            res.json({ success: true, request: result.rows[0] });
        } else if (action === 'reject') {
            const result = await db.query(
                'UPDATE requests SET status = $1, collector_id = NULL, collector_gps = NULL WHERE id = $2 AND user_id = $3 RETURNING *',
                ['pending', request_id, user_id]
            );
            
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Request not found or unauthorized' });
            }
            
            res.json({ success: true, request: result.rows[0] });
        } else {
            return res.status(400).json({ error: 'Invalid action. Must be "accept" or "reject"' });
        }
    } catch (error) {
        console.error('Error responding to request:', error);
        res.status(500).json({ error: 'Failed to respond to request' });
    }
});

app.put('/api/requests/confirm-completion', async (req, res) => {
    return res.status(410).json({ error: 'This workflow is retired. Use the v2 weight-confirmation endpoint.' });
    try {
        const { request_id, user_id, action } = req.body;
        if (!request_id || !user_id || !['confirm', 'reject'].includes(action)) {
            return res.status(400).json({ error: 'Missing or invalid completion confirmation' });
        }

        const client = await db.connect();
        try {
            await client.query('BEGIN');
            const result = action === 'confirm'
                ? await client.query(
                    `UPDATE requests SET status = 'completed', completed_at = CURRENT_TIMESTAMP,
                                                        weight_confirmed_at = CURRENT_TIMESTAMP, weight_confirmed_by = $2,
                                                        actual_weight = COALESCE(actual_weight, collected_weight)
                                         WHERE id = $1 AND user_id = $2 AND status = 'completion_pending'
                                             AND COALESCE(actual_weight, collected_weight) IS NOT NULL
                     RETURNING *`,
                    [request_id, user_id]
                )
                : await client.query(
                    `UPDATE requests SET status = 'in_progress', collected_weight = NULL, actual_weight = NULL
                                         WHERE id = $1 AND user_id = $2 AND status = 'completion_pending'
                                             AND COALESCE(actual_weight, collected_weight) IS NOT NULL
                     RETURNING *`,
                    [request_id, user_id]
                );

            if (!result.rows.length) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Request not found or unauthorized' });
            }
            if (action === 'confirm') {
                const rule = await client.query('SELECT points_per_kg, rounding FROM material_types WHERE code = $1 AND active = TRUE', [result.rows[0].material_type]);
                const verifiedWeight = Number(result.rows[0].actual_weight ?? result.rows[0].collected_weight);
                const points = rule.rows.length
                    ? calculatePoints({ actualWeight: verifiedWeight, pointsPerKg: rule.rows[0].points_per_kg, rounding: rule.rows[0].rounding })
                    : 0;
                await client.query('UPDATE requests SET points_awarded = $1 WHERE id = $2', [points, request_id]);
                await client.query('INSERT INTO point_ledger (user_id, request_id, points, reason) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING', [user_id, request_id, points, 'verified_collection']);
                await client.query('UPDATE users SET points = COALESCE(points, 0) + $1 WHERE id = $2', [points, user_id]);
                const reward = await client.query(`INSERT INTO rewards (name, points_cost, value_amount, currency, active)
                    VALUES ('Recycling reward', 0, $1, 'POINTS', TRUE) RETURNING id, seller_id`, [points]);
                const rawCode = crypto.randomBytes(18).toString('hex').toUpperCase();
                const codeHash = crypto.createHash('sha256').update(rawCode).digest('hex');
                const coupon = await client.query(`INSERT INTO coupons (public_reference, secure_code_hash, reward_id, user_id, seller_id, request_id)
                    VALUES ('CPN-' || upper(substr(md5(random()::text), 1, 10)), $1, $2, $3, $4, $5)
                    ON CONFLICT (request_id) DO NOTHING
                    RETURNING id, public_reference, reward_id, user_id, seller_id, request_id, status, created_at`, [codeHash, reward.rows[0].id, user_id, reward.rows[0].seller_id, request_id]);
                const issuedCoupon = coupon.rows[0] ? { ...coupon.rows[0], code: rawCode, reward_value: points } : null;
                if (coupon.rows[0]) await client.query('INSERT INTO coupon_events (coupon_id, event_type, metadata) VALUES ($1, $2, $3)', [coupon.rows[0].id, 'ISSUED', JSON.stringify({ request_id, points })]);
                result.rows[0].points_awarded = points;
                result.rows[0].coupon = issuedCoupon;
            } else {
                await audit(client, { actorId: user_id, actorRole: 'user', action: 'COMPLETION_REJECTED_NOT_YET', entityType: 'request', entityId: request_id, previousValue: { status: 'completion_pending', actual_weight: result.rows[0].actual_weight }, newValue: { status: 'in_progress' } });
            }
            await client.query('COMMIT');
            res.json({ success: true, request: result.rows[0], points_added: action === 'confirm' ? Number(result.rows[0].points_awarded || 0) : 0, coupon: result.rows[0].coupon || null });
        } catch (transactionError) {
            await client.query('ROLLBACK');
            throw transactionError;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error confirming completion:', error);
        res.status(500).json({ error: 'Failed to confirm completion' });
    }
});

// ================= Report Environmental Issue =================

app.post("/report", upload.single("image"), async (req, res) => {

    try {

        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: "Please upload an image."
            });
        }

        const {
            problemType,
            address,
            description,
            latitude,
            longitude
        } = req.body;

        if (
            !problemType ||
            !address ||
            !description ||
            !latitude ||
            !longitude
        ) {

            return res.status(400).json({
                success: false,
                error: "Missing required fields."
            });

        }

        console.log("========== New Environmental Report ==========");

        console.log({
            image: req.file.filename,
            problemType,
            address,
            description,
            latitude,
            longitude
        });

const result = await analyzeImage(req.file.path);

if (!result.valid) {

    return res.status(400).json({

        success: false,

        message: "The uploaded image is not an environmental issue.",

        ai: result,

    });

}
        res.json({
            success: true,
            message: "Report submitted successfully.",
            report: {
                image: req.file.filename,
                problemType,
                address,
                description,
                latitude,
                longitude
            }
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            error: "Internal Server Error"
        });

    }

});


const applyPlatformMigration = async () => {
    const migrationPath = path.join(__dirname, 'migrations', '001_platform_core.sql');
    const migration = fs.readFileSync(migrationPath, 'utf8');
    for (const statement of migration.split(';').map(value => value.trim()).filter(Boolean)) {
        await db.query(statement);
    }
};

const applySellerProductsMigration = async () => {
    const migrationPath = path.join(__dirname, 'migrations', '005_seller_products.sql');
    const migration = fs.readFileSync(migrationPath, 'utf8');
    for (const statement of migration.split(';').map(value => value.trim()).filter(Boolean)) {
        await db.query(statement);
    }
};

const applyDeferredProductPointsMigration = async () => {
    const migrationPath = path.join(__dirname, 'migrations', '007_defer_product_points_charge.sql');
    const migration = fs.readFileSync(migrationPath, 'utf8');
    for (const statement of migration.split(';').map(value => value.trim()).filter(Boolean)) {
        await db.query(statement);
    }
};

const applyAdminAccountsMigration = async () => {
    const migrationPath = path.join(__dirname, 'migrations', '006_admin_accounts.sql');
    const migration = fs.readFileSync(migrationPath, 'utf8');
    for (const statement of migration.split(';').map(value => value.trim()).filter(Boolean)) {
        await db.query(statement);
    }
};

Promise.all([
    db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image TEXT'),
    db.query('ALTER TABLE sellers ADD COLUMN IF NOT EXISTS profile_image TEXT'),
    db.query('ALTER TABLE collectors ADD COLUMN IF NOT EXISTS location_name VARCHAR(255)'),
    db.query('ALTER TABLE collectors ADD COLUMN IF NOT EXISTS profile_image TEXT'),
    db.query('ALTER TABLE collectors ADD COLUMN IF NOT EXISTS age INTEGER'),
    db.query('ALTER TABLE requests ADD COLUMN IF NOT EXISTS collected_weight DECIMAL(10,2)')
    ,db.query(`CREATE TABLE IF NOT EXISTS request_collector_candidates (
        id SERIAL PRIMARY KEY,
        request_id INTEGER REFERENCES requests(id) ON DELETE CASCADE,
        collector_id INTEGER REFERENCES collectors(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (request_id, collector_id)
    )`),
    applyPlatformMigration(),
    applySellerProductsMigration().then(() => applyDeferredProductPointsMigration()),
    applyAdminAccountsMigration()
]).then(() => {
    setInterval(processNotificationOutbox, 5000);
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}).catch((error) => {
    console.error('Database migration failed:', error);
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
});