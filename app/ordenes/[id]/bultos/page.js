"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function BultosPage() {
  const { id } = useParams();

  const [textoBultos, setTextoBultos] = useState(
  "CH1=20\nCH2=25\nCH3=25\nM1=6\nM2=15\nG1=28\nG2=5"
);

  async function guardarBultos() {
    if (!textoBultos.trim()) {
      alert("Pega los bultos");
      return;
    }

    const lineas = textoBultos
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const registros = [];

    for (const linea of lineas) {
      const partes = linea.split("=");

      if (partes.length !== 2) continue;

      const nombre_bulto = partes[0].trim().toUpperCase();
      const cantidad = Number(partes[1].trim());

      let talla = "";

      if (nombre_bulto.startsWith("CH")) talla = "CH";
      else if (nombre_bulto.startsWith("M")) talla = "M";
      else if (nombre_bulto.startsWith("G")) talla = "G";

      registros.push({
        orden_id: Number(id),
        talla,
        nombre_bulto,
        cantidad,
      });
    }

    if (registros.length === 0) {
      alert("No se encontraron bultos válidos");
      return;
    }

    const { error } = await supabase.from("orden_bultos").insert(registros);

    if (error) {
      alert(error.message);
      return;
    }

    alert(`${registros.length} bultos guardados correctamente`);
    setTextoBultos("");
  }

  return (
    <main style={{ maxWidth: 700, margin: "30px auto" }}>
      <h1>Captura masiva de bultos</h1>

      <p>Ejemplo:</p>

      <pre>{`CH1=20
CH2=25
CH3=25
M1=6
M2=15
G1=28
G2=5`}</pre>

 <textarea
  rows={20}
  style={{
    width: "100%",
    minHeight: "300px",
    border: "2px solid black",
    padding: "10px",
    fontSize: "16px"
  }}
  value={textoBultos}
  onChange={(e) => setTextoBultos(e.target.value)}
></textarea>

      <br />
      <br />

      <button onClick={guardarBultos}>Guardar todos los bultos</button>
    </main>
  );
}