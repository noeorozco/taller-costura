"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AsignacionesPage() {
  const [ordenes, setOrdenes] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [procesos, setProcesos] = useState([]);
  const [bultos, setBultos] = useState([]);
  const [asignados, setAsignados] = useState([]);
  const [trabajosTiempo, setTrabajosTiempo] = useState([]);

  const [tipoPago, setTipoPago] = useState("pieza");

  const [ordenId, setOrdenId] = useState("");
  const [procesoId, setProcesoId] = useState("");
  const [empleadoId, setEmpleadoId] = useState("");
  const [seleccionados, setSeleccionados] = useState([]);
  const [descripcionTiempo, setDescripcionTiempo] = useState("");

  const [mensaje, setMensaje] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    cargarInicial();
  }, []);

  async function cargarInicial() {
    const { data: ord, error: errorOrdenes } = await supabase
      .from("ordenes")
      .select("*, modelos(id,codigo,nombre)")
      .neq("estado", "Terminada")
      .order("id", { ascending: false });

    if (errorOrdenes) {
      alert(errorOrdenes.message);
      return;
    }

    const { data: emp, error: errorEmpleados } = await supabase
      .from("empleados")
      .select("*")
      .eq("activo", true)
      .order("nombre");

    if (errorEmpleados) {
      alert(errorEmpleados.message);
      return;
    }

    setOrdenes(ord || []);
    setEmpleados(emp || []);

    await cargarTrabajosTiempo();
  }

  async function cargarTrabajosTiempo() {
    const { data, error } = await supabase
      .from("trabajos_tiempo")
      .select(
        `
        *,
        empleados(nombre, alias, pago_hora),
        ordenes(folio),
        modelo_procesos(nombre)
        `
      )
      .eq("estado", "Trabajando")
      .order("fecha_inicio", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setTrabajosTiempo(data || []);
  }

  function obtenerNumeroBulto(nombre = "") {
    const match = nombre.match(/\d+/);
    return match ? Number(match[0]) : 0;
  }

  function ordenarBultos(lista) {
    return [...lista].sort((a, b) => {
      const tallaA = a.talla || "";
      const tallaB = b.talla || "";

      if (tallaA !== tallaB) {
        return tallaA.localeCompare(tallaB);
      }

      return (
        obtenerNumeroBulto(a.nombre_bulto) -
        obtenerNumeroBulto(b.nombre_bulto)
      );
    });
  }

  function ordenarAsignados(lista) {
    return [...lista].sort((a, b) => {
      const bultoA =
        a.orden_bultos_v2?.nombre_bulto || "";

      const bultoB =
        b.orden_bultos_v2?.nombre_bulto || "";

      if (bultoA !== bultoB) {
        return (
          obtenerNumeroBulto(bultoA) -
          obtenerNumeroBulto(bultoB)
        );
      }

      return Number(a.proceso_id || 0) - Number(b.proceso_id || 0);
    });
  }

  function mostrarMensaje(texto) {
    setMensaje(texto);

    setTimeout(() => {
      setMensaje("");
    }, 2500);
  }

  async function cargarOrden(id) {
    setOrdenId(id);
    setProcesoId("");
    setSeleccionados([]);
    setProcesos([]);
    setBultos([]);
    setAsignados([]);

    if (!id) return;

    const orden = ordenes.find(
      (o) => Number(o.id) === Number(id)
    );

    if (!orden) return;

    const { data: proc, error: errorProcesos } = await supabase
      .from("modelo_procesos")
      .select("*")
      .eq("modelo_id", orden.modelo_id)
      .order("orden");

    if (errorProcesos) {
      alert(errorProcesos.message);
      return;
    }

    const { data: bul, error: errorBultos } = await supabase
      .from("orden_bultos_v2")
      .select("*")
      .eq("orden_id", Number(id));

    if (errorBultos) {
      alert(errorBultos.message);
      return;
    }

    /*
      Cargamos tanto asignaciones activas como terminadas.

      Esto permite bloquear únicamente la combinación:
      bulto + proceso.

      Un mismo bulto puede estar simultáneamente en procesos
      diferentes, pero no se podrá repetir el mismo proceso.
    */
    const { data: asig, error: errorAsignaciones } =
      await supabase
        .from("asignaciones")
        .select(
          `
          *,
          empleados(nombre,alias),
          modelo_procesos(nombre),
          orden_bultos_v2(nombre_bulto,talla,cantidad)
          `
        )
        .eq("orden_id", Number(id))
        .in("estado", ["Asignado", "Terminado"]);

    if (errorAsignaciones) {
      alert(errorAsignaciones.message);
      return;
    }

    setProcesos(proc || []);
    setBultos(ordenarBultos(bul || []));
    setAsignados(ordenarAsignados(asig || []));
  }

  function cambiarTipoPago(nuevoTipo) {
    setTipoPago(nuevoTipo);
    setSeleccionados([]);
    setDescripcionTiempo("");
  }

  function cambiarProceso(nuevoProcesoId) {
    setProcesoId(nuevoProcesoId);

    /*
      Al cambiar de proceso limpiamos la selección anterior,
      porque la disponibilidad de los bultos puede cambiar.
    */
    setSeleccionados([]);
  }

  function cambiarBulto(id) {
    if (bultoEstaAsignado(id)) return;

    setSeleccionados((actual) =>
      actual.includes(id)
        ? actual.filter((x) => x !== id)
        : [...actual, id]
    );
  }

  /*
    CAMBIO PRINCIPAL:

    Un bulto se considera bloqueado únicamente cuando
    ya tiene asignado el proceso actualmente seleccionado.

    Ejemplo:
    CH1 + Armar cuello = bloqueado
    CH1 + Over espalda = todavía disponible
  */
  function bultoEstaAsignado(bultoId) {
    if (!procesoId) return false;

    return asignados.some(
      (asignacion) =>
        Number(asignacion.orden_bulto_id) ===
          Number(bultoId) &&
        Number(asignacion.proceso_id) ===
          Number(procesoId) &&
        ["Asignado", "Terminado"].includes(asignacion.estado)
    );
  }

  function obtenerAsignacionDelProceso(bultoId) {
    if (!procesoId) return null;

    return asignados.find(
      (asignacion) =>
        Number(asignacion.orden_bulto_id) ===
          Number(bultoId) &&
        Number(asignacion.proceso_id) ===
          Number(procesoId) &&
        ["Asignado", "Terminado"].includes(asignacion.estado)
    );
  }

  function bultosDisponibles() {
    if (!procesoId) return [];

    return bultos.filter(
      (bulto) => !bultoEstaAsignado(bulto.id)
    );
  }

  function seleccionarTodo() {
    if (!procesoId) {
      alert("Primero selecciona un proceso");
      return;
    }

    setSeleccionados(
      bultosDisponibles().map((bulto) => bulto.id)
    );
  }

  function quitarSeleccion() {
    setSeleccionados([]);
  }

  function seleccionarTalla(talla) {
    if (!procesoId) {
      alert("Primero selecciona un proceso");
      return;
    }

    const idsTalla = bultosDisponibles()
      .filter((bulto) => bulto.talla === talla)
      .map((bulto) => bulto.id);

    const todosSeleccionados =
      idsTalla.length > 0 &&
      idsTalla.every((id) =>
        seleccionados.includes(id)
      );

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

  const tallasDisponibles = [
    ...new Set(
      bultosDisponibles()
        .map((bulto) => bulto.talla)
        .filter(Boolean)
    ),
  ];

  const empleadoSeleccionado = empleados.find(
    (empleado) =>
      Number(empleado.id) === Number(empleadoId)
  );

  const tarifaEmpleado = Number(
    empleadoSeleccionado?.pago_hora || 0
  );

  const procesoSeleccionado = procesos.find(
    (proceso) =>
      Number(proceso.id) === Number(procesoId)
  );

  const asignadosActivos = asignados.filter(
    (asignacion) => asignacion.estado === "Asignado"
  );

  async function asignarBultos() {
    if (
      !ordenId ||
      !procesoId ||
      !empleadoId ||
      seleccionados.length === 0
    ) {
      alert(
        "Selecciona orden, proceso, trabajador y bultos"
      );
      return;
    }

    setGuardando(true);

    try {
      /*
        Volvemos a consultar Supabase justo antes de guardar.
        Así evitamos duplicar una combinación si otro usuario
        la asignó segundos antes desde otro dispositivo.
      */
      const { data: coincidencias, error: errorConsulta } =
        await supabase
          .from("asignaciones")
          .select(
            "id, orden_bulto_id, proceso_id, estado"
          )
          .eq("orden_id", Number(ordenId))
          .eq("proceso_id", Number(procesoId))
          .in("orden_bulto_id", seleccionados)
          .in("estado", ["Asignado", "Terminado"]);

      if (errorConsulta) throw errorConsulta;

      if ((coincidencias || []).length > 0) {
        const idsOcupados = new Set(
          coincidencias.map((registro) =>
            Number(registro.orden_bulto_id)
          )
        );

        const nombresOcupados = bultos
          .filter((bulto) =>
            idsOcupados.has(Number(bulto.id))
          )
          .map((bulto) => bulto.nombre_bulto)
          .join(", ");

        alert(
          `No se pudo completar la asignación.\n\n` +
            `El proceso "${procesoSeleccionado?.nombre || "seleccionado"}" ` +
            `ya está asignado o terminado en: ${nombresOcupados}.`
        );

        await cargarOrden(ordenId);
        return;
      }

      const registros = seleccionados.map(
        (bultoId) => ({
          orden_id: Number(ordenId),
          orden_bulto_id: Number(bultoId),
          proceso_id: Number(procesoId),
          empleado_id: Number(empleadoId),
          estado: "Asignado",
        })
      );

      const { error } = await supabase
        .from("asignaciones")
        .insert(registros);

      if (error) throw error;

      const movimientos = seleccionados.map(
        (bultoId) => ({
          orden_id: Number(ordenId),
          orden_bulto_id: Number(bultoId),
          proceso_id: Number(procesoId),
          empleado_id: Number(empleadoId),
          tipo: "Asignado",
        })
      );

      const { error: errorMovimientos } = await supabase
        .from("movimientos_bulto")
        .insert(movimientos);

      if (errorMovimientos) throw errorMovimientos;

      setSeleccionados([]);

      mostrarMensaje(
        `Proceso "${procesoSeleccionado?.nombre || ""}" asignado correctamente`
      );

      await cargarOrden(ordenId);

      /*
        cargarOrden limpia el proceso. Lo restauramos para que
        puedas continuar asignando el mismo paso a más bultos.
      */
      setProcesoId(String(procesoId));
    } catch (error) {
      alert(
        error.message ||
          "No se pudieron asignar los bultos"
      );
    } finally {
      setGuardando(false);
    }
  }

  async function iniciarTrabajoTiempo() {
    if (!empleadoId) {
      alert("Selecciona un trabajador");
      return;
    }

    if (!descripcionTiempo.trim()) {
      alert(
        "Escribe la actividad que realizará el trabajador"
      );
      return;
    }

    if (tarifaEmpleado <= 0) {
      alert(
        "Este trabajador no tiene un pago por hora válido registrado"
      );
      return;
    }

    setGuardando(true);

    try {
      const { data: trabajoActivo, error: errorConsulta } =
        await supabase
          .from("trabajos_tiempo")
          .select("id")
          .eq("empleado_id", Number(empleadoId))
          .eq("estado", "Trabajando")
          .maybeSingle();

      if (errorConsulta) throw errorConsulta;

      if (trabajoActivo) {
        alert(
          "Este trabajador ya tiene un trabajo por hora activo. Debes finalizarlo antes de iniciar otro."
        );
        return;
      }

      const datos = {
        empleado_id: Number(empleadoId),
        orden_id: ordenId
          ? Number(ordenId)
          : null,
        proceso_id: procesoId
          ? Number(procesoId)
          : null,
        descripcion: descripcionTiempo.trim(),
        tarifa_hora: tarifaEmpleado,
        fecha_inicio: new Date().toISOString(),
        estado: "Trabajando",
      };

      const { error } = await supabase
        .from("trabajos_tiempo")
        .insert([datos]);

      if (error) throw error;

      setDescripcionTiempo("");
      setEmpleadoId("");
      setProcesoId("");

      mostrarMensaje(
        "Trabajo por hora iniciado correctamente"
      );

      await cargarTrabajosTiempo();
    } catch (error) {
      alert(
        error.message ||
          "No se pudo iniciar el trabajo"
      );
    } finally {
      setGuardando(false);
    }
  }

  function formatearFecha(fecha) {
    if (!fecha) return "";

    return new Date(fecha).toLocaleString("es-MX", {
      dateStyle: "short",
      timeStyle: "short",
    });
  }

  function calcularTiempoTranscurrido(fechaInicio) {
    if (!fechaInicio) return "";

    const inicio = new Date(fechaInicio).getTime();
    const ahora = Date.now();

    const minutos = Math.max(
      0,
      Math.floor((ahora - inicio) / 60000)
    );

    const horas = Math.floor(minutos / 60);
    const minutosRestantes = minutos % 60;

    return `${horas} h ${minutosRestantes} min`;
  }

  return (
    <div>
      <h1>📋 Asignaciones</h1>

      {mensaje && (
        <div style={alerta}>
          {mensaje}
        </div>
      )}

      <section style={card}>
        <h2>Asignar trabajo</h2>

        <div style={selectorTipoPago}>
          <button
            type="button"
            onClick={() => cambiarTipoPago("pieza")}
            style={{
              ...botonTipo,
              background:
                tipoPago === "pieza"
                  ? "#16a34a"
                  : "#e5e7eb",
              color:
                tipoPago === "pieza"
                  ? "white"
                  : "black",
            }}
          >
            🧵 Pago por pieza
          </button>

          <button
            type="button"
            onClick={() => cambiarTipoPago("hora")}
            style={{
              ...botonTipo,
              background:
                tipoPago === "hora"
                  ? "#2563eb"
                  : "#e5e7eb",
              color:
                tipoPago === "hora"
                  ? "white"
                  : "black",
            }}
          >
            ⏱ Pago por hora
          </button>
        </div>

        <label style={etiqueta}>
          Orden de producción
        </label>

        <select
          value={ordenId}
          onChange={(e) =>
            cargarOrden(e.target.value)
          }
          style={input}
        >
          <option value="">
            {tipoPago === "hora"
              ? "Sin orden específica"
              : "Selecciona orden"}
          </option>

          {ordenes.map((orden) => (
            <option
              key={orden.id}
              value={orden.id}
            >
              {orden.folio} -{" "}
              {orden.modelos?.codigo} -{" "}
              {orden.cliente || "Sin cliente"}
            </option>
          ))}
        </select>

        <label style={etiqueta}>
          {tipoPago === "hora"
            ? "Proceso relacionado (opcional)"
            : "Proceso"}
        </label>

        <select
          value={procesoId}
          onChange={(e) =>
            cambiarProceso(e.target.value)
          }
          style={input}
          disabled={!ordenId}
        >
          <option value="">
            {tipoPago === "hora"
              ? "Sin proceso específico"
              : "Selecciona proceso"}
          </option>

          {procesos.map((proceso) => (
            <option
              key={proceso.id}
              value={proceso.id}
            >
              {proceso.orden}. {proceso.nombre}
            </option>
          ))}
        </select>

        <label style={etiqueta}>
          Trabajador
        </label>

        <select
          value={empleadoId}
          onChange={(e) =>
            setEmpleadoId(e.target.value)
          }
          style={input}
        >
          <option value="">
            Selecciona trabajador
          </option>

          {empleados.map((empleado) => (
            <option
              key={empleado.id}
              value={empleado.id}
            >
              {empleado.alias || empleado.nombre} -{" "}
              {empleado.puesto}
            </option>
          ))}
        </select>

        {tipoPago === "hora" &&
          empleadoSeleccionado && (
            <div style={tarifaCard}>
              <div>
                <small>Trabajador</small>

                <strong>
                  {empleadoSeleccionado.alias ||
                    empleadoSeleccionado.nombre}
                </strong>
              </div>

              <div>
                <small>
                  Pago registrado por hora
                </small>

                <strong>
                  ${tarifaEmpleado.toFixed(2)}
                </strong>
              </div>
            </div>
          )}

        {tipoPago === "pieza" ? (
          <>
            <h3>Bultos disponibles</h3>

            {!procesoId && (
              <div style={avisoProceso}>
                Selecciona un proceso para conocer qué
                bultos están disponibles.
              </div>
            )}

            {procesoId && (
              <div style={avisoBloqueo}>
                Los bultos se bloquean únicamente para el
                proceso seleccionado:{" "}
                <strong>
                  {procesoSeleccionado?.nombre}
                </strong>
                . El mismo bulto puede asignarse a otros
                procesos.
              </div>
            )}

            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                marginBottom: 15,
              }}
            >
              <button
                type="button"
                onClick={seleccionarTodo}
                style={botonAzul}
                disabled={!procesoId}
              >
                Todo el corte
              </button>

              <button
                type="button"
                onClick={quitarSeleccion}
                style={botonGris}
              >
                Quitar selección
              </button>

              {tallasDisponibles.map((talla) => (
                <button
                  key={talla}
                  type="button"
                  onClick={() =>
                    seleccionarTalla(talla)
                  }
                  style={botonGris}
                >
                  Todo {talla}
                </button>
              ))}
            </div>

            <p>
              Seleccionados:{" "}
              <strong>
                {seleccionados.length}
              </strong>
            </p>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              {bultos.map((bulto) => {
                const asignacion =
                  obtenerAsignacionDelProceso(
                    bulto.id
                  );

                const asignado = Boolean(asignacion);

                const activo =
                  seleccionados.includes(bulto.id);

                return (
                  <button
                    key={bulto.id}
                    type="button"
                    disabled={
                      asignado || !procesoId
                    }
                    onClick={() =>
                      cambiarBulto(bulto.id)
                    }
                    style={{
                      padding: 14,
                      borderRadius: 10,
                      border: asignado
                        ? "1px solid #9ca3af"
                        : activo
                          ? "1px solid #15803d"
                          : "1px solid #e5e7eb",

                      cursor:
                        asignado || !procesoId
                          ? "not-allowed"
                          : "pointer",

                      background: asignado
                        ? asignacion.estado ===
                          "Terminado"
                          ? "#dcfce7"
                          : "#d1d5db"
                        : activo
                          ? "#16a34a"
                          : "#f3f4f6",

                      color: activo
                        ? "white"
                        : "black",

                      fontWeight: "bold",
                      minWidth: 105,
                      opacity:
                        !procesoId ? 0.6 : 1,
                    }}
                  >
                    {activo ? "✔ " : ""}
                    {bulto.nombre_bulto}

                    <br />

                    {bulto.cantidad} pzs

                    {asignado && (
                      <>
                        <br />

                        {asignacion.estado ===
                        "Terminado"
                          ? "✅ Terminado"
                          : "🔒 Asignado"}

                        <br />

                        <small>
                          {asignacion.empleados
                            ?.alias ||
                            asignacion.empleados
                              ?.nombre}
                        </small>
                      </>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={asignarBultos}
              style={{
                ...boton,
                opacity:
                  guardando ||
                  !procesoId ||
                  seleccionados.length === 0
                    ? 0.7
                    : 1,
              }}
              disabled={
                guardando ||
                !procesoId ||
                seleccionados.length === 0
              }
            >
              {guardando
                ? "Guardando..."
                : "Asignar bultos"}
            </button>
          </>
        ) : (
          <>
            <label style={etiqueta}>
              Actividad que realizará
            </label>

            <textarea
              value={descripcionTiempo}
              onChange={(e) =>
                setDescripcionTiempo(
                  e.target.value
                )
              }
              placeholder="Ejemplo: deshebrar, revisar prendas, apoyar en producción..."
              style={{
                ...input,
                minHeight: 90,
              }}
            />

            <button
              type="button"
              onClick={iniciarTrabajoTiempo}
              style={{
                ...botonHora,
                opacity: guardando ? 0.7 : 1,
              }}
              disabled={guardando}
            >
              {guardando
                ? "Iniciando..."
                : "▶ Iniciar trabajo por hora"}
            </button>
          </>
        )}
      </section>

      {tipoPago === "pieza" && (
        <section style={card}>
          <h2>Trabajo asignado actual</h2>

          {asignadosActivos.length === 0 && (
            <p>
              No hay procesos asignados actualmente en
              esta orden.
            </p>
          )}

          {asignadosActivos.map(
            (asignacion) => (
              <div
                key={asignacion.id}
                style={fila}
              >
                <strong>
                  {asignacion.empleados?.alias ||
                    asignacion.empleados?.nombre}
                </strong>{" "}
                tiene{" "}
                <strong>
                  {
                    asignacion.orden_bultos_v2
                      ?.nombre_bulto
                  }
                </strong>{" "}
                en el proceso{" "}
                <strong>
                  {
                    asignacion.modelo_procesos
                      ?.nombre
                  }
                </strong>
              </div>
            )
          )}
        </section>
      )}

      <section style={card}>
        <h2>⏱ Trabajos por hora activos</h2>

        {trabajosTiempo.length === 0 && (
          <p>
            No hay trabajadores con pago por hora
            activo.
          </p>
        )}

        {trabajosTiempo.map((trabajo) => (
          <div
            key={trabajo.id}
            style={trabajoTiempoCard}
          >
            <div>
              <strong style={{ fontSize: 18 }}>
                {trabajo.empleados?.alias ||
                  trabajo.empleados?.nombre}
              </strong>

              <p style={{ margin: "6px 0" }}>
                {trabajo.descripcion}
              </p>

              {trabajo.ordenes?.folio && (
                <small>
                  Orden: {trabajo.ordenes.folio}
                </small>
              )}

              {trabajo.modelo_procesos?.nombre && (
                <small
                  style={{ display: "block" }}
                >
                  Proceso:{" "}
                  {
                    trabajo.modelo_procesos
                      .nombre
                  }
                </small>
              )}
            </div>

            <div style={{ textAlign: "right" }}>
              <strong
                style={{ color: "#16a34a" }}
              >
                🟢 Trabajando
              </strong>

              <small
                style={{
                  display: "block",
                  marginTop: 6,
                }}
              >
                Inicio:{" "}
                {formatearFecha(
                  trabajo.fecha_inicio
                )}
              </small>

              <small
                style={{ display: "block" }}
              >
                Tiempo aproximado:{" "}
                {calcularTiempoTranscurrido(
                  trabajo.fecha_inicio
                )}
              </small>

              <small
                style={{ display: "block" }}
              >
                Tarifa: $
                {Number(
                  trabajo.tarifa_hora || 0
                ).toFixed(2)}{" "}
                por hora
              </small>
            </div>
          </div>
        ))}
      </section>
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

const etiqueta = {
  display: "block",
  marginTop: 8,
  marginBottom: 5,
  fontWeight: "bold",
};

const selectorTipoPago = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginBottom: 20,
};

const botonTipo = {
  padding: "12px 18px",
  border: "none",
  borderRadius: 8,
  fontWeight: "bold",
  cursor: "pointer",
};

const tarifaCard = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 12,
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  padding: 15,
  borderRadius: 10,
  marginBottom: 15,
};

const avisoProceso = {
  background: "#fef3c7",
  color: "#92400e",
  padding: 12,
  borderRadius: 10,
  marginBottom: 15,
};

const avisoBloqueo = {
  background: "#dbeafe",
  color: "#1e3a8a",
  padding: 12,
  borderRadius: 10,
  marginBottom: 15,
};

const boton = {
  padding: "12px 18px",
  background: "#16a34a",
  color: "white",
  border: "none",
  borderRadius: 8,
  fontWeight: "bold",
  cursor: "pointer",
  marginTop: 20,
};

const botonHora = {
  padding: "13px 20px",
  background: "#2563eb",
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

const fila = {
  padding: 12,
  borderBottom: "1px solid #eee",
};

const trabajoTiempoCard = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(230px, 1fr))",
  gap: 20,
  padding: 15,
  marginBottom: 10,
  border: "1px solid #bbf7d0",
  borderRadius: 10,
  background: "#f0fdf4",
};