"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ReasignarPage() {
  const [ordenes, setOrdenes] = useState([]);
  const [procesos, setProcesos] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]);

  const [ordenId, setOrdenId] = useState("");
  const [procesoId, setProcesoId] = useState("");
  const [origenId, setOrigenId] = useState("");
  const [destinoId, setDestinoId] = useState("");
  const [seleccionados, setSeleccionados] = useState([]);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    cargarInicial();
  }, []);

  async function cargarInicial() {
    const { data: ord } = await supabase
      .from("ordenes")
      .select("*, modelos(id,codigo,nombre)")
      .neq("estado", "Terminada")
      .order("id", { ascending: false });

    const { data: emp } = await supabase
      .from("empleados")
      .select("*")
      .eq("activo", true)
      .order("nombre");

    setOrdenes(ord || []);
    setEmpleados(emp || []);
  }

  async function cargarOrden(id) {
    setOrdenId(id);
    setProcesoId("");
    setOrigenId("");
    setDestinoId("");
    setAsignaciones([]);
    setSeleccionados([]);

    const orden = ordenes.find((o) => Number(o.id) === Number(id));
    if (!orden) return;

    const { data } = await supabase
      .from("modelo_procesos")
      .select("*")
      .eq("modelo_id", orden.modelo_id)
      .order("orden");

    setProcesos(data || []);
  }

  async function cargarAsignaciones() {
    if (!ordenId || !procesoId) return;

    setOrigenId("");
    setDestinoId("");
    setSeleccionados([]);

    const { data, error } = await supabase
      .from("asignaciones")
      .select(`
        *,
        empleados(id,nombre,alias,puesto),
        modelo_procesos(nombre),
        orden_bultos_v2(id,nombre_bulto,talla,cantidad)
      `)
      .eq("orden_id", Number(ordenId))
      .eq("proceso_id", Number(procesoId))
      .eq("estado", "Asignado");

    if (error) return alert(error.message);

    setAsignaciones(ordenarAsignaciones(data || []));
  }

  function obtenerNumeroBulto(nombre = "") {
    const match = nombre.match(/\d+/);
    return match ? Number(match[0]) : 0;
  }

  function ordenarAsignaciones(lista) {
    return [...lista].sort((a, b) => {
      const tallaA = a.orden_bultos_v2?.talla || "";
      const tallaB = b.orden_bultos_v2?.talla || "";
      if (tallaA !== tallaB) return tallaA.localeCompare(tallaB);

      return (
        obtenerNumeroBulto(a.orden_bultos_v2?.nombre_bulto) -
        obtenerNumeroBulto(b.orden_bultos_v2?.nombre_bulto)
      );
    });
  }

  const trabajadoresConAsignacion = empleados.filter((e) =>
    asignaciones.some((a) => Number(a.empleado_id) === Number(e.id))
  );

  const asignacionesOrigen = asignaciones.filter(
    (a) => Number(a.empleado_id) === Number(origenId)
  );

  const totalPiezasOrigen = asignacionesOrigen.reduce(
    (s, a) => s + Number(a.orden_bultos_v2?.cantidad || 0),
    0
  );

  const tallas = [
    ...new Set(
      asignacionesOrigen.map((a) => a.orden_bultos_v2?.talla).filter(Boolean)
    ),
  ];

  function cambiarSeleccion(id) {
    setSeleccionados((actual) =>
      actual.includes(id) ? actual.filter((x) => x !== id) : [...actual, id]
    );
  }

  function seleccionarTodoOrigen() {
    setSeleccionados(asignacionesOrigen.map((a) => a.id));
  }

  function quitarSeleccion() {
    setSeleccionados([]);
  }

  function seleccionarTalla(talla) {
    const ids = asignacionesOrigen
      .filter((a) => a.orden_bultos_v2?.talla === talla)
      .map((a) => a.id);

    const todos = ids.every((id) => seleccionados.includes(id));

    if (todos) {
      setSeleccionados((actual) => actual.filter((id) => !ids.includes(id)));
    } else {
      setSeleccionados((actual) => [...new Set([...actual, ...ids])]);
    }
  }

  function mostrarMensaje(texto) {
    setMensaje(texto);
    setTimeout(() => setMensaje(""), 2500);
  }

  async function reasignar() {
    if (!ordenId || !procesoId || !origenId || !destinoId) {
      alert("Selecciona orden, proceso, trabajador origen y trabajador destino");
      return;
    }

    if (Number(origenId) === Number(destinoId)) {
      alert("El trabajador destino debe ser diferente al origen");
      return;
    }

    if (seleccionados.length === 0) {
      alert("Selecciona los bultos a reasignar");
      return;
    }

    const origen = empleados.find((e) => Number(e.id) === Number(origenId));
    const destino = empleados.find((e) => Number(e.id) === Number(destinoId));

    const confirmar = confirm(
      `Vas a reasignar ${seleccionados.length} bultos.\n\nDe: ${
        origen?.alias || origen?.nombre
      }\nA: ${destino?.alias || destino?.nombre}\n\n¿Continuar?`
    );

    if (!confirmar) return;

    const seleccionadas = asignaciones.filter((a) =>
      seleccionados.includes(a.id)
    );

    for (const a of seleccionadas) {
      const { error } = await supabase
        .from("asignaciones")
        .update({ empleado_id: Number(destinoId) })
        .eq("id", a.id);

      if (error) return alert(error.message);

      await supabase.from("movimientos_bulto").insert([
        {
          orden_id: a.orden_id,
          orden_bulto_id: a.orden_bulto_id,
          proceso_id: a.proceso_id,
          empleado_id: Number(destinoId),
          tipo: "Reasignado",
          notas: `Reasignado de ${origen?.alias || origen?.nombre || "origen"} a ${
            destino?.alias || destino?.nombre || "destino"
          }`,
        },
      ]);
    }

    mostrarMensaje("Bultos reasignados correctamente");
    setSeleccionados([]);
    cargarAsignaciones();
  }

  return (
    <div>
      <h1>🔄 Reasignar bultos</h1>

      {mensaje && <div style={alerta}>{mensaje}</div>}

      <section style={card}>
        <h2>1. Seleccionar orden y proceso</h2>

        <select
          value={ordenId}
          onChange={(e) => cargarOrden(e.target.value)}
          style={input}
        >
          <option value="">Selecciona orden</option>
          {ordenes.map((o) => (
            <option key={o.id} value={o.id}>
              {o.folio} - {o.modelos?.codigo} - {o.cliente || "Sin cliente"}
            </option>
          ))}
        </select>

        <select
          value={procesoId}
          onChange={(e) => {
            setProcesoId(e.target.value);
            setAsignaciones([]);
            setSeleccionados([]);
          }}
          style={input}
        >
          <option value="">Selecciona proceso</option>
          {procesos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.orden}. {p.nombre}
            </option>
          ))}
        </select>

        <button onClick={cargarAsignaciones} style={boton}>
          Cargar asignaciones
        </button>
      </section>

      {asignaciones.length > 0 && (
        <section style={card}>
          <h2>2. Trabajador origen</h2>

          <select
            value={origenId}
            onChange={(e) => {
              setOrigenId(e.target.value);
              setSeleccionados([]);
            }}
            style={input}
          >
            <option value="">Selecciona quién tiene los bultos</option>
            {trabajadoresConAsignacion.map((e) => {
              const cantidad = asignaciones.filter(
                (a) => Number(a.empleado_id) === Number(e.id)
              ).length;

              return (
                <option key={e.id} value={e.id}>
                  {e.alias || e.nombre} - {cantidad} bultos
                </option>
              );
            })}
          </select>

          {origenId && (
            <div style={resumen}>
              <strong>Bultos:</strong> {asignacionesOrigen.length}
              <br />
              <strong>Piezas:</strong> {totalPiezasOrigen}
            </div>
          )}
        </section>
      )}

      {origenId && (
        <section style={card}>
          <h2>3. Seleccionar bultos</h2>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 15 }}>
            <button onClick={seleccionarTodoOrigen} style={botonAzul}>
              Reasignar todo
            </button>

            <button onClick={quitarSeleccion} style={botonGris}>
              Quitar selección
            </button>

            {tallas.map((talla) => (
              <button
                key={talla}
                onClick={() => seleccionarTalla(talla)}
                style={botonGris}
              >
                Todo {talla}
              </button>
            ))}
          </div>

          <p>
            Seleccionados: <strong>{seleccionados.length}</strong>
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {asignacionesOrigen.map((a) => {
              const activo = seleccionados.includes(a.id);

              return (
                <button
                  key={a.id}
                  onClick={() => cambiarSeleccion(a.id)}
                  style={{
                    padding: 14,
                    borderRadius: 10,
                    border: "none",
                    cursor: "pointer",
                    background: activo ? "#16a34a" : "#f3f4f6",
                    color: activo ? "white" : "black",
                    fontWeight: "bold",
                    minWidth: 120,
                    textAlign: "left",
                  }}
                >
                  {activo ? "✔ " : ""}
                  {a.orden_bultos_v2?.nombre_bulto}
                  <br />
                  {a.orden_bultos_v2?.cantidad} piezas
                </button>
              );
            })}
          </div>
        </section>
      )}

      {origenId && (
        <section style={card}>
          <h2>4. Trabajador destino</h2>

          <select
            value={destinoId}
            onChange={(e) => setDestinoId(e.target.value)}
            style={input}
          >
            <option value="">Selecciona a quién pasarle los bultos</option>
            {empleados
              .filter((e) => Number(e.id) !== Number(origenId))
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.alias || e.nombre} - {e.puesto}
                </option>
              ))}
          </select>

          <button onClick={reasignar} style={boton}>
            Reasignar bultos
          </button>
        </section>
      )}
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
  width: "100%",
  padding: 10,
  marginBottom: 10,
  borderRadius: 8,
  border: "1px solid #ccc",
};

const resumen = {
  background: "#f3f4f6",
  padding: 12,
  borderRadius: 10,
  marginTop: 10,
};

const boton = {
  padding: "12px 18px",
  background: "#16a34a",
  color: "white",
  border: "none",
  borderRadius: 8,
  fontWeight: "bold",
  cursor: "pointer",
  marginTop: 10,
};

const botonAzul = {
  padding: "10px 14px",
  background: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: 8,
  fontWeight: "bold",
  cursor: "pointer",
};

const botonGris = {
  padding: "10px 14px",
  background: "#e5e7eb",
  color: "black",
  border: "none",
  borderRadius: 8,
  fontWeight: "bold",
  cursor: "pointer",
};

const alerta = {
  background: "#dcfce7",
  color: "#166534",
  padding: 12,
  borderRadius: 10,
  marginBottom: 15,
  fontWeight: "bold",
};