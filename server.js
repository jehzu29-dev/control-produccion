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

// Inicializar tabla en PostgreSQL
const initDb = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS items (
        id SERIAL PRIMARY KEY,
        datos JSONB DEFAULT '{}'::jsonb,
        fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Tabla "items" sincronizada en PostgreSQL.');
  } catch (err) {
    console.error('Error al inicializar la base de datos:', err);
  }
};

initDb();

// Devuelve los datos originales intactos agregando solo los mapeos de ID estándar
const formatItemResponse = (row) => {
  if (!row) return null;
  const datos = row.datos || {};
  return {
    ...datos,
    id: row.id,
    _id: row.id,
    id_item: datos.id_item || datos.codigo || datos.pieza || row.id
  };
};

// --- RUTAS API ---

app.get('/api/items', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM items ORDER BY id ASC');
    const items = rows.map(formatItemResponse);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const guardarNuevoItem = async (body) => {
  const insertQuery = `
    INSERT INTO items (datos)
    VALUES ($1)
    RETURNING *;
  `;
  const { rows } = await pool.query(insertQuery, [JSON.stringify(body)]);
  const nuevoId = rows[0].id;
  
  const datosCompletos = { ...body, id: nuevoId, _id: nuevoId };
  await pool.query('UPDATE items SET datos = $1 WHERE id = $2', [JSON.stringify(datosCompletos), nuevoId]);
  
  return formatItemResponse({ id: nuevoId, datos: datosCompletos });
};

app.post('/api/items', async (req, res) => {
  try {
    const item = await guardarNuevoItem(req.body);
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/items/manual', async (req, res) => {
  try {
    const item = await guardarNuevoItem(req.body);
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const actualizarItem = async (id, camposNuevos) => {
  const { rows } = await pool.query('SELECT * FROM items WHERE id = $1', [id]);
  if (rows.length === 0) {
    throw new Error('Item no encontrado');
  }

  const datosExistentes = rows[0].datos || {};
  const datosFusionados = { ...datosExistentes, ...camposNuevos, id: parseInt(id), _id: parseInt(id) };

  const updateQuery = `
    UPDATE items
    SET datos = $1
    WHERE id = $2
    RETURNING *;
  `;
  const result = await pool.query(updateQuery, [JSON.stringify(datosFusionados), id]);
  return formatItemResponse(result.rows[0]);
};

app.put('/api/items/:id', async (req, res) => {
  try {
    const itemActualizado = await actualizarItem(req.params.id, req.body);
    res.json(itemActualizado);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/items/:id', async (req, res) => {
  try {
    const itemActualizado = await actualizarItem(req.params.id, req.body);
    res.json(itemActualizado);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/items/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM items WHERE id = $1', [req.params.id]);
    res.json({ message: 'Registro eliminado correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
