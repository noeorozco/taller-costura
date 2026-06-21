"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function EstadoBultosPage() {
  const [ordenes, setOrdenes] = useState([]);
  const [ordenId, setOrdenId] = useState("");
  const [bultos, setBultos] = useState([]);
  const [procesos, setProcesos] = useState([]);
  const [avanceBultos, setAvanceBultos] = useState([]);

  useEffect(() => {
    cargarOrdenes();
  }, []);

  async function cargarOrdenes() {
    const { data } = await supabase
      .from("ordenes_produccion")
      .select("id, modelo_id, modelos(id, codigo, nombre)")
      .order("id", { ascending: false });

    setOrdenes(data || []);
  }

  async function cargarEstado(idOrden) {
    setOrdenId(idOrden);

    const orden = ordenes.find((o) => String(o.id) === String(idOrden));
    if (!orden) return;

    const modeloId = orden.modelo_id || orden.modelos?.id;

    const { data: proc } = await supabase
      .from("modelo_procesos")
      .select("*")
      .eq("modelo_id", Number(modeloId))
      .order("orden", { ascending: true });

    const { data: bul } = await supabase
      .from("orden_bultos")
      .select("*")
      .eq("orden_id", Number(idOrden))
      .order("id", { ascending: true });

    const { data: av } = await supabase
      .from("avance_bultos")
      .select("*")
      .eq("orden_id", Number(idOrden));

    setProcesos(proc || []);
    setBultos(bul || []);
    setAvanceBultos(av || []);
  }

  function estaHecho(bultoId, procesoId) {
    return avanceBultos.some(
      (a) =>
        Number(a.orden_bulto_id) === Number(bultoId) &&
        Number(a.modelo_proceso_id) === Number(procesoId)
    );
  }

  return (
    <main style={{ maxWidth: 1200, margin: "30px auto" }}>
      <h1>Estado de bultos</h1>

      <select value={ordenId} onChange={(e) => cargarEstado(e.target.value)}>
        <option value="">Seleccione orden</option>
        {ordenes.map((o) => (
          <option key={o.id} value={o.id}>
            Orden #{o.id} - {o.modelos?.codigo} - {o.modelos?.nombre}
          </option>
        ))}
      </select>

      <br /><br />

      <table border="1" cellPadding="8">
        <thead>
          <tr>
            <th>Bulto</th>
            <th>Talla</th>
            <th>Cantidad</th>
            {procesos.map((p) => (
              <th key={p.id}>{p.nombre}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {bultos.map((b) => (
            <tr key={b.id}>
              <td>{b.nombre_bulto}</td>
              <td>{b.talla}</td>
              <td>{b.cantidad}</td>
              {procesos.map((p) => (
                <td key={p.id}>
                  {estaHecho(b.id, p.id) ? "✅" : "❌"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}