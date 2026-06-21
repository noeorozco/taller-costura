"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ProcesosPage() {
  const [modelos, setModelos] = useState([]);
  const [modeloId, setModeloId] = useState("");
  const [nombre, setNombre] = useState("");
  const [orden, setOrden] = useState("");
  const [costo, setCosto] = useState("");
  const [notas, setNotas] = useState("");

  useEffect(() => {
    cargarModelos();
  }, []);

 async function cargarModelos() {
  const { data, error } = await supabase
    .from("modelos")
    .select("id, codigo, nombre")
    .order("id", { ascending: true });

  if (error) {
    alert("Error cargando modelos: " + error.message);
    return;
  }

  setModelos(data || []);
} 

  async function guardarProceso() {
    const { error } = await supabase
      .from("modelo_procesos")
      .insert([
        {
          modelo_id: modeloId,
          nombre,
          orden,
          costo,
          notas,
        },
      ]);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Proceso guardado");

    setNombre("");
    setOrden("");
    setCosto("");
    setNotas("");
  }

  return (
    <div style={{ maxWidth: 700, margin: "30px auto" }}>
      <h1>Procesos de Producción</h1>

      <select
        value={modeloId}
        onChange={(e) => setModeloId(e.target.value)}
        style={{ width: "100%", padding: 10, marginBottom: 10 }}
      >
        <option value="">Seleccione un modelo</option>

        {modelos.map((modelo) => (
          <option key={modelo.id} value={modelo.id}>
            {modelo.codigo} - {modelo.nombre}
          </option>
        ))}
      </select>

      <input
        placeholder="Nombre del proceso"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
      />

      <br />
      <br />

      <input
        placeholder="Orden"
        value={orden}
        onChange={(e) => setOrden(e.target.value)}
      />

      <br />
      <br />

      <input
        placeholder="Costo"
        value={costo}
        onChange={(e) => setCosto(e.target.value)}
      />

      <br />
      <br />

      <textarea
        placeholder="Notas"
        value={notas}
        onChange={(e) => setNotas(e.target.value)}
      />

      <br />
      <br />

      <button onClick={guardarProceso}>
        Guardar proceso
      </button>
    </div>
  );
}