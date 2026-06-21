"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function OrdenesPage() {
  const [modelos, setModelos] = useState([]);
  const [modeloId, setModeloId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [notas, setNotas] = useState("");
  const [ordenes, setOrdenes] = useState([]);

  useEffect(() => {
    cargarModelos();
    cargarOrdenes();
  }, []);

  async function cargarModelos() {
    const { data, error } = await supabase
      .from("modelos")
      .select("id, codigo, nombre")
      .order("id", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setModelos(data || []);
  }

  async function cargarOrdenes() {
    const { data, error } = await supabase
      .from("ordenes_produccion")
      .select("id, cantidad, estado, notas, modelos(codigo, nombre)")
      .order("id", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setOrdenes(data || []);
  }
async function guardarOrden() {
  if (!modeloId || !cantidad) {
    alert("Selecciona modelo y cantidad");
    return;
  }

  const { data: ordenCreada, error: errorOrden } = await supabase
    .from("ordenes_produccion")
    .insert([
      {
        modelo_id: Number(modeloId),
        cantidad: Number(cantidad),
        notas,
      },
    ])
    .select()
    .single();

  if (errorOrden) {
    alert(errorOrden.message);
    return;
  }

  const { data: procesos, error: errorProcesos } = await supabase
    .from("modelo_procesos")
    .select("id, nombre, orden, notas")
   .eq("modelo_id", Number(modeloId)) 
    .order("orden", { ascending: true });

  if (errorProcesos) {
    alert(errorProcesos.message);
    return;
  }

  const procesosOrden = procesos.map((proceso) => ({
    orden_id: ordenCreada.id,
    modelo_proceso_id: proceso.id,
    nombre: proceso.nombre,
    orden: proceso.orden,
    cantidad_total: Number(cantidad),
    cantidad_terminada: 0,
    estado: "pendiente",
    notas: proceso.notas,
  }));

  const { error: errorGuardarProcesos } = await supabase
    .from("orden_procesos")
    .insert(procesosOrden);

console.log("procesosOrden", procesosOrden);
console.log("errorGuardarProcesos", errorGuardarProcesos);

  if (errorGuardarProcesos) {
    alert(errorGuardarProcesos.message);
    return;
  }

  alert("Orden guardada con procesos");
  setModeloId("");
  setCantidad("");
  setNotas("");
  cargarOrdenes();
}

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-bold mb-6">Órdenes de Producción</h1>

      <section className="bg-white p-4 rounded-xl shadow mb-6">
        <h2 className="text-xl font-bold mb-4">Crear orden</h2>

        <select
          className="border p-2 rounded w-full mb-3"
          value={modeloId}
          onChange={(e) => setModeloId(e.target.value)}
        >
          <option value="">Seleccione un modelo</option>
          {modelos.map((modelo) => (
            <option key={modelo.id} value={modelo.id}>
              {modelo.codigo} - {modelo.nombre}
            </option>
          ))}
        </select>

        <input
          className="border p-2 rounded w-full mb-3"
          placeholder="Cantidad de piezas"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
        />

        <textarea
          className="border p-2 rounded w-full mb-3"
          placeholder="Notas del corte"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
        />

        <button
          onClick={guardarOrden}
          className="bg-black text-white px-4 py-2 rounded"
        >
          Guardar orden
        </button>
      </section>

      <section className="grid gap-4">
        {ordenes.map((orden) => (
          <div key={orden.id} className="bg-white p-4 rounded-xl shadow">
            <h2 className="text-xl font-bold">Orden #{orden.id}</h2>
            <p>
              {orden.modelos?.codigo} - {orden.modelos?.nombre}
            </p>
            <p>Cantidad: {orden.cantidad}</p>
            <p>Estado: {orden.estado}</p>
            <p className="text-gray-500">{orden.notas}</p>
          </div>
        ))}
      </section>
    </main>
  );
}