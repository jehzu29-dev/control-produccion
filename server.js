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

// Inicializar la tabla en PostgreSQL si no existe
const initDb = async () => {
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS ordenes (
        id SERIAL PRIMARY KEY,
        numero_orden VARCHAR(100),
        cliente VARCHAR(250),
        pieza VARCHAR(250),
        cantidad INT,
        estatus VARCHAR(50) DEFAULT 'Pendiente',
        fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await pool.query(createTableQuery);
    console.log('Tabla ordenes verificada/creada correctamente en PostgreSQL.');
  } catch (err) {
    console.error('Error al inicializar la base de datos:', err);
  }
};

initDb();

// Rutas API
app.get('/api/ordenes', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM ordenes ORDER BY id DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ordenes', async (req, res) => {
  const { numero_orden, cliente, pieza, cantidad, estatus } = req.body;
  try {
    const insertQuery = `
      INSERT INTO ordenes (numero_orden, cliente, pieza, cantidad, estatus)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const values = [numero_orden, cliente, pieza, cantidad, estatus || 'Pendiente'];
    const { rows } = await pool.query(insertQuery, values);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/ordenes/:id', async (req, res) => {
  const { id } = req.params;
  const { numero_orden, cliente, pieza, cantidad, estatus } = req.body;
  try {
    const updateQuery = `
      UPDATE ordenes
      SET numero_orden = $1, cliente = $2, pieza = $3, cantidad = $4, estatus = $5
      WHERE id = $6
      RETURNING *;
    `;
    const values = [numero_orden, cliente, pieza, cantidad, estatus, id];
    const { rows } = await pool.query(updateQuery, values);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/ordenes/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM ordenes WHERE id = $1', [id]);
    res.json({ message: 'Orden eliminada correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
