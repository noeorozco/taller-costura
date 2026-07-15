"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function EntregaPage() {
  const [empleados, setEmpleados] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]);
  const [trabajosTiempo, setTrabajosTiempo] = useState([]);

  const [empleadoId, setEmpleadoId] = useState("");
  const [seleccionados, setSeleccionados] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    cargarTodo();
  }, []);

  async function cargarTodo() {
    await Promise.all([
      cargarEmpleadosConTrabajo(),
      cargarTrabajosTiempo(),
    ]);
  }

  async function cargarEmpleadosConTrabajo() {
    const { data: asignacionesData, error: errorAsignaciones } =
      await supabase
        .from("asignaciones")
        .select("empleado_id, empleados(id,nombre,alias,puesto)")
        .eq("estado", "Asignado");

    if (errorAsignaciones) {
      alert(errorAsignaciones.message);
      return;
    }

    const { data: tiempoData, error: errorTiempo } = await supabase
      .from("trabajos_tiempo")
      .select("empleado_id, empleados(id,nombre,alias,puesto)")
      .eq("estado", "Trabajando");

    if (errorTiempo) {
      alert(errorTiempo.message);
      return;
    }

    const unicos = [];
    const ids = new Set();

    [...(asignacionesData || []), ...(tiempoData || [])].forEach((registro) => {
      if (registro.empleados && !ids.has(registro.empleados.id)) {
        ids.add(registro.empleados.id);
        unicos.push(registro.empleados);
      }
    });

    unicos.sort((a, b) =>
      (a.alias || a.nombre || "").localeCompare(
        b.alias || b.nombre || ""
      )
    );

    setEmpleados(unicos);
  }

  async function cargarTrabajosTiempo(idEmpleado = empleadoId) {
    let consulta = supabase
      .from("trabajos_tiempo")
      .select(`
        *,
        empleados(id,nombre,alias,puesto,pago_hora),
        ordenes(folio,cliente,modelos(codigo,nombre)),
        modelo_procesos(nombre)
      `)
      .eq("estado", "Trabajando")
      .order("fecha_inicio", { ascending: true });

    if (idEmpleado) {
      consulta = consulta.eq("empleado_id", Number(idEmpleado));
    }

    const { data, error } = await consulta;

    if (error) {
      alert(error.message);
      return;
    }

    setTrabajosTiempo(data || []);
  }

  async function cargarAsignaciones(idEmpleado) {
    setEmpleadoId(idEmpleado);
    setSeleccionados([]);
    setAsignaciones([]);

    if (!idEmpleado) {
      await cargarTrabajosTiempo("");
      return;
    }

    const { data, error } = await supabase
      .from("asignaciones")
      .select(`
        *,
        empleados(nombre,alias),
        modelo_procesos(nombre,costo),
        orden_bultos_v2(id,nombre_bulto,talla,cantidad),
        ordenes(folio,cliente,modelos(codigo,nombre))
      `)
      .eq("empleado_id", Number(idEmpleado))
      .eq("estado", "Asignado")
      .order("id");

    if (error) {
      alert(error.message);
      return;
    }

    setAsignaciones(ordenarAsignaciones(data || []));
    await cargarTrabajosTiempo(idEmpleado);
  }

  function obtenerNumeroBulto(nombre = "") {
    const match = nombre.match(/\d+/);
    return match ? Number(match[0]) : 0;
  }

  function ordenarAsignaciones(lista) {
    return [...lista].sort((a, b) => {
      const tallaA = a.orden_bultos_v2?.talla || "";
      const tallaB = b.orden_bultos_v2?.talla || "";

      if (tallaA !== tallaB) {
        return tallaA.localeCompare(tallaB);
      }

      const numA = obtenerNumeroBulto(
        a.orden_bultos_v2?.nombre_bulto
      );

      const numB = obtenerNumeroBulto(
        b.orden_bultos_v2?.nombre_bulto
      );

      return numA - numB;
    });
  }

  function agruparPorTalla() {
    const grupos = {};

    asignaciones.forEach((a) => {
      const talla = a.orden_bultos_v2?.talla || "Sin talla";

      if (!grupos[talla]) {
        grupos[talla] = [];
      }

      grupos[talla].push(a);
    });

    return grupos;
  }

  function mostrarMensaje(texto) {
    setMensaje(texto);

    setTimeout(() => {
      setMensaje("");
    }, 3000);
  }

  function cambiarSeleccion(id) {
    setSeleccionados((actual) =>
      actual.includes(id)
        ? actual.filter((x) => x !== id)
        : [...actual, id]
    );
  }

  function seleccionarTodo() {
    const todosSeleccionados =
      asignaciones.length > 0 &&
      asignaciones.every((a) => seleccionados.includes(a.id));

    if (todosSeleccionados) {
      setSeleccionados([]);
    } else {
      setSeleccionados(asignaciones.map((a) => a.id));
    }
  }

  function quitarSeleccion() {
    setSeleccionados([]);
  }

  function seleccionarTalla(talla) {
    const idsTalla = asignaciones
      .filter(
        (a) =>
          (a.orden_bultos_v2?.talla || "Sin talla") === talla
      )
      .map((a) => a.id);

    const todosSeleccionados =
      idsTalla.length > 0 &&
      idsTalla.every((id) => seleccionados.includes(id));

    if (todosSeleccionados) {
      setSeleccionados((actual) =>
        actual.filter((id) => !idsTalla.includes(id))
      );
    } else {
      setSeleccionados((actual) => [
        ...new Set([...actual, ...idsTalla]),
      ]);
    }
  }

  async function registrarEntrega() {
    if (seleccionados.length === 0) {
      alert("Selecciona los bultos entregados");
      return;
    }

    const confirmar = confirm(
      `Vas a registrar ${seleccionados.length} bultos como entregados.\n\nSolamente estos bultos se incluirán en la nómina de la semana.\n\n¿Continuar?`
    );

    if (!confirmar) return;

    setProcesando(true);

    try {
      const fechaEntrega = new Date().toISOString();

      const entregadas = asignaciones.filter((a) =>
        seleccionados.includes(a.id)
      );

      for (const a of entregadas) {
        const { error } = await supabase
          .from("asignaciones")
          .update({
            estado: "Terminado",
            fecha_terminado: fechaEntrega,
          })
          .eq("id", a.id);

        if (error) throw error;

        const { error: errorMovimiento } = await supabase
          .from("movimientos_bulto")
          .insert([
            {
              orden_id: a.orden_id,
              orden_bulto_id: a.orden_bulto_id,
              proceso_id: a.proceso_id,
              empleado_id: a.empleado_id,
              tipo: "Terminado",
            },
          ]);

        if (errorMovimiento) throw errorMovimiento;
      }

      mostrarMensaje(
        `${entregadas.length} bultos registrados correctamente`
      );

      setSeleccionados([]);

      await cargarAsignaciones(empleadoId);
      await cargarEmpleadosConTrabajo();
    } catch (error) {
      alert(error.message || "No se pudo registrar la entrega");
    } finally {
      setProcesando(false);
    }
  }

  function calcularMinutos(fechaInicio, fechaFin = new Date()) {
    const inicio = new Date(fechaInicio).getTime();
    const fin = new Date(fechaFin).getTime();

    return Math.max(1, Math.round((fin - inicio) / 60000));
  }

  function calcularPagoTiempo(trabajo, fechaFin = new Date()) {
    const minutos = calcularMinutos(trabajo.fecha_inicio, fechaFin);
    const tarifa = Number(trabajo.tarifa_hora || 0);

    return (minutos / 60) * tarifa;
  }

  function formatearDuracion(minutos) {
    const horas = Math.floor(minutos / 60);
    const restantes = minutos % 60;

    if (horas === 0) {
      return `${restantes} min`;
    }

    return `${horas} h ${restantes} min`;
  }

  function formatearFecha(fecha) {
    if (!fecha) return "";

    return new Date(fecha).toLocaleString("es-MX", {
      dateStyle: "short",
      timeStyle: "short",
    });
  }

  async function finalizarTrabajoTiempo(trabajo) {
    const fechaFin = new Date();
    const minutos = calcularMinutos(trabajo.fecha_inicio, fechaFin);
    const totalPago = calcularPagoTiempo(trabajo, fechaFin);

    const confirmar = confirm(
      `Finalizar trabajo por hora de ${
        trabajo.empleados?.alias || trabajo.empleados?.nombre
      }?\n\n` +
        `Actividad: ${trabajo.descripcion}\n` +
        `Tiempo: ${formatearDuracion(minutos)}\n` +
        `Tarifa: $${Number(trabajo.tarifa_hora || 0).toFixed(2)} por hora\n` +
        `Total: $${totalPago.toFixed(2)}\n\n` +
        `Este pago se incluirá en la nómina de la semana actual.`
    );

    if (!confirmar) return;

    setProcesando(true);

    try {
      const { error } = await supabase
        .from("trabajos_tiempo")
        .update({
          fecha_fin: fechaFin.toISOString(),
          minutos_trabajados: minutos,
          total_pago: Number(totalPago.toFixed(2)),
          estado: "Terminado",
        })
        .eq("id", trabajo.id)
        .eq("estado", "Trabajando");

      if (error) throw error;

      mostrarMensaje(
        `Trabajo finalizado. Pago generado: $${totalPago.toFixed(2)}`
      );

      await cargarTrabajosTiempo(empleadoId);
      await cargarEmpleadosConTrabajo();

      if (empleadoId) {
        await cargarAsignaciones(empleadoId);
      }
    } catch (error) {
      alert(error.message || "No se pudo finalizar el trabajo");
    } finally {
      setProcesando(false);
    }
  }

  const grupos = agruparPorTalla();

  const empleadoSeleccionado = empleados.find(
    (e) => Number(e.id) === Number(empleadoId)
  );

  return (
    <div>
      <h1>✅ Entrega de trabajo</h1>

      {mensaje && <div style={alerta}>{mensaje}</div>}

      <section style={card}>
        <h2>Seleccionar trabajador</h2>

        <select
          value={empleadoId}
          onChange={(e) => cargarAsignaciones(e.target.value)}
          style={input}
        >
          <option value="">Selecciona trabajador</option>

          {empleados.map((e) => (
            <option key={e.id} value={e.id}>
              {e.alias || e.nombre} - {e.puesto}
            </option>
          ))}
        </select>

        {empleadoSeleccionado && (
          <div style={resumenTrabajador}>
            <strong>
              {empleadoSeleccionado.alias ||
                empleadoSeleccionado.nombre}
            </strong>

            <br />
            Puesto: {empleadoSeleccionado.puesto}
            <br />
            Bultos asignados: {asignaciones.length}
            <br />
            Trabajos por hora activos: {trabajosTiempo.length}
          </div>
        )}
      </section>

      {empleadoId && trabajosTiempo.length > 0 && (
        <section style={card}>
          <h2>⏱ Trabajo por hora activo</h2>

          {trabajosTiempo.map((trabajo) => {
            const minutos = calcularMinutos(trabajo.fecha_inicio);
            const pagoEstimado = calcularPagoTiempo(trabajo);

            return (
              <div key={trabajo.id} style={trabajoTiempoCard}>
                <div>
                  <strong style={{ fontSize: 19 }}>
                    {trabajo.empleados?.alias ||
                      trabajo.empleados?.nombre}
                  </strong>

                  <p style={{ margin: "8px 0" }}>
                    {trabajo.descripcion}
                  </p>

                  {trabajo.ordenes?.folio && (
                    <small style={{ display: "block" }}>
                      Orden: {trabajo.ordenes.folio}
                    </small>
                  )}

                  {trabajo.ordenes?.modelos?.codigo && (
                    <small style={{ display: "block" }}>
                      Modelo: {trabajo.ordenes.modelos.codigo}
                    </small>
                  )}

                  {trabajo.modelo_procesos?.nombre && (
                    <small style={{ display: "block" }}>
                      Proceso: {trabajo.modelo_procesos.nombre}
                    </small>
                  )}

                  <small style={{ display: "block", marginTop: 8 }}>
                    Inicio: {formatearFecha(trabajo.fecha_inicio)}
                  </small>
                </div>

                <div style={resumenTiempo}>
                  <div>
                    <small>Tiempo aproximado</small>
                    <strong>{formatearDuracion(minutos)}</strong>
                  </div>

                  <div>
                    <small>Tarifa por hora</small>
                    <strong>
                      ${Number(trabajo.tarifa_hora || 0).toFixed(2)}
                    </strong>
                  </div>

                  <div>
                    <small>Pago aproximado</small>
                    <strong>${pagoEstimado.toFixed(2)}</strong>
                  </div>

                  <button
                    onClick={() => finalizarTrabajoTiempo(trabajo)}
                    style={{
                      ...botonRojo,
                      opacity: procesando ? 0.7 : 1,
                    }}
                    disabled={procesando}
                  >
                    ⏹ Finalizar y generar pago
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {empleadoId && (
        <>
          <div style={barraFija}>
            <strong>Asignados: {asignaciones.length}</strong>
            <strong>Seleccionados: {seleccionados.length}</strong>

            <button
              onClick={seleccionarTodo}
              style={botonAzul}
              disabled={asignaciones.length === 0}
            >
              {seleccionados.length === asignaciones.length &&
              asignaciones.length > 0
                ? "Quitar todo"
                : "Todo"}
            </button>

            <button
              onClick={quitarSeleccion}
              style={botonGris}
            >
              Quitar selección
            </button>

            <button
              onClick={registrarEntrega}
              style={{
                ...botonVerdeCompacto,
                opacity:
                  procesando || seleccionados.length === 0 ? 0.6 : 1,
              }}
              disabled={procesando || seleccionados.length === 0}
            >
              {procesando
                ? "Registrando..."
                : "Registrar entrega"}
            </button>
          </div>

          <section style={card}>
            <h2>🧵 Bultos asignados</h2>

            {asignaciones.length === 0 && (
              <p>Este trabajador no tiene bultos asignados.</p>
            )}

            {Object.keys(grupos).map((talla) => {
              const idsTalla = grupos[talla].map((a) => a.id);

              const todosSeleccionados =
                idsTalla.length > 0 &&
                idsTalla.every((id) =>
                  seleccionados.includes(id)
                );

              return (
                <div key={talla} style={grupoTalla}>
                  <div style={encabezadoTalla}>
                    <h3 style={{ margin: 0 }}>Talla {talla}</h3>

                    <button
                      onClick={() => seleccionarTalla(talla)}
                      style={botonGris}
                    >
                      {todosSeleccionados
                        ? `Quitar ${talla}`
                        : `Todo ${talla}`}
                    </button>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 10,
                    }}
                  >
                    {grupos[talla].map((a) => {
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
                            background: activo
                              ? "#16a34a"
                              : "#f3f4f6",
                            color: activo ? "white" : "black",
                            fontWeight: "bold",
                            minWidth: 150,
                            textAlign: "left",
                          }}
                        >
                          {activo ? "✔ " : ""}
                          {a.orden_bultos_v2?.nombre_bulto}

                          <br />

                          {a.orden_bultos_v2?.cantidad} piezas

                          <br />

                          <small>Proceso</small>

                          <br />

                          <small>
                            {a.modelo_procesos?.nombre}
                          </small>

                          <br />

                          <small>Orden</small>

                          <br />

                          <small>{a.ordenes?.folio}</small>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </section>
        </>
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
  boxSizing: "border-box",
};

const alerta = {
  background: "#dcfce7",
  color: "#166534",
  padding: 12,
  borderRadius: 10,
  marginBottom: 15,
  fontWeight: "bold",
};

const resumenTrabajador = {
  background: "#f3f4f6",
  padding: 12,
  borderRadius: 10,
  marginTop: 10,
};

const trabajoTiempoCard = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 360px)",
  gap: 20,
  padding: 18,
  border: "1px solid #bfdbfe",
  borderRadius: 12,
  background: "#eff6ff",
};

const resumenTiempo = {
  display: "grid",
  gap: 10,
  background: "white",
  padding: 15,
  borderRadius: 10,
};

const barraFija = {
  position: "sticky",
  top: 0,
  zIndex: 20,
  background: "white",
  padding: 12,
  marginBottom: 15,
  borderRadius: 12,
  boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
};

const grupoTalla = {
  marginBottom: 25,
  paddingBottom: 20,
  borderBottom: "1px solid #e5e7eb",
};

const encabezadoTalla = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  marginBottom: 12,
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

const botonVerdeCompacto = {
  padding: "10px 14px",
  background: "#16a34a",
  color: "white",
  border: "none",
  borderRadius: 8,
  fontWeight: "bold",
  cursor: "pointer",
};

const botonRojo = {
  padding: "12px 16px",
  background: "#dc2626",
  color: "white",
  border: "none",
  borderRadius: 8,
  fontWeight: "bold",
  cursor: "pointer",
  marginTop: 5,
};