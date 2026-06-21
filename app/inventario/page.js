"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function InventarioPage() {
  const [producto, setProducto] = useState("");
  const [tipo, setTipo] = useState("");
  const [unidad, setUnidad] = useState("");
  const [existencia, setExistencia] = useState("");
  const [minimo, setMinimo] = useState("");
  const [inventario, setInventario] = useState([]);

  useEffect(() => {
    cargarInventario();
  }, []);

  async function cargarInventario() {
    const { data } = await supabase
      .from("inventario")
      .select("*")
      .order("id", { ascending: false });

    setInventario(data || []);
  }

  async function guardarProducto() {
    if (!producto || !tipo || !unidad) {
      alert("Completa producto, tipo y unidad");
      return;
    }

    const { error } = await supabase.from("inventario").insert([
      {
        producto,
        tipo,
        unidad,
        existencia: Number(existencia || 0),
        minimo: Number(minimo || 0),
      },
    ]);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Producto guardado");

    setProducto("");
    setTipo("");
    setUnidad("");
    setExistencia("");
    setMinimo("");

    cargarInventario();
  }

  return (
    <main style={{ maxWidth: 1000, margin: "30px auto" }}>
      <h1>Inventario / Mercería</h1>

      <input
        placeholder="Producto, ejemplo: Hilo negro"
        value={producto}
        onChange={(e) => setProducto(e.target.value)}
      />

      <br /><br />

      <input
        placeholder="Tipo, ejemplo: Hilo, Aguja, Tela"
        value={tipo}
        onChange={(e) => setTipo(e.target.value)}
      />

      <br /><br />

      <input
        placeholder="Unidad, ejemplo: conos, piezas, metros"
        value={unidad}
        onChange={(e) => setUnidad(e.target.value)}
      />

      <br /><br />

      <input
        type="number"
        placeholder="Existencia actual"
        value={existencia}
        onChange={(e) => setExistencia(e.target.value)}
      />

      <br /><br />

      <input
        type="number"
        placeholder="Mínimo para alerta"
        value={minimo}
        onChange={(e) => setMinimo(e.target.value)}
      />

      <br /><br />

      <button onClick={guardarProducto}>Guardar producto</button>

      <hr />

      <h2>Existencias</h2>

      <table border="1" cellPadding="8">
        <thead>
          <tr>
            <th>Producto</th>
            <th>Tipo</th>
            <th>Existencia</th>
            <th>Unidad</th>
            <th>Mínimo</th>
            <th>Estado</th>
          </tr>
        </thead>

        <tbody>
          {inventario.map((i) => (
            <tr key={i.id}>
              <td>{i.producto}</td>
              <td>{i.tipo}</td>
              <td>{i.existencia}</td>
              <td>{i.unidad}</td>
              <td>{i.minimo}</td>
              <td>
                {Number(i.existencia) <= Number(i.minimo)
                  ? "⚠️ Bajo"
                  : "✅ OK"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}