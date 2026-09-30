const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Conexión a la Base de Datos SQLite
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) console.error("Error al conectar BD:", err.message);
    else console.log("Base de datos SQLite conectada correctamente.");
});

// Crear tabla completa con todas las columnas
db.run(`CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proyecto_numero TEXT,
    id_item TEXT,
    nombre_pieza TEXT,
    material TEXT,
    cantidad INTEGER,
    pedido_mat_check INTEGER DEFAULT 0,
    fecha_pedido_mat TEXT,
    llegada_mat_check INTEGER DEFAULT 0,
    fecha_llegada_mat TEXT,
    tipo_fabricacion TEXT DEFAULT 'INTERNA',
    proveedor_fab TEXT,
    envio_fab_check INTEGER DEFAULT 0,
    fecha_envio_fab TEXT,
    fin_fab_check INTEGER DEFAULT 0,
    fecha_fin_fab TEXT,
    tipo_tratamiento TEXT,
    proveedor_tratamiento TEXT,
    envio_trat_check INTEGER DEFAULT 0,
    fecha_envio_trat TEXT,
    retorno_trat_check INTEGER DEFAULT 0,
    fecha_retorno_trat TEXT,
    finalizado_check INTEGER DEFAULT 0,
    fecha_finalizado TEXT
)`);

// 1. Obtener todos los ítems
app.get('/api/items', (req, res) => {
    db.all("SELECT * FROM items ORDER BY id DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 2. Agregar ítem manual
app.post('/api/items/manual', (req, res) => {
    const { proyecto_numero, id_item, nombre_pieza, material, cantidad } = req.body;
    const sql = `INSERT INTO items (proyecto_numero, id_item, nombre_pieza, material, cantidad) VALUES (?, ?, ?, ?, ?)`;
    db.run(sql, [proyecto_numero, id_item, nombre_pieza, material, cantidad || 1], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID });
    });
});

// 3. Actualizar etapas / campos
app.put('/api/items/:id/etapa', (req, res) => {
    const { id } = req.params;
    const { campo, valor } = req.body;

    const camposPermitidos = [
        'proyecto_numero', 'pedido_mat_check', 'llegada_mat_check', 'tipo_fabricacion', 'proveedor_fab', 
        'envio_fab_check', 'fin_fab_check', 'tipo_tratamiento', 'proveedor_tratamiento', 
        'envio_trat_check', 'retorno_trat_check', 'finalizado_check',
        'nombre_pieza', 'material', 'cantidad'
    ];

    if (!camposPermitidos.includes(campo)) {
        return res.status(400).json({ error: "Campo no permitido" });
    }

    const hoy = new Date().toISOString().split('T')[0];
    let sql = `UPDATE items SET ${campo} = ? WHERE id = ?`;
    let params = [valor, id];

    if (campo.endsWith('_check') && valor == 1) {
        const campoFecha = 'fecha_' + campo.replace('_check', '');
        sql = `UPDATE items SET ${campo} = ?, ${campoFecha} = ? WHERE id = ?`;
        params = [valor, hoy, id];
    }

    db.run(sql, params, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ updated: this.changes });
    });
});

// 4. Eliminar pieza por DELETE (Método Estándar)
app.delete('/api/items/:id', (req, res) => {
    const { id } = req.params;
    db.run("DELETE FROM items WHERE id = ?", [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Eliminado con éxito", deletedID: id });
    });
});

// 5. Eliminar pieza por GET (Método de Respaldo Anti-Fallos)
app.get('/api/items/eliminar/:id', (req, res) => {
    const { id } = req.params;
    db.run("DELETE FROM items WHERE id = ?", [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Eliminado con éxito", deletedID: id });
    });
});

app.listen(PORT, () => {
    console.log(`Servidor activo en http://localhost:${PORT}`);
});