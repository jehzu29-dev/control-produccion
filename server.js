const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de la conexión a PostgreSQL (Supabase / Render)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Crear tabla flexible en PostgreSQL
const initDb = async () => {
  try {
    const createTableQuery = `
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
    `;
    await pool.query(createTableQuery);
    console.log('Tabla "items" inicializada correctamente en PostgreSQL.');
  } catch (err) {
    console.error('Error al inicializar la base de datos:', err);
  }
};

initDb();

// Función auxiliar para insertar items recibiendo cualquier campo
const guardarItem = async (body) => {
  const numero_orden = body.numero_orden || body.orden || body.no_orden || body.numero || '';
  const cliente = body.cliente || '';
  const pieza = body.pieza || body.descripcion || body.item || '';
  const descripcion = body.descripcion || body.pieza || '';
  const cantidad = parseInt(body.cantidad) || 1;
  const estatus = body.estatus || 'Pendiente';

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

// 1. Obtener todos los items
app.get('/api/items', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM items ORDER BY id DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Ruta estándar de guardado
app.post('/api/items', async (req, res) => {
  try {
    const nuevoItem = await guardarItem(req.body);
    res.status(201).json(nuevoItem);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Ruta específica /api/items/manual (detectada en la consola)
app.post('/api/items/manual', async (req, res) => {
  try {
    const nuevoItem = await guardarItem(req.body);
    res.status(201).json(nuevoItem);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Actualizar item
app.put('/api/items/:id', async (req, res) => {
  const { id } = req.params;
  const body = req.body;
  const numero_orden = body.numero_orden || body.orden || body.no_orden || '';
  const cliente = body.cliente || '';
  const pieza = body.pieza || body.descripcion || body.item || '';
  const descripcion = body.descripcion || body.pieza || '';
  const cantidad = parseInt(body.cantidad) || 1;
  const estatus = body.estatus || 'Pendiente';

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
    res.status(500).json({ error: err.message });
  }
});

// 5. Eliminar item
app.delete('/api/items/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM items WHERE id = $1', [id]);
    res.json({ message: 'Item eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
