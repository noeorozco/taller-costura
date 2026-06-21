"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function GastosPage() {
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [gastos, setGastos] = useState([]);

  useEffect(() => {
    cargarGastos();
  }, []);

  async function cargarGastos() {
    const { data } = await supabase
      .from("gastos")
      .select("*")
      .order("fecha", { ascending: false });

    setGastos(data || []);
  }

  async function guardarGasto() {
    if (!concepto || !monto) {
      alert("Captura concepto y monto");
      return;
    }

    const { error } = await supabase
      .from("gastos")
      .insert([
        {
          concepto,
          monto: Number(monto),
          descripcion,
        },
      ]);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Gasto guardado");

    setConcepto("");
    setMonto("");
    setDescripcion("");

    cargarGastos();
  }

  const totalGastos = gastos.reduce(
    (suma, g) => suma + Number(g.monto || 0),
    0
  );

  return (
    <main style={{ maxWidth: 900, margin: "30px auto" }}>
      <h1>Gastos</h1>

      <input
        placeholder="Concepto"
        value={concepto}
        onChange={(e) => setConcepto(e.target.value)}
      />

      <br /><br />

      <input
        type="number"
        placeholder="Monto"
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

      <button onClick={guardarGasto}>
        Guardar gasto
      </button>

      <hr />

      <h2>Total gastos: ${totalGastos}</h2>

      {gastos.map((g) => (
        <div
          key={g.id}
          style={{
            border: "1px solid #ccc",
            padding: 10,
            marginBottom: 10,
            borderRadius: 8,
          }}
        >
          <p><strong>Concepto:</strong> {g.concepto}</p>
          <p><strong>Monto:</strong> ${g.monto}</p>
          <p><strong>Descripción:</strong> {g.descripcion}</p>
        </div>
      ))}
    </main>
  );
}