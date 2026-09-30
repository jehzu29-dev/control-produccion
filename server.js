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

// Inicializar tabla con soporte para guardar el objeto completo en JSON
const initDb = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS items (
        id SERIAL PRIMARY KEY,
        datos JSONB DEFAULT '{}'::jsonb,
        fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query('ALTER TABLE items ADD COLUMN IF NOT EXISTS datos JSONB DEFAULT \'{}\'::jsonb;').catch(() => {});
    console.log('Tabla "items" lista en PostgreSQL.');
  } catch (err) {
    console.error('Error al inicializar la base de datos:', err);
  }
};

initDb();

// Función para formatear las respuestas unificando el ID y los datos
const formatItemResponse = (row) => {
  if (!row) return null;
  const datos = row.datos || {};
  return {
    ...datos,
    id: row.id,
    _id: row.id
  };
};

// --- RUTAS API ---

app.get('/api/items', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM items ORDER BY id DESC');
    const items = rows.map(formatItemResponse);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const guardarItem = async (body) => {
  const insertQuery = `
    INSERT INTO items (datos)
    VALUES ($1)
    RETURNING *;
  `;
  const { rows } = await pool.query(insertQuery, [JSON.stringify(body)]);
  return formatItemResponse(rows[0]);
};

app.post('/api/items', async (req, res) => {
  try {
    const nuevoItem = await guardarItem(req.body);
    res.status(201).json(nuevoItem);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/items/manual', async (req, res) => {
  try {
    const nuevoItem = await guardarItem(req.body);
    res.status(201).json(nuevoItem);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/items/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const updateQuery = `
      UPDATE items
      SET datos = $1
      WHERE id = $2
      RETURNING *;
    `;
    const { rows } = await pool.query(updateQuery, [JSON.stringify(req.body), id]);
    res.json(formatItemResponse(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/items/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM items WHERE id = $1', [id]);
    res.json({ message: 'Item eliminado correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
