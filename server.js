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
    console.log('Base de datos inicializada correctamente.');
  } catch (err) {
    console.error('Error al inicializar la base de datos:', err);
  }
};

initDb();

// Dar formato a los items garantizando los campos e id numérico
const formatItemResponse = (row) => {
  if (!row) return null;
  const datos = row.datos || {};
  return {
    ...datos,
    id: row.id
  };
};

// --- RUTAS API ---

// Obtener todos los items
app.get('/api/items', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM items ORDER BY id ASC');
    const items = rows.map(formatItemResponse);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Guardar nuevo item manual
const guardarNuevoItem = async (body) => {
  const insertQuery = `
    INSERT INTO items (datos)
    VALUES ($1)
    RETURNING *;
  `;
  const { rows } = await pool.query(insertQuery, [JSON.stringify(body)]);
  const nuevoId = rows[0].id;
  
  const datosCompletos = { ...body, id: nuevoId };
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

// RUTA CLAVE: Actualización individual de etapas/campos ({ campo, valor })
app.put('/api/items/:id/etapa', async (req, res) => {
  try {
    const id = req.params.id;
    const { campo, valor } = req.body;

    const { rows } = await pool.query('SELECT * FROM items WHERE id = $1', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Item no encontrado' });
    }

    const datosExistentes = rows[0].datos || {};
    datosExistentes[campo] = valor;

    // Generar fechas automáticas si es un checkbox
    const fechaHoy = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
    if (campo === 'pedido_mat_check') datosExistentes.fecha_pedido_mat = valor == 1 ? fechaHoy : '';
    if (campo === 'llegada_mat_check') datosExistentes.fecha_llegada_mat = valor == 1 ? fechaHoy : '';
    if (campo === 'envio_fab_check') datosExistentes.fecha_envio_fab = valor == 1 ? fechaHoy : '';
    if (campo === 'fin_fab_check') datosExistentes.fecha_fin_fab = valor == 1 ? fechaHoy : '';
    if (campo === 'envio_trat_check') datosExistentes.fecha_envio_trat = valor == 1 ? fechaHoy : '';
    if (campo === 'retorno_trat_check') datosExistentes.fecha_retorno_trat = valor == 1 ? fechaHoy : '';
    if (campo === 'finalizado_check') datosExistentes.fecha_finalizado = valor == 1 ? fechaHoy : '';

    const updateQuery = `
      UPDATE items
      SET datos = $1
      WHERE id = $2
      RETURNING *;
    `;
    const result = await pool.query(updateQuery, [JSON.stringify(datosExistentes), id]);
    res.json(formatItemResponse(result.rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rutas genéricas PUT / PATCH
const actualizarItemGenerico = async (id, camposNuevos) => {
  const { rows } = await pool.query('SELECT * FROM items WHERE id = $1', [id]);
  if (rows.length === 0) throw new Error('Item no encontrado');

  const datosExistentes = rows[0].datos || {};
  const datosFusionados = { ...datosExistentes, ...camposNuevos, id: parseInt(id) };

  const result = await pool.query('UPDATE items SET datos = $1 WHERE id = $2 RETURNING *;', [JSON.stringify(datosFusionados), id]);
  return formatItemResponse(result.rows[0]);
};

app.put('/api/items/:id', async (req, res) => {
  try {
    const itemActualizado = await actualizarItemGenerico(req.params.id, req.body);
    res.json(itemActualizado);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rutas para Eliminar con Respaldo
app.delete('/api/items/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM items WHERE id = $1', [req.params.id]);
    res.json({ message: 'Pieza eliminada correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/items/eliminar/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM items WHERE id = $1', [req.params.id]);
    res.json({ message: 'Pieza eliminada correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor iniciado en puerto ${PORT}`);
});
