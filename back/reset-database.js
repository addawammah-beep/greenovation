const bodyParser = require('body-parser');
const express = require('express');
const cors = require('cors');
const {Pool} = require('pg');
const bcrypt = require('bcrypt');
const app = express();

app.use(express.json()); // Use built-in JSON parser
app.use(cors());

const PORT = 4000;
// const userCode = "";
// let resultt=0;

const db = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'Greenovation',
    password: 'Maw#2011',
    port: 5432,
});


// User signup endpoint
app.post('/users', async (req, res) => {
    const { email, password, phone, type ,registry, gps,name} = req.body;
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
                'INSERT INTO sellers (email, password, phone,name, registry, gps, points) VALUES ($1, $2, $3, $4, $5, POINT($6, $7), 0) RETURNING *',
                [email, hashedPassword, phone, name, registry, gps.split(',')[1] || '0', gps.split(',')[0] || '0']
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

    res.json({ success: true, user});
} catch (error) {
    console.error('Error in login:', error);
    res.status(500).json({ error: 'Login failed'});
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
                   c.phone as collector_phone 
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
        
        const { user_id, weight, location, description, gps } = req.body;
        
        console.log('Extracted data:', { user_id, weight, location, description, gps });
        
        if (!user_id || !weight || !location) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        let query, values;
        
        if (gps && gps.split(',').length === 2) {
            const [lat, lng] = gps.split(',');
            query = 'INSERT INTO requests (user_id,material_type, weight, location, description, gps, status, created_at) VALUES ($1, $2, $3, $4, POINT($6, $5), $7, CURRENT_TIMESTAMP) RETURNING *';
            values = [user_id, material_type, weight, location, description || null, lat.trim(), lng.trim(), 'pending'];
        } else {
            query = 'INSERT INTO requests (user_id,material_type, weight, location, description, status, created_at) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP) RETURNING *';
            values = [user_id, material_type, weight, location, description || null, 'pending'];
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
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // Update request status and assign collector
        let query, values;
        
        if (collector_location && collector_location.split(',').length === 2) {
            const [lat, lng] = collector_location.split(',');
            query = 'UPDATE requests SET status = $1, collector_id = $2, collector_gps = POINT($4, $3), collected_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING *';
            values = ['assigned', collector_id, lat.trim(), lng.trim(), request_id];
        } else {
            query = 'UPDATE requests SET status = $1, collector_id = $2, collected_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *';
            values = ['assigned', collector_id, request_id];
        }
        
        const result = await db.query(query, values);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Request not found' });
        }
        
        res.json({ success: true, request: result.rows[0] });
    } catch (error) {
        console.error('Error collecting request:', error);
        res.status(500).json({ error: 'Failed to collect request' });
    }
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
    try {
        const { request_id, collector_id } = req.body;
        
        if (!request_id || !collector_id) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const result = await db.query(
            'UPDATE requests SET status = $1, completed_at = CURRENT_TIMESTAMP WHERE id = $2 AND collector_id = $3 RETURNING *',
            ['completed', request_id, collector_id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Request not found or unauthorized' });
        }
        
        res.json({ success: true, request: result.rows[0] });
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

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});