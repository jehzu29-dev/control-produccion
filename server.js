const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Inicializador de base de datos que asegura todas las columnas posibles
const initDb = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS items (
        id SERIAL PRIMARY KEY,
        numero_orden TEXT,
        cliente TEXT,
        pieza TEXT,
        descripcion TEXT,
        cantidad INT,
        estatus TEXT DEFAULT 'Pendiente',
        datos JSONB DEFAULT '{}'::jsonb,
        fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Agregar columnas por si la tabla ya existía con una estructura vieja
    const alterQueries = [
      'ALTER TABLE items ADD COLUMN IF NOT EXISTS numero_orden TEXT;',
      'ALTER TABLE items ADD COLUMN IF NOT EXISTS cliente TEXT;',
      'ALTER TABLE items ADD COLUMN IF NOT EXISTS pieza TEXT;',
      'ALTER TABLE items ADD COLUMN IF NOT EXISTS descripcion TEXT;',
      'ALTER TABLE items ADD COLUMN IF NOT EXISTS cantidad INT;',
      'ALTER TABLE items ADD COLUMN IF NOT EXISTS estatus TEXT DEFAULT \'Pendiente\';',
      'ALTER TABLE items ADD COLUMN IF NOT EXISTS datos JSONB DEFAULT \'{}\'::jsonb;'
    ];

    for (let q of alterQueries) {
      await pool.query(q).catch(() => {});
    }

    console.log('Tabla "items" sincronizada y lista en PostgreSQL.');
  } catch (err) {
    console.error('Error al inicializar la base de datos:', err);
  }
};

initDb();

// Guardado ultra-seguro
const guardarItem = async (body) => {
  const numero_orden = String(body.numero_orden || body.orden || body.no_orden || body.numero || '');
  const cliente = String(body.cliente || '');
  const pieza = String(body.pieza || body.descripcion || body.item || '');
  const descripcion = String(body.descripcion || body.pieza || '');
  const cantidad = parseInt(body.cantidad) || 1;
  const estatus = String(body.estatus || 'Pendiente');

  const insertQuery = `
    INSERT INTO items (numero_orden, cliente, pieza, descripcion, cantidad, estatus, datos)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *;
  `;
  const values = [numero_orden, cliente, pieza, descripcion, cantidad, estatus, JSON.stringify(body)];
  const { rows } = await pool.query(insertQuery, values);
  return rows[0];
};

// --- RUTAS API ---

app.get('/api/items', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM items ORDER BY id DESC');
    res.json(rows);
  } catch (err) {
    console.error('Error en GET /api/items:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/items', async (req, res) => {
  try {
    const nuevoItem = await guardarItem(req.body);
    res.status(201).json(nuevoItem);
  } catch (err) {
    console.error('Error en POST /api/items:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/items/manual', async (req, res) => {
  try {
    const nuevoItem = await guardarItem(req.body);
    res.status(201).json(nuevoItem);
  } catch (err) {
    console.error('Error en POST /api/items/manual:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/items/:id', async (req, res) => {
  const { id } = req.params;
  const body = req.body;
  const numero_orden = String(body.numero_orden || body.orden || body.no_orden || '');
  const cliente = String(body.cliente || '');
  const pieza = String(body.pieza || body.descripcion || body.item || '');
  const descripcion = String(body.descripcion || body.pieza || '');
  const cantidad = parseInt(body.cantidad) || 1;
  const estatus = String(body.estatus || 'Pendiente');

  try {
    const updateQuery = `
      UPDATE items
      SET numero_orden = $1, cliente = $2, pieza = $3, descripcion = $4, cantidad = $5, estatus = $6, datos = $7
      WHERE id = $8
      RETURNING *;
    `;
    const values = [numero_orden, cliente, pieza, descripcion, cantidad, estatus, JSON.stringify(body), id];
    const { rows } = await pool.query(updateQuery, values);
    res.json(rows[0]);
  } catch (err) {
    console.error('Error en PUT /api/items:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/items/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM items WHERE id = $1', [id]);
    res.json({ message: 'Item eliminado' });
  } catch (err) {
    console.error('Error en DELETE /api/items:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
