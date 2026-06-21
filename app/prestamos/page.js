"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function PrestamosPage() {
  const [empleados, setEmpleados] = useState([]);
  const [empleadoId, setEmpleadoId] = useState("");
  const [monto, setMonto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [prestamos, setPrestamos] = useState([]);

  useEffect(() => {
    cargarEmpleados();
    cargarPrestamos();
  }, []);

  async function cargarEmpleados() {
    const { data } = await supabase
      .from("empleados")
      .select("*")
      .order("nombre");

    setEmpleados(data || []);
  }

  async function cargarPrestamos() {
    const { data } = await supabase
      .from("prestamos")
      .select("*")
      .order("fecha", { ascending: false });

    setPrestamos(data || []);
  }

  async function guardarPrestamo() {
    if (!empleadoId || !monto) {
      alert("Completa los datos");
      return;
    }

    const { error } = await supabase
      .from("prestamos")
      .insert([
        {
          empleado_id: Number(empleadoId),
          monto: Number(monto),
          motivo,
        },
      ]);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Préstamo guardado");

    setMonto("");
    setMotivo("");

    cargarPrestamos();
  }

  return (
    <main style={{ maxWidth: 900, margin: "30px auto" }}>
      <h1>Préstamos</h1>

      <select
        value={empleadoId}
        onChange={(e) => setEmpleadoId(e.target.value)}
      >
        <option value="">Seleccione empleado</option>

        {empleados.map((e) => (
          <option key={e.id} value={e.id}>
            {e.nombre}
          </option>
        ))}
      </select>

      <br /><br />

      <input
        type="number"
        placeholder="Monto"
        value={monto}
        onChange={(e) => setMonto(e.target.value)}
      />

      <br /><br />

      <textarea
        placeholder="Motivo"
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        style={{ width: "100%", minHeight: 80 }}
      />

      <br /><br />

      <button onClick={guardarPrestamo}>
        Guardar préstamo
      </button>

      <hr />

      <h2>Historial</h2>

      {prestamos.map((p) => (
        <div
          key={p.id}
          style={{
            border: "1px solid #ccc",
            padding: 10,
            marginBottom: 10,
          }}
        >
          <p>
            <strong>Fecha:</strong>{" "}
            {new Date(p.fecha).toLocaleString()}
          </p>

          <p>
            <strong>Monto:</strong> ${p.monto}
          </p>

          <p>
            <strong>Motivo:</strong> {p.motivo}
          </p>
        </div>
      ))}
    </main>
  );
}