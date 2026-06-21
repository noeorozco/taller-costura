"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function IngresosPage() {
  const [ordenes, setOrdenes] = useState([]);
  const [ordenId, setOrdenId] = useState("");
  const [cliente, setCliente] = useState("");
  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [ingresos, setIngresos] = useState([]);

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    const { data: ord } = await supabase
      .from("ordenes_produccion")
      .select("id, modelos(id, codigo, nombre)")
      .order("id", { ascending: false });

    const { data: ing } = await supabase
      .from("ingresos")
      .select("*")
      .order("fecha", { ascending: false });

    setOrdenes(ord || []);
    setIngresos(ing || []);
  }

  async function guardarIngreso() {
    if (!cliente || !ordenId || !monto) {
      alert("Completa cliente, orden y monto");
      return;
    }

    const { error } = await supabase.from("ingresos").insert([
      {
        cliente,
        orden_id: Number(ordenId),
        monto: Number(monto),
        descripcion,
      },
    ]);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Ingreso guardado");
    setCliente("");
    setOrdenId("");
    setMonto("");
    setDescripcion("");
    cargarDatos();
  }

  const totalIngresos = ingresos.reduce(
    (suma, i) => suma + Number(i.monto || 0),
    0
  );

  return (
    <main style={{ maxWidth: 900, margin: "30px auto" }}>
      <h1>Ingresos</h1>

      <input
        placeholder="Cliente"
        value={cliente}
        onChange={(e) => setCliente(e.target.value)}
      />

      <br /><br />

      <select value={ordenId} onChange={(e) => setOrdenId(e.target.value)}>
        <option value="">Seleccione orden</option>
        {ordenes.map((o) => (
          <option key={o.id} value={o.id}>
            Orden #{o.id} - {o.modelos?.codigo} - {o.modelos?.nombre}
          </option>
        ))}
      </select>

      <br /><br />

      <input
        type="number"
        placeholder="Monto cobrado"
        value={monto}
        onChange={(e) => setMonto(e.target.value)}
      />

      <br /><br />

      <textarea
        placeholder="Descripción"
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
        style={{ width: "100%", minHeight: 80 }}
      />

      <br /><br />

      <button onClick={guardarIngreso}>Guardar ingreso</button>

      <hr />

      <h2>Total ingresos: ${totalIngresos}</h2>

      {ingresos.map((i) => (
        <div key={i.id} style={{ border: "1px solid #ccc", padding: 10, marginBottom: 10 }}>
          <p><strong>Fecha:</strong> {new Date(i.fecha).toLocaleString()}</p>
          <p><strong>Cliente:</strong> {i.cliente}</p>
          <p><strong>Orden:</strong> #{i.orden_id}</p>
          <p><strong>Monto:</strong> ${i.monto}</p>
          <p><strong>Descripción:</strong> {i.descripcion}</p>
        </div>
      ))}
    </main>
  );
}