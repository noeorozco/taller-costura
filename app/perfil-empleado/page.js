"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function PerfilEmpleadoPage() {
  const [empleados, setEmpleados] = useState([]);
  const [empleadoId, setEmpleadoId] = useState("");
  const [empleado, setEmpleado] = useState(null);

  const [asignacionesTerminadas, setAsignacionesTerminadas] = useState([]);
  const [asignacionesPendientes, setAsignacionesPendientes] = useState([]);
  const [trabajosTiempo, setTrabajosTiempo] = useState([]);
  const [trabajosTiempoActivos, setTrabajosTiempoActivos] = useState([]);
  const [prestamos, setPrestamos] = useState([]);
  const [historialSemanas, setHistorialSemanas] = useState([]);

  const [semanaAbierta, setSemanaAbierta] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [detalleAbierto, setDetalleAbierto] = useState("hoy");

  useEffect(() => {
    cargarEmpleados();
    cargarSemanaAbierta();
  }, []);

  async function cargarEmpleados() {
    const { data, error } = await supabase
      .from("empleados")
      .select("*")
      .eq("activo", true)
      .order("nombre");

    if (error) {
      alert(error.message);
      return;
    }

    setEmpleados(data || []);
  }

  async function cargarSemanaAbierta() {
    const { data, error } = await supabase
      .from("semanas_nomina")
      .select("*")
      .eq("estado", "Abierta")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      alert(error.message);
      return;
    }

    setSemanaAbierta(data || null);
  }

  async function cargarPerfil(id) {
    setEmpleadoId(id);
    setEmpleado(null);
    setAsignacionesTerminadas([]);
    setAsignacionesPendientes([]);
    setTrabajosTiempo([]);
    setTrabajosTiempoActivos([]);
    setPrestamos([]);
    setHistorialSemanas([]);

    if (!id) return;

    setCargando(true);

    try {
      const empleadoNumerico = Number(id);

      const [
        respuestaEmpleado,
        respuestaAsignacionesTerminadas,
        respuestaAsignacionesPendientes,
        respuestaTiempoTerminado,
        respuestaTiempoActivo,
        respuestaPrestamos,
        respuestaHistorial,
      ] = await Promise.all([
        supabase
          .from("empleados")
          .select("*")
          .eq("id", empleadoNumerico)
          .single(),

        supabase
          .from("asignaciones")
          .select(`
            id,
            fecha_terminado,
            empleado_id,
            semana_nomina_id,
            estado,
            modelo_procesos(id,nombre,costo),
            orden_bultos_v2(id,nombre_bulto,talla,cantidad),
            ordenes(
              id,
              folio,
              cliente,
              modelos(id,codigo,nombre)
            )
          `)
          .eq("empleado_id", empleadoNumerico)
          .eq("estado", "Terminado")
          .is("semana_nomina_id", null)
          .order("fecha_terminado", { ascending: false }),

        supabase
          .from("asignaciones")
          .select(`
            id,
            empleado_id,
            estado,
            modelo_procesos(id,nombre,costo),
            orden_bultos_v2(id,nombre_bulto,talla,cantidad),
            ordenes(
              id,
              folio,
              cliente,
              modelos(id,codigo,nombre)
            )
          `)
          .eq("empleado_id", empleadoNumerico)
          .eq("estado", "Asignado")
          .order("id", { ascending: false }),

        supabase
          .from("trabajos_tiempo")
          .select(`
            id,
            descripcion,
            fecha_inicio,
            fecha_fin,
            minutos_trabajados,
            tarifa_hora,
            total_pago,
            semana_id,
            estado,
            modelo_procesos(id,nombre),
            ordenes(
              id,
              folio,
              modelos(id,codigo,nombre)
            )
          `)
          .eq("empleado_id", empleadoNumerico)
          .eq("estado", "Terminado")
          .is("semana_id", null)
          .order("fecha_fin", { ascending: false }),

        supabase
          .from("trabajos_tiempo")
          .select(`
            id,
            descripcion,
            fecha_inicio,
            tarifa_hora,
            estado,
            modelo_procesos(id,nombre),
            ordenes(
              id,
              folio,
              modelos(id,codigo,nombre)
            )
          `)
          .eq("empleado_id", empleadoNumerico)
          .eq("estado", "Trabajando")
          .order("fecha_inicio", { ascending: false }),

        supabase
          .from("prestamos")
          .select("*")
          .eq("empleado_id", empleadoNumerico)
          .order("fecha", { ascending: false }),

        supabase
          .from("nomina_semanal_detalle")
          .select(`
            id,
            pago_pieza,
            pago_hora,
            total_pago,
            semanas_nomina(
              id,
              fecha_inicio,
              fecha_cierre,
              estado
            )
          `)
          .eq("empleado_id", empleadoNumerico)
          .order("id", { ascending: false })
          .limit(12),
      ]);

      const respuestas = [
        respuestaEmpleado,
        respuestaAsignacionesTerminadas,
        respuestaAsignacionesPendientes,
        respuestaTiempoTerminado,
        respuestaTiempoActivo,
        respuestaPrestamos,
        respuestaHistorial,
      ];

      const respuestaConError = respuestas.find((respuesta) => respuesta.error);

      if (respuestaConError?.error) {
        throw respuestaConError.error;
      }

      setEmpleado(respuestaEmpleado.data);
      setAsignacionesTerminadas(
        respuestaAsignacionesTerminadas.data || []
      );
      setAsignacionesPendientes(
        respuestaAsignacionesPendientes.data || []
      );
      setTrabajosTiempo(respuestaTiempoTerminado.data || []);
      setTrabajosTiempoActivos(respuestaTiempoActivo.data || []);
      setPrestamos(respuestaPrestamos.data || []);
      setHistorialSemanas(respuestaHistorial.data || []);
    } catch (error) {
      alert(error.message || "No se pudo cargar el perfil");
    } finally {
      setCargando(false);
    }
  }

  function calcularPagoPaso(asignacion) {
    const cantidad = Number(
      asignacion.orden_bultos_v2?.cantidad || 0
    );

    const precioPaso = Number(
      asignacion.modelo_procesos?.costo || 0
    );

    return cantidad * precioPaso;
  }

  function esHoy(fecha) {
    if (!fecha) return false;

    const registro = new Date(fecha);
    const hoy = new Date();

    return (
      registro.getFullYear() === hoy.getFullYear() &&
      registro.getMonth() === hoy.getMonth() &&
      registro.getDate() === hoy.getDate()
    );
  }

  function estaEnSemanaActual(fecha) {
    if (!fecha || !semanaAbierta?.fecha_inicio) return false;

    const registro = new Date(fecha);
    const inicio = new Date(semanaAbierta.fecha_inicio);
    const fin = new Date(inicio);

    fin.setDate(fin.getDate() + 5);
    fin.setHours(14, 0, 0, 0);

    return registro >= inicio && registro <= fin;
  }

  const resumen = useMemo(() => {
    const pasosSemana = asignacionesTerminadas.filter((registro) =>
      estaEnSemanaActual(registro.fecha_terminado)
    );

    const horasSemana = trabajosTiempo.filter((registro) =>
      estaEnSemanaActual(registro.fecha_fin)
    );

    const pasosHoy = pasosSemana.filter((registro) =>
      esHoy(registro.fecha_terminado)
    );

    const horasHoy = horasSemana.filter((registro) =>
      esHoy(registro.fecha_fin)
    );

    const pagoPasosSemana = pasosSemana.reduce(
      (total, registro) => total + calcularPagoPaso(registro),
      0
    );

    const pagoHorasSemana = horasSemana.reduce(
      (total, registro) => total + Number(registro.total_pago || 0),
      0
    );

    const pagoPasosHoy = pasosHoy.reduce(
      (total, registro) => total + calcularPagoPaso(registro),
      0
    );

    const pagoHorasHoy = horasHoy.reduce(
      (total, registro) => total + Number(registro.total_pago || 0),
      0
    );

    const prestamosSemana = prestamos.filter((prestamo) =>
      estaEnSemanaActual(prestamo.fecha)
    );

    const totalPrestamosSemana = prestamosSemana.reduce(
      (total, prestamo) => total + Number(prestamo.monto || 0),
      0
    );

    return {
      pasosSemana,
      horasSemana,
      pasosHoy,
      horasHoy,
      pagoPasosSemana,
      pagoHorasSemana,
      pagoPasosHoy,
      pagoHorasHoy,
      totalHoy: pagoPasosHoy + pagoHorasHoy,
      totalBrutoSemana: pagoPasosSemana + pagoHorasSemana,
      totalPrestamosSemana,
      netoEstimado:
        pagoPasosSemana + pagoHorasSemana - totalPrestamosSemana,
      bultosTerminadosSemana: pasosSemana.length,
      minutosSemana: horasSemana.reduce(
        (total, registro) =>
          total + Number(registro.minutos_trabajados || 0),
        0
      ),
    };
  }, [
    asignacionesTerminadas,
    trabajosTiempo,
    prestamos,
    semanaAbierta,
  ]);

  const resumenPorDia = useMemo(() => {
    const dias = {};

    function agregar(fecha, pago, tipo) {
      if (!fecha) return;

      const clave = new Date(fecha).toISOString().slice(0, 10);

      if (!dias[clave]) {
        dias[clave] = {
          fecha,
          pasos: 0,
          horas: 0,
          total: 0,
        };
      }

      dias[clave][tipo] += pago;
      dias[clave].total += pago;
    }

    resumen.pasosSemana.forEach((registro) => {
      agregar(
        registro.fecha_terminado,
        calcularPagoPaso(registro),
        "pasos"
      );
    });

    resumen.horasSemana.forEach((registro) => {
      agregar(
        registro.fecha_fin,
        Number(registro.total_pago || 0),
        "horas"
      );
    });

    return Object.values(dias).sort(
      (a, b) => new Date(b.fecha) - new Date(a.fecha)
    );
  }, [resumen]);

  function formatearDinero(valor) {
    return Number(valor || 0).toLocaleString("es-MX", {
      style: "currency",
      currency: "MXN",
    });
  }

  function formatearFecha(fecha) {
    if (!fecha) return "—";

    return new Date(fecha).toLocaleString("es-MX", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  function formatearSoloFecha(fecha) {
    if (!fecha) return "—";

    return new Date(fecha).toLocaleDateString("es-MX", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  }

  function formatearDuracion(minutos) {
    const total = Number(minutos || 0);
    const horas = Math.floor(total / 60);
    const restantes = total % 60;

    if (horas === 0) return `${restantes} min`;

    return `${horas} h ${restantes} min`;
  }

  return (
    <div>
      <h1>👤 Perfil del empleado</h1>

      <section style={card}>
        <label style={etiqueta}>Seleccionar empleado</label>

        <select
          value={empleadoId}
          onChange={(e) => cargarPerfil(e.target.value)}
          style={input}
        >
          <option value="">Selecciona empleado</option>

          {empleados.map((registro) => (
            <option key={registro.id} value={registro.id}>
              {registro.alias || registro.nombre}
            </option>
          ))}
        </select>
      </section>

      {cargando && <h2>Cargando perfil...</h2>}

      {!cargando && empleado && (
        <>
          <section style={card}>
            <div style={encabezadoPerfil}>
              <div>
                <h2 style={{ margin: 0 }}>
                  {empleado.alias || empleado.nombre}
                </h2>

                {empleado.alias && (
                  <small>{empleado.nombre}</small>
                )}
              </div>

              <div style={estadoActivo}>
                {empleado.activo ? "🟢 Activo" : "🔴 Inactivo"}
              </div>
            </div>

            <div style={datosEmpleado}>
              <p>
                <strong>Puesto:</strong>{" "}
                {empleado.puesto || "Sin registrar"}
              </p>

              <p>
                <strong>Teléfono:</strong>{" "}
                {empleado.telefono || "Sin registrar"}
              </p>

              <p>
                <strong>Fecha de ingreso:</strong>{" "}
                {empleado.fecha_ingreso || "Sin registrar"}
              </p>

              <p>
                <strong>Cumpleaños:</strong>{" "}
                {empleado.cumpleanos || "Sin registrar"}
              </p>
            </div>
          </section>

          <h2>Resumen en tiempo real</h2>

          <section style={resumenGrid}>
            <div style={tarjetaResumen}>
              <small>Generado hoy</small>
              <strong>{formatearDinero(resumen.totalHoy)}</strong>

              <span>
                Pasos: {formatearDinero(resumen.pagoPasosHoy)}
              </span>

              <span>
                Horas: {formatearDinero(resumen.pagoHorasHoy)}
              </span>
            </div>

            <div style={tarjetaResumen}>
              <small>Pago por pasos esta semana</small>
              <strong>
                {formatearDinero(resumen.pagoPasosSemana)}
              </strong>

              <span>
                Bultos terminados:{" "}
                {resumen.bultosTerminadosSemana}
              </span>
            </div>

            <div style={tarjetaResumen}>
              <small>Pago por hora esta semana</small>
              <strong>
                {formatearDinero(resumen.pagoHorasSemana)}
              </strong>

              <span>
                Tiempo: {formatearDuracion(resumen.minutosSemana)}
              </span>
            </div>

            <div style={tarjetaTotal}>
              <small>Acumulado bruto semanal</small>
              <strong>
                {formatearDinero(resumen.totalBrutoSemana)}
              </strong>
            </div>

            <div style={tarjetaPrestamo}>
              <small>Préstamos registrados esta semana</small>
              <strong>
                -{formatearDinero(resumen.totalPrestamosSemana)}
              </strong>
            </div>

            <div style={tarjetaNeto}>
              <small>Neto estimado para el cierre</small>
              <strong>
                {formatearDinero(resumen.netoEstimado)}
              </strong>
            </div>
          </section>

          <section style={card}>
            <h2>📅 Ganancia por día</h2>

            {resumenPorDia.length === 0 && (
              <p>Todavía no hay trabajos terminados esta semana.</p>
            )}

            {resumenPorDia.map((dia) => (
              <div key={dia.fecha} style={filaDia}>
                <div>
                  <strong>{formatearSoloFecha(dia.fecha)}</strong>
                </div>

                <div style={totalesDia}>
                  <span>
                    Pasos: {formatearDinero(dia.pasos)}
                  </span>

                  <span>
                    Horas: {formatearDinero(dia.horas)}
                  </span>

                  <strong>
                    Total: {formatearDinero(dia.total)}
                  </strong>
                </div>
              </div>
            ))}
          </section>

          <section style={card}>
            <h2>Trabajo actual y pendiente</h2>

            <div style={resumenGrid}>
              <div style={tarjetaResumen}>
                <small>Bultos pendientes</small>
                <strong>{asignacionesPendientes.length}</strong>
              </div>

              <div style={tarjetaResumen}>
                <small>Trabajos por hora activos</small>
                <strong>{trabajosTiempoActivos.length}</strong>
              </div>
            </div>

            {asignacionesPendientes.map((registro) => (
              <div key={registro.id} style={pendienteCard}>
                <strong>
                  {registro.orden_bultos_v2?.nombre_bulto}
                </strong>

                <span>
                  {registro.modelo_procesos?.nombre}
                </span>

                <small>
                  Orden: {registro.ordenes?.folio || "Sin orden"} ·
                  Modelo:{" "}
                  {registro.ordenes?.modelos?.codigo || "Sin modelo"}
                </small>

                <small style={{ color: "#92400e" }}>
                  Pendiente: todavía no se suma a la nómina
                </small>
              </div>
            ))}

            {trabajosTiempoActivos.map((registro) => (
              <div key={registro.id} style={activoCard}>
                <strong>⏱ {registro.descripcion}</strong>

                <small>
                  Inició: {formatearFecha(registro.fecha_inicio)}
                </small>

                <small>
                  Tarifa: {formatearDinero(registro.tarifa_hora)} por
                  hora
                </small>

                <small style={{ color: "#166534" }}>
                  Trabajando actualmente
                </small>
              </div>
            ))}
          </section>

          <section style={card}>
            <div style={pestanas}>
              <button
                onClick={() => setDetalleAbierto("hoy")}
                style={{
                  ...botonPestana,
                  ...(detalleAbierto === "hoy"
                    ? botonPestanaActivo
                    : {}),
                }}
              >
                Hoy
              </button>

              <button
                onClick={() => setDetalleAbierto("semana")}
                style={{
                  ...botonPestana,
                  ...(detalleAbierto === "semana"
                    ? botonPestanaActivo
                    : {}),
                }}
              >
                Semana
              </button>

              <button
                onClick={() => setDetalleAbierto("historial")}
                style={{
                  ...botonPestana,
                  ...(detalleAbierto === "historial"
                    ? botonPestanaActivo
                    : {}),
                }}
              >
                Historial
              </button>
            </div>

            {detalleAbierto === "hoy" && (
              <>
                <h2>Trabajos terminados hoy</h2>

                {resumen.pasosHoy.map((registro) => (
                  <DetallePaso
                    key={`paso-${registro.id}`}
                    registro={registro}
                    calcularPagoPaso={calcularPagoPaso}
                    formatearDinero={formatearDinero}
                    formatearFecha={formatearFecha}
                  />
                ))}

                {resumen.horasHoy.map((registro) => (
                  <DetalleHora
                    key={`hora-${registro.id}`}
                    registro={registro}
                    formatearDinero={formatearDinero}
                    formatearFecha={formatearFecha}
                    formatearDuracion={formatearDuracion}
                  />
                ))}

                {resumen.pasosHoy.length === 0 &&
                  resumen.horasHoy.length === 0 && (
                    <p>No hay trabajos terminados hoy.</p>
                  )}
              </>
            )}

            {detalleAbierto === "semana" && (
              <>
                <h2>Trabajos terminados esta semana</h2>

                {resumen.pasosSemana.map((registro) => (
                  <DetallePaso
                    key={`paso-${registro.id}`}
                    registro={registro}
                    calcularPagoPaso={calcularPagoPaso}
                    formatearDinero={formatearDinero}
                    formatearFecha={formatearFecha}
                  />
                ))}

                {resumen.horasSemana.map((registro) => (
                  <DetalleHora
                    key={`hora-${registro.id}`}
                    registro={registro}
                    formatearDinero={formatearDinero}
                    formatearFecha={formatearFecha}
                    formatearDuracion={formatearDuracion}
                  />
                ))}

                {resumen.pasosSemana.length === 0 &&
                  resumen.horasSemana.length === 0 && (
                    <p>No hay trabajos terminados esta semana.</p>
                  )}
              </>
            )}

            {detalleAbierto === "historial" && (
              <>
                <h2>Historial de nóminas cerradas</h2>

                {historialSemanas.length === 0 && (
                  <p>Todavía no hay semanas cerradas.</p>
                )}

                {historialSemanas.map((registro) => (
                  <div key={registro.id} style={historialCard}>
                    <div>
                      <strong>
                        Semana del{" "}
                        {formatearSoloFecha(
                          registro.semanas_nomina?.fecha_inicio
                        )}
                      </strong>

                      <small style={{ display: "block" }}>
                        Cerrada:{" "}
                        {formatearFecha(
                          registro.semanas_nomina?.fecha_cierre
                        )}
                      </small>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <small>
                        Pasos:{" "}
                        {formatearDinero(registro.pago_pieza)}
                      </small>

                      <small style={{ display: "block" }}>
                        Horas:{" "}
                        {formatearDinero(registro.pago_hora)}
                      </small>

                      <strong>
                        Total:{" "}
                        {formatearDinero(registro.total_pago)}
                      </strong>
                    </div>
                  </div>
                ))}
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function DetallePaso({
  registro,
  calcularPagoPaso,
  formatearDinero,
  formatearFecha,
}) {
  return (
    <div style={detalleCard}>
      <div>
        <strong>{registro.modelo_procesos?.nombre}</strong>

        <small style={{ display: "block" }}>
          {registro.orden_bultos_v2?.nombre_bulto} ·{" "}
          {registro.orden_bultos_v2?.cantidad} unidades procesadas
        </small>

        <small style={{ display: "block" }}>
          Orden: {registro.ordenes?.folio || "Sin orden"} · Modelo:{" "}
          {registro.ordenes?.modelos?.codigo || "Sin modelo"}
        </small>

        <small style={{ display: "block" }}>
          {formatearFecha(registro.fecha_terminado)}
        </small>
      </div>

      <strong>{formatearDinero(calcularPagoPaso(registro))}</strong>
    </div>
  );
}

function DetalleHora({
  registro,
  formatearDinero,
  formatearFecha,
  formatearDuracion,
}) {
  return (
    <div style={detalleCard}>
      <div>
        <strong>⏱ {registro.descripcion}</strong>

        <small style={{ display: "block" }}>
          {registro.modelo_procesos?.nombre || "Sin proceso específico"}
        </small>

        <small style={{ display: "block" }}>
          {formatearDuracion(registro.minutos_trabajados)} ·{" "}
          {formatearDinero(registro.tarifa_hora)} por hora
        </small>

        <small style={{ display: "block" }}>
          {formatearFecha(registro.fecha_fin)}
        </small>
      </div>

      <strong>{formatearDinero(registro.total_pago)}</strong>
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
  padding: 11,
  borderRadius: 8,
  border: "1px solid #ccc",
  boxSizing: "border-box",
};

const etiqueta = {
  display: "block",
  fontWeight: "bold",
  marginBottom: 8,
};

const encabezadoPerfil = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 15,
};

const estadoActivo = {
  background: "#dcfce7",
  color: "#166534",
  padding: "8px 12px",
  borderRadius: 999,
  fontWeight: "bold",
};

const datosEmpleado = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: 10,
  marginTop: 15,
};

const resumenGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: 15,
  marginBottom: 20,
};

const tarjetaResumen = {
  background: "white",
  padding: 18,
  borderRadius: 12,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  display: "grid",
  gap: 7,
};

const tarjetaTotal = {
  ...tarjetaResumen,
  background: "#dbeafe",
  color: "#1e3a8a",
};

const tarjetaPrestamo = {
  ...tarjetaResumen,
  background: "#fef3c7",
  color: "#92400e",
};

const tarjetaNeto = {
  ...tarjetaResumen,
  background: "#166534",
  color: "white",
};

const filaDia = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 15,
  padding: 14,
  borderBottom: "1px solid #eee",
};

const totalesDia = {
  display: "flex",
  gap: 15,
  flexWrap: "wrap",
  alignItems: "center",
};

const pendienteCard = {
  display: "grid",
  gap: 5,
  padding: 13,
  marginBottom: 10,
  borderRadius: 10,
  border: "1px solid #fde68a",
  background: "#fffbeb",
};

const activoCard = {
  display: "grid",
  gap: 5,
  padding: 13,
  marginBottom: 10,
  borderRadius: 10,
  border: "1px solid #bbf7d0",
  background: "#f0fdf4",
};

const pestanas = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginBottom: 20,
};

const botonPestana = {
  padding: "10px 14px",
  border: "none",
  borderRadius: 8,
  background: "#e5e7eb",
  cursor: "pointer",
  fontWeight: "bold",
};

const botonPestanaActivo = {
  background: "#2563eb",
  color: "white",
};

const detalleCard = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 15,
  padding: 14,
  borderBottom: "1px solid #eee",
};

const historialCard = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 15,
  padding: 14,
  marginBottom: 10,
  border: "1px solid #e5e7eb",
  borderRadius: 10,
};