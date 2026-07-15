"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function BuscarBultoPage() {
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState([]);
  const [mensaje, setMensaje] = useState("");

  async function buscarBulto() {
    if (!busqueda.trim()) {
      alert("Escribe el bulto a buscar");
      return;
    }

    setMensaje("");
    setResultados([]);

    const texto = busqueda.trim().toUpperCase();

    const { data, error } = await supabase
      .from("orden_bultos_v2")
      .select(`
        *,
        ordenes(
          folio,
          cliente,
          estado,
          cantidad_total,
          modelos(codigo,nombre)
        )
      `)
      .ilike("nombre_bulto", texto);

    if (error) return alert(error.message);

    if (!data || data.length === 0) {
      setMensaje("No encontré ese bulto.");
      return;
    }

    const completos = [];

    for (const b of data) {
      const { data: movimientos } = await supabase
        .from("movimientos_bulto")
        .select(`
          *,
          empleados(nombre,alias),
          modelo_procesos(nombre,costo)
        `)
        .eq("orden_bulto_id", b.id)
        .order("created_at", { ascending: true });

      const { data: asignacionActual } = await supabase
        .from("asignaciones")
        .select(`
          *,
          empleados(nombre,alias),
          modelo_procesos(nombre)
        `)
        .eq("orden_bulto_id", b.id)
        .eq("estado", "Asignado")
        .maybeSingle();

      completos.push({
        bulto: b,
        movimientos: movimientos || [],
        asignacionActual,
      });
    }

    setResultados(completos);
  }

  return (
    <div>
      <h1>🔎 Buscar bulto</h1>

      <section style={card}>
        <h2>Buscar por nombre de bulto</h2>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            placeholder="Ejemplo: CH1, M3, G12"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter") buscarBulto();
            }}
            style={{ ...input, flex: 1 }}
          />

          <button onClick={buscarBulto} style={boton}>
            Buscar
          </button>
        </div>

        {mensaje && <p>{mensaje}</p>}
      </section>

      {resultados.map((r) => (
        <section key={r.bulto.id} style={card}>
          <h2>
            📦 {r.bulto.nombre_bulto} — {r.bulto.cantidad} piezas
          </h2>

          <p>
            <strong>Orden:</strong> {r.bulto.ordenes?.folio}
          </p>

          <p>
            <strong>Modelo:</strong>{" "}
            {r.bulto.ordenes?.modelos?.codigo} —{" "}
            {r.bulto.ordenes?.modelos?.nombre}
          </p>

          <p>
            <strong>Cliente:</strong> {r.bulto.ordenes?.cliente || "Sin cliente"}
          </p>

          <p>
            <strong>Estado orden:</strong> {r.bulto.ordenes?.estado}
          </p>

          {r.asignacionActual ? (
            <div style={asignadoBox}>
              <strong>Estado actual:</strong> Asignado a{" "}
              {r.asignacionActual.empleados?.alias ||
                r.asignacionActual.empleados?.nombre}{" "}
              en proceso{" "}
              <strong>{r.asignacionActual.modelo_procesos?.nombre}</strong>
            </div>
          ) : (
            <div style={libreBox}>
              <strong>Estado actual:</strong> Disponible / Sin asignar
            </div>
          )}

          <h3>Historial del bulto</h3>

          {r.movimientos.length === 0 && (
            <p>Este bulto todavía no tiene movimientos.</p>
          )}

          {r.movimientos.map((m) => (
            <div key={m.id} style={movimiento}>
              <strong>{m.tipo}</strong>
              <br />
              Proceso: {m.modelo_procesos?.nombre || "Sin proceso"}
              <br />
              Trabajador:{" "}
              {m.empleados?.alias || m.empleados?.nombre || "Sin trabajador"}
              <br />
              Fecha: {new Date(m.created_at).toLocaleString("es-MX")}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

const card = {
  background: "white",
  padding: 20,
  borderRadius: 12,
  marginBottom: 20,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
};

const input = {
  padding: 10,
  borderRadius: 8,
  border: "1px solid #ccc",
  boxSizing: "border-box",
};

const boton = {
  padding: "10px 18px",
  background: "#16a34a",
  color: "white",
  border: "none",
  borderRadius: 8,
  fontWeight: "bold",
  cursor: "pointer",
};

const movimiento = {
  padding: 12,
  borderLeft: "4px solid #16a34a",
  background: "#f9fafb",
  marginBottom: 10,
  borderRadius: 8,
};

const asignadoBox = {
  background: "#dbeafe",
  padding: 12,
  borderRadius: 8,
  marginBottom: 15,
};

const libreBox = {
  background: "#dcfce7",
  padding: 12,
  borderRadius: 8,
  marginBottom: 15,
};