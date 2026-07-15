"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function NominaPage() {
  const [asignaciones, setAsignaciones] = useState([]);
  const [trabajosTiempo, setTrabajosTiempo] = useState([]);
  const [adeudosPendientes, setAdeudosPendientes] = useState([]);

  const [semanaAbierta, setSemanaAbierta] = useState(null);
  const [historial, setHistorial] = useState([]);

  const [empleadoAbierto, setEmpleadoAbierto] = useState(null);
  const [semanaHistorialAbierta, setSemanaHistorialAbierta] =
    useState(null);

  const [cargando, setCargando] = useState(true);
  const [cerrando, setCerrando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    cargarTodo();
  }, []);

  async function cargarTodo() {
    setCargando(true);

    try {
      const semana = await obtenerOCrearSemanaAbierta();

      await Promise.all([
        cargarAsignacionesPendientes(),
        cargarTrabajosTiempoPendientes(),
        cargarAdeudosPendientes(),
        cargarHistorial(),
      ]);

      setSemanaAbierta(semana);
    } catch (error) {
      alert(error.message || "No se pudo cargar la nómina");
    } finally {
      setCargando(false);
    }
  }

  async function obtenerOCrearSemanaAbierta() {
    const { data: existente, error: errorConsulta } = await supabase
      .from("semanas_nomina")
      .select("*")
      .eq("estado", "Abierta")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (errorConsulta) throw errorConsulta;

    if (existente) return existente;

    const lunes = obtenerLunesActual();

    const { data: nueva, error: errorCreacion } = await supabase
      .from("semanas_nomina")
      .insert([
        {
          fecha_inicio: lunes.toISOString(),
          estado: "Abierta",
          total_nomina: 0,
        },
      ])
      .select()
      .single();

    if (errorCreacion) throw errorCreacion;

    return nueva;
  }

  async function cargarAsignacionesPendientes() {
    const { data, error } = await supabase
      .from("asignaciones")
      .select(`
        id,
        empleado_id,
        orden_id,
        proceso_id,
        orden_bulto_id,
        estado,
        fecha_terminado,
        semana_nomina_id,
        empleados(id,nombre,alias,puesto),
        modelo_procesos(id,nombre,costo),
        orden_bultos_v2(id,nombre_bulto,talla,cantidad),
        ordenes(
          id,
          folio,
          cliente,
          modelos(id,codigo,nombre)
        )
      `)
      .eq("estado", "Terminado")
      .is("semana_nomina_id", null)
      .order("fecha_terminado", { ascending: true });

    if (error) throw error;

    setAsignaciones(data || []);
  }

  async function cargarTrabajosTiempoPendientes() {
    const { data, error } = await supabase
      .from("trabajos_tiempo")
      .select(`
        id,
        empleado_id,
        orden_id,
        proceso_id,
        descripcion,
        tarifa_hora,
        fecha_inicio,
        fecha_fin,
        minutos_trabajados,
        total_pago,
        estado,
        semana_id,
        empleados(id,nombre,alias,puesto),
        ordenes(
          id,
          folio,
          cliente,
          modelos(id,codigo,nombre)
        ),
        modelo_procesos(id,nombre)
      `)
      .eq("estado", "Terminado")
      .is("semana_id", null)
      .order("fecha_fin", { ascending: true });

    if (error) throw error;

    setTrabajosTiempo(data || []);
  }

  async function cargarAdeudosPendientes() {
    const { data, error } = await supabase
      .from("empleado_adeudos")
      .select(`
        id,
        empleado_id,
        saldo,
        estado
      `)
      .eq("estado", "pendiente")
      .gt("saldo", 0);

    if (error) throw error;

    setAdeudosPendientes(data || []);
  }

  async function cargarHistorial() {
    const { data, error } = await supabase
      .from("semanas_nomina")
      .select(`
        id,
        fecha_inicio,
        fecha_cierre,
        estado,
        total_nomina,
        nomina_semanal_detalle(
          id,
          empleado_id,
          pago_pieza,
          pago_hora,
          total_pago,
          pago_bruto,
          descuento_adeudo,
          total_neto,
          empleados(id,nombre,alias,puesto)
        )
      `)
      .eq("estado", "Cerrada")
      .order("fecha_cierre", { ascending: false })
      .limit(15);

    if (error) throw error;

    setHistorial(data || []);
  }

  function calcularPagoAsignacion(asignacion) {
    const cantidad = Number(
      asignacion.orden_bultos_v2?.cantidad || 0
    );

    const precioPaso = Number(
      asignacion.modelo_procesos?.costo || 0
    );

    return cantidad * precioPaso;
  }

  const nominaPorEmpleado = useMemo(() => {
    const mapa = new Map();

    function obtenerResumen(registro) {
      const id = Number(registro.empleado_id);
      const empleado = registro.empleados;

      if (!mapa.has(id)) {
        mapa.set(id, {
          empleadoId: id,
          nombre:
            empleado?.alias ||
            empleado?.nombre ||
            `Empleado ${id}`,
          nombreCompleto: empleado?.nombre || "",
          puesto: empleado?.puesto || "",

          pagoPasos: 0,
          pagoHoras: 0,

          totalBruto: 0,
          adeudoPendiente: 0,
          descuentoSugerido: 0,
          totalNeto: 0,

          bultosTerminados: 0,
          unidadesProcesadas: 0,
          minutosTrabajados: 0,

          detallePasos: [],
          detalleHoras: [],
        });
      }

      return mapa.get(id);
    }

    asignaciones.forEach((asignacion) => {
      const resumen = obtenerResumen(asignacion);

      const cantidad = Number(
        asignacion.orden_bultos_v2?.cantidad || 0
      );

      const precioPaso = Number(
        asignacion.modelo_procesos?.costo || 0
      );

      const pago = calcularPagoAsignacion(asignacion);

      resumen.pagoPasos += pago;
      resumen.totalBruto += pago;
      resumen.bultosTerminados += 1;
      resumen.unidadesProcesadas += cantidad;

      resumen.detallePasos.push({
        id: asignacion.id,
        fecha: asignacion.fecha_terminado,
        orden: asignacion.ordenes?.folio || "Sin orden",
        modelo:
          asignacion.ordenes?.modelos?.codigo || "Sin modelo",
        proceso:
          asignacion.modelo_procesos?.nombre || "Sin proceso",
        bulto:
          asignacion.orden_bultos_v2?.nombre_bulto ||
          "Sin bulto",
        talla:
          asignacion.orden_bultos_v2?.talla || "Sin talla",
        cantidad,
        precioPaso,
        total: pago,
      });
    });

    trabajosTiempo.forEach((trabajo) => {
      const resumen = obtenerResumen(trabajo);

      const pago = Number(trabajo.total_pago || 0);

      const minutos = Number(
        trabajo.minutos_trabajados || 0
      );

      resumen.pagoHoras += pago;
      resumen.totalBruto += pago;
      resumen.minutosTrabajados += minutos;

      resumen.detalleHoras.push({
        id: trabajo.id,
        fecha: trabajo.fecha_fin,
        descripcion:
          trabajo.descripcion || "Trabajo por hora",
        orden: trabajo.ordenes?.folio || "Sin orden",
        modelo:
          trabajo.ordenes?.modelos?.codigo || "Sin modelo",
        proceso:
          trabajo.modelo_procesos?.nombre ||
          "Sin proceso específico",
        minutos,
        tarifa: Number(trabajo.tarifa_hora || 0),
        total: pago,
      });
    });

    mapa.forEach((empleado) => {
      const adeudoTotal = adeudosPendientes
        .filter(
          (adeudo) =>
            Number(adeudo.empleado_id) ===
            Number(empleado.empleadoId)
        )
        .reduce(
          (total, adeudo) =>
            total + Number(adeudo.saldo || 0),
          0
        );

      empleado.adeudoPendiente = adeudoTotal;

      /*
        Por ahora mostramos cuánto podría descontarse.
        Todavía no se registra ni se modifica el adeudo.
      */
      empleado.descuentoSugerido = Math.min(
        empleado.totalBruto,
        adeudoTotal
      );

      empleado.totalNeto = Math.max(
        empleado.totalBruto -
          empleado.descuentoSugerido,
        0
      );
    });

    return [...mapa.values()].sort((a, b) =>
      a.nombre.localeCompare(b.nombre)
    );
  }, [
    asignaciones,
    trabajosTiempo,
    adeudosPendientes,
  ]);

  const totales = useMemo(() => {
    return nominaPorEmpleado.reduce(
      (acumulado, empleado) => {
        acumulado.pasos += empleado.pagoPasos;
        acumulado.horas += empleado.pagoHoras;
        acumulado.bruto += empleado.totalBruto;
        acumulado.adeudos += empleado.adeudoPendiente;
        acumulado.descuentoSugerido +=
          empleado.descuentoSugerido;
        acumulado.neto += empleado.totalNeto;

        acumulado.bultos += empleado.bultosTerminados;
        acumulado.unidades += empleado.unidadesProcesadas;
        acumulado.minutos += empleado.minutosTrabajados;

        return acumulado;
      },
      {
        pasos: 0,
        horas: 0,
        bruto: 0,
        adeudos: 0,
        descuentoSugerido: 0,
        neto: 0,
        bultos: 0,
        unidades: 0,
        minutos: 0,
      }
    );
  }, [nominaPorEmpleado]);

  function obtenerLunesActual() {
    const fecha = new Date();
    const dia = fecha.getDay();
    const diferencia = dia === 0 ? -6 : 1 - dia;

    fecha.setDate(fecha.getDate() + diferencia);
    fecha.setHours(0, 0, 0, 0);

    return fecha;
  }

  function obtenerSabadoDesdeInicio(fechaInicio) {
    const fecha = new Date(fechaInicio);

    fecha.setDate(fecha.getDate() + 5);
    fecha.setHours(14, 0, 0, 0);

    return fecha;
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
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function formatearDuracion(minutos) {
    const total = Number(minutos || 0);
    const horas = Math.floor(total / 60);
    const restantes = total % 60;

    if (horas === 0) return `${restantes} min`;

    return `${horas} h ${restantes} min`;
  }

  function mostrarMensaje(texto) {
    setMensaje(texto);

    setTimeout(() => {
      setMensaje("");
    }, 4000);
  }

  async function cerrarSemana() {
    if (!semanaAbierta) {
      alert("No existe una semana abierta");
      return;
    }

    if (nominaPorEmpleado.length === 0) {
      alert(
        "No hay entregas ni trabajos por hora pendientes de pago"
      );
      return;
    }

    /*
      En este primer paso el cierre conserva el total bruto.
      El descuento se muestra solamente como información.
    */
    const confirmar = confirm(
      `¿Cerrar la semana?\n\n` +
        `Trabajadores: ${nominaPorEmpleado.length}\n` +
        `Pago por pasos: $${totales.pasos.toFixed(2)}\n` +
        `Pago por hora: $${totales.horas.toFixed(2)}\n` +
        `Nómina bruta: $${totales.bruto.toFixed(2)}\n\n` +
        `Los adeudos todavía no se descontarán automáticamente.\n\n` +
        `Los bultos que no se hayan entregado continuarán asignados para la siguiente semana.`
    );

    if (!confirmar) return;

    setCerrando(true);

    try {
      const detalles = nominaPorEmpleado.map((empleado) => ({
        semana_id: semanaAbierta.id,
        empleado_id: empleado.empleadoId,

        pago_pieza: Number(
          empleado.pagoPasos.toFixed(2)
        ),

        pago_hora: Number(
          empleado.pagoHoras.toFixed(2)
        ),

        /*
          Conservamos el pago normal mientras el descuento
          todavía sea solamente informativo.
        */
        total_pago: Number(
          empleado.totalBruto.toFixed(2)
        ),

        pago_bruto: Number(
          empleado.totalBruto.toFixed(2)
        ),

        descuento_adeudo: 0,

        total_neto: Number(
          empleado.totalBruto.toFixed(2)
        ),
      }));

      const { error: errorDetalles } = await supabase
        .from("nomina_semanal_detalle")
        .insert(detalles);

      if (errorDetalles) throw errorDetalles;

      if (asignaciones.length > 0) {
        const ids = asignaciones.map(
          (registro) => registro.id
        );

        const { error } = await supabase
          .from("asignaciones")
          .update({
            semana_nomina_id: semanaAbierta.id,
          })
          .in("id", ids)
          .is("semana_nomina_id", null);

        if (error) throw error;
      }

      if (trabajosTiempo.length > 0) {
        const ids = trabajosTiempo.map(
          (registro) => registro.id
        );

        const { error } = await supabase
          .from("trabajos_tiempo")
          .update({
            semana_id: semanaAbierta.id,
          })
          .in("id", ids)
          .is("semana_id", null);

        if (error) throw error;
      }

            const fechaCierre = new Date();

      const { error: errorCierre } = await supabase
        .from("semanas_nomina")
        .update({
          estado: "Cerrada",
          fecha_cierre: fechaCierre.toISOString(),
          total_nomina: Number(
            totales.bruto.toFixed(2)
          ),
        })
        .eq("id", semanaAbierta.id);

      if (errorCierre) throw errorCierre;

      const siguienteInicio = new Date(
        semanaAbierta.fecha_inicio
      );

      siguienteInicio.setDate(
        siguienteInicio.getDate() + 7
      );

      const { data: nuevaSemana, error: errorNuevaSemana } =
        await supabase
          .from("semanas_nomina")
          .insert([
            {
              fecha_inicio: siguienteInicio.toISOString(),
              estado: "Abierta",
              total_nomina: 0,
            },
          ])
          .select()
          .single();

      if (errorNuevaSemana) throw errorNuevaSemana;

      setSemanaAbierta(nuevaSemana);
      setEmpleadoAbierto(null);

      mostrarMensaje(
        `Semana cerrada. Nómina total: $${totales.bruto.toFixed(
          2
        )}`
      );

      await Promise.all([
        cargarAsignacionesPendientes(),
        cargarTrabajosTiempoPendientes(),
        cargarAdeudosPendientes(),
        cargarHistorial(),
      ]);
    } catch (error) {
      alert(
        error.message ||
          "No se pudo completar el cierre semanal"
      );
    } finally {
      setCerrando(false);
    }
  }

  if (cargando) {
    return <h2>Cargando nómina...</h2>;
  }

  const finSemana = semanaAbierta
    ? obtenerSabadoDesdeInicio(
        semanaAbierta.fecha_inicio
      )
    : null;

  return (
    <div>
      <h1>💵 Nómina semanal</h1>

      {mensaje && (
        <div style={alerta}>
          {mensaje}
        </div>
      )}

      <section style={card}>
        <div style={encabezadoSemana}>
          <div>
            <h2 style={{ margin: 0 }}>
              Semana actual
            </h2>

            <p>
              Del{" "}
              <strong>
                {formatearSoloFecha(
                  semanaAbierta?.fecha_inicio
                )}
              </strong>{" "}
              al{" "}
              <strong>
                {formatearSoloFecha(finSemana)}
              </strong>
            </p>

            <small>
              Cierre habitual: sábado a las 2:00 p. m.
            </small>
          </div>

          <div style={estadoAbierto}>
            🟢 ABIERTA
          </div>
        </div>
      </section>

      <section style={resumenGeneral}>
        <div style={tarjetaResumen}>
          <small>Pago por pasos</small>

          <strong>
            ${totales.pasos.toFixed(2)}
          </strong>
        </div>

        <div style={tarjetaResumen}>
          <small>Pago por hora</small>

          <strong>
            ${totales.horas.toFixed(2)}
          </strong>
        </div>

        <div style={tarjetaResumen}>
          <small>Trabajadores con pago</small>

          <strong>
            {nominaPorEmpleado.length}
          </strong>
        </div>

        <div style={tarjetaResumen}>
          <small>Nómina bruta</small>

          <strong>
            ${totales.bruto.toFixed(2)}
          </strong>
        </div>

        <div style={tarjetaResumenAdeudo}>
          <small>Descuento informativo</small>

          <strong>
            -${totales.descuentoSugerido.toFixed(2)}
          </strong>
        </div>

        <div style={tarjetaResumenDestacada}>
          <small>Neto estimado</small>

          <strong>
            ${totales.neto.toFixed(2)}
          </strong>
        </div>
      </section>

      <div style={avisoInformativo}>
        <strong>
          ℹ️ Vista informativa:
        </strong>{" "}
        los adeudos todavía no se descuentan automáticamente.
        La nómina se cerrará usando el pago bruto.
      </div>

      <section style={card}>
        <h2>Detalle por trabajador</h2>

        {nominaPorEmpleado.length === 0 && (
          <div style={sinRegistros}>
            <strong>
              La nómina actual está en cero.
            </strong>

            <p>
              Se agregarán únicamente los bultos
              entregados y los trabajos por hora
              finalizados.
            </p>
          </div>
        )}

        {nominaPorEmpleado.map((empleado) => {
          const abierto =
            empleadoAbierto === empleado.empleadoId;

          return (
            <div
              key={empleado.empleadoId}
              style={empleadoCard}
            >
              <button
                type="button"
                onClick={() =>
                  setEmpleadoAbierto(
                    abierto
                      ? null
                      : empleado.empleadoId
                  )
                }
                style={botonEmpleado}
              >
                <div style={{ textAlign: "left" }}>
                  <strong style={{ fontSize: 18 }}>
                    {empleado.nombre}
                  </strong>

                  <small style={{ display: "block" }}>
                    {empleado.puesto || "Sin puesto"}
                  </small>
                </div>

                <div style={totalesEmpleado}>
                  <span>
                    Pasos:{" "}
                    <strong>
                      ${empleado.pagoPasos.toFixed(2)}
                    </strong>
                  </span>

                  <span>
                    Horas:{" "}
                    <strong>
                      ${empleado.pagoHoras.toFixed(2)}
                    </strong>
                  </span>

                  <span style={totalBrutoEmpleado}>
                    Bruto: $
                    {empleado.totalBruto.toFixed(2)}
                  </span>

                  <span style={adeudoEmpleado}>
                    Adeudo: $
                    {empleado.adeudoPendiente.toFixed(2)}
                  </span>

                  <span style={netoEmpleado}>
                    Neto estimado: $
                    {empleado.totalNeto.toFixed(2)}
                  </span>

                  <span>
                    {abierto ? "▲" : "▼"}
                  </span>
                </div>
              </button>

              {abierto && (
                <div style={detalleEmpleado}>
                  <div style={metricasEmpleado}>
                    <div style={metricaCaja}>
                      <small>Bultos terminados</small>

                      <strong>
                        {empleado.bultosTerminados}
                      </strong>
                    </div>

                    <div style={metricaCaja}>
                      <small>
                        Unidades procesadas en sus pasos
                      </small>

                      <strong>
                        {empleado.unidadesProcesadas}
                      </strong>
                    </div>

                    <div style={metricaCaja}>
                      <small>Tiempo pagado</small>

                      <strong>
                        {formatearDuracion(
                          empleado.minutosTrabajados
                        )}
                      </strong>
                    </div>

                    <div style={metricaCaja}>
                      <small>Adeudo pendiente</small>

                      <strong style={{ color: "#b91c1c" }}>
                        $
                        {empleado.adeudoPendiente.toFixed(
                          2
                        )}
                      </strong>
                    </div>

                    <div style={metricaCaja}>
                      <small>
                        Descuento máximo informativo
                      </small>

                      <strong style={{ color: "#b45309" }}>
                        -$
                        {empleado.descuentoSugerido.toFixed(
                          2
                        )}
                      </strong>
                    </div>

                    <div style={metricaCaja}>
                      <small>Neto estimado</small>

                      <strong style={{ color: "#166534" }}>
                        $
                        {empleado.totalNeto.toFixed(2)}
                      </strong>
                    </div>
                  </div>

                  {empleado.detallePasos.length > 0 && (
                    <>
                      <h3>🧵 Pago por pasos</h3>

                      <div style={{ overflowX: "auto" }}>
                        <table style={tabla}>
                          <thead>
                            <tr>
                              <th style={th}>Fecha</th>
                              <th style={th}>Orden</th>
                              <th style={th}>Modelo</th>
                              <th style={th}>Proceso</th>
                              <th style={th}>Bulto</th>
                              <th style={th}>Cantidad</th>
                              <th style={th}>Precio</th>
                              <th style={th}>Total</th>
                            </tr>
                          </thead>

                          <tbody>
                            {empleado.detallePasos.map(
                              (detalle) => (
                                <tr key={detalle.id}>
                                  <td style={td}>
                                    {formatearFecha(
                                      detalle.fecha
                                    )}
                                  </td>

                                  <td style={td}>
                                    {detalle.orden}
                                  </td>

                                  <td style={td}>
                                    {detalle.modelo}
                                  </td>

                                  <td style={td}>
                                    {detalle.proceso}
                                  </td>

                                  <td style={td}>
                                    {detalle.bulto}
                                  </td>

                                  <td style={td}>
                                    {detalle.cantidad}
                                  </td>

                                  <td style={td}>
                                    $
                                    {detalle.precioPaso.toFixed(
                                      2
                                    )}
                                  </td>

                                  <td style={td}>
                                    <strong>
                                      $
                                      {detalle.total.toFixed(
                                        2
                                      )}
                                    </strong>
                                  </td>
                                </tr>
                              )
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  {empleado.detalleHoras.length > 0 && (
                    <>
                      <h3>⏱ Pago por hora</h3>

                      <div style={{ overflowX: "auto" }}>
                        <table style={tabla}>
                          <thead>
                            <tr>
                              <th style={th}>Fecha</th>
                              <th style={th}>Actividad</th>
                              <th style={th}>Orden</th>
                              <th style={th}>Proceso</th>
                              <th style={th}>Tiempo</th>
                              <th style={th}>Tarifa</th>
                              <th style={th}>Total</th>
                            </tr>
                          </thead>

                          <tbody>
                            {empleado.detalleHoras.map(
                              (detalle) => (
                                <tr key={detalle.id}>
                                  <td style={td}>
                                    {formatearFecha(
                                      detalle.fecha
                                    )}
                                  </td>

                                  <td style={td}>
                                    {detalle.descripcion}
                                  </td>

                                  <td style={td}>
                                    {detalle.orden}
                                  </td>

                                  <td style={td}>
                                    {detalle.proceso}
                                  </td>

                                  <td style={td}>
                                    {formatearDuracion(
                                      detalle.minutos
                                    )}
                                  </td>

                                  <td style={td}>
                                    $
                                    {detalle.tarifa.toFixed(
                                      2
                                    )}
                                  </td>

                                  <td style={td}>
                                    <strong>
                                      $
                                      {detalle.total.toFixed(
                                        2
                                      )}
                                    </strong>
                                  </td>
                                </tr>
                              )
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </section>

      <section style={card}>
        <h2>🔒 Cierre semanal</h2>

        <p>
          Solo se pagarán los bultos entregados y los
          trabajos por hora finalizados.
        </p>

        <div style={avisoPendientes}>
          Los bultos que no se hayan entregado conservarán
          su asignación y se pagarán cuando sean terminados.
        </div>

        <div style={avisoInformativoCierre}>
          Los adeudos aparecen como información, pero en esta
          etapa todavía no serán descontados al cerrar la
          semana.
        </div>

        <button
          onClick={cerrarSemana}
          disabled={
            cerrando ||
            nominaPorEmpleado.length === 0
          }
          style={{
            ...botonCerrar,
            opacity:
              cerrando ||
              nominaPorEmpleado.length === 0
                ? 0.6
                : 1,
          }}
        >
          {cerrando
            ? "Cerrando semana..."
            : `🔒 Cerrar semana por $${totales.bruto.toFixed(
                2
              )}`}
        </button>
      </section>

      <section style={card}>
        <h2>📚 Historial de semanas</h2>

        {historial.length === 0 && (
          <p>
            Todavía no hay semanas cerradas.
          </p>
        )}

        {historial.map((semana) => {
          const abierta =
            semanaHistorialAbierta === semana.id;

          return (
            <div
              key={semana.id}
              style={historialCard}
            >
              <button
                type="button"
                onClick={() =>
                  setSemanaHistorialAbierta(
                    abierta ? null : semana.id
                  )
                }
                style={botonHistorial}
              >
                <div style={{ textAlign: "left" }}>
                  <strong>
                    Semana del{" "}
                    {formatearSoloFecha(
                      semana.fecha_inicio
                    )}
                  </strong>

                  <small style={{ display: "block" }}>
                    Cerrada:{" "}
                    {formatearFecha(
                      semana.fecha_cierre
                    )}
                  </small>
                </div>

                <div style={{ textAlign: "right" }}>
                  <strong style={{ fontSize: 18 }}>
                    $
                    {Number(
                      semana.total_nomina || 0
                    ).toFixed(2)}
                  </strong>

                  <small style={{ display: "block" }}>
                    {semana.nomina_semanal_detalle
                      ?.length || 0}{" "}
                    trabajadores
                  </small>
                </div>
              </button>

              {abierta && (
                <div style={{ padding: 15 }}>
                  {(
                    semana.nomina_semanal_detalle ||
                    []
                  ).map((detalle) => {
                    const bruto =
                      Number(detalle.pago_bruto || 0) ||
                      Number(detalle.total_pago || 0);

                    const descuento = Number(
                      detalle.descuento_adeudo || 0
                    );

                    const neto =
                      Number(detalle.total_neto || 0) ||
                      Number(detalle.total_pago || 0);

                    return (
                      <div
                        key={detalle.id}
                        style={filaHistorial}
                      >
                        <div>
                          <strong>
                            {detalle.empleados?.alias ||
                              detalle.empleados
                                ?.nombre}
                          </strong>

                          <small
                            style={{
                              display: "block",
                            }}
                          >
                            {detalle.empleados?.puesto ||
                              "Sin puesto"}
                          </small>
                        </div>

                        <div
                          style={{ textAlign: "right" }}
                        >
                          <small>
                            Pasos: $
                            {Number(
                              detalle.pago_pieza ||
                                0
                            ).toFixed(2)}
                          </small>

                          <small
                            style={{
                              display: "block",
                            }}
                          >
                            Horas: $
                            {Number(
                              detalle.pago_hora ||
                                0
                            ).toFixed(2)}
                          </small>

                          <small
                            style={{
                              display: "block",
                            }}
                          >
                            Bruto: $
                            {bruto.toFixed(2)}
                          </small>

                          {descuento > 0 && (
                            <small
                              style={{
                                display: "block",
                                color: "#b91c1c",
                              }}
                            >
                              Descuento: -$
                              {descuento.toFixed(2)}
                            </small>
                          )}

                          <strong>
                            Neto: ${neto.toFixed(2)}
                          </strong>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
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

const encabezadoSemana = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 15,
  flexWrap: "wrap",
};

const estadoAbierto = {
  background: "#dcfce7",
  color: "#166534",
  padding: "10px 14px",
  borderRadius: 999,
  fontWeight: "bold",
};

const resumenGeneral = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 15,
  marginBottom: 20,
};

const tarjetaResumen = {
  background: "white",
  padding: 18,
  borderRadius: 12,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  display: "grid",
  gap: 6,
};

const tarjetaResumenAdeudo = {
  ...tarjetaResumen,
  background: "#fef3c7",
  color: "#92400e",
};

const tarjetaResumenDestacada = {
  ...tarjetaResumen,
  background: "#166534",
  color: "white",
};

const avisoInformativo = {
  background: "#dbeafe",
  color: "#1e3a8a",
  padding: 14,
  borderRadius: 10,
  marginBottom: 20,
};

const empleadoCard = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  marginBottom: 12,
  overflow: "hidden",
};

const botonEmpleado = {
  width: "100%",
  padding: 15,
  background: "#f9fafb",
  border: "none",
  cursor: "pointer",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 15,
  flexWrap: "wrap",
};

const totalesEmpleado = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  flexWrap: "wrap",
};

const totalBrutoEmpleado = {
  background: "#e5e7eb",
  color: "#111827",
  padding: "8px 12px",
  borderRadius: 8,
  fontWeight: "bold",
};

const adeudoEmpleado = {
  background: "#fee2e2",
  color: "#b91c1c",
  padding: "8px 12px",
  borderRadius: 8,
  fontWeight: "bold",
};

const netoEmpleado = {
  background: "#dcfce7",
  color: "#166534",
  padding: "8px 12px",
  borderRadius: 8,
  fontWeight: "bold",
};

const detalleEmpleado = {
  padding: 15,
};

const metricasEmpleado = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 12,
  marginBottom: 20,
};

const metricaCaja = {
  display: "grid",
  gap: 5,
  background: "#f9fafb",
  border: "1px solid #e5e7eb",
  padding: 12,
  borderRadius: 10,
};

const tabla = {
  width: "100%",
  borderCollapse: "collapse",
  marginBottom: 20,
};

const th = {
  padding: 10,
  textAlign: "left",
  borderBottom: "2px solid #e5e7eb",
  whiteSpace: "nowrap",
};

const td = {
  padding: 10,
  borderBottom: "1px solid #e5e7eb",
  whiteSpace: "nowrap",
};

const avisoPendientes = {
  background: "#fef3c7",
  color: "#92400e",
  padding: 12,
  borderRadius: 10,
  marginBottom: 15,
};

const avisoInformativoCierre = {
  background: "#dbeafe",
  color: "#1e3a8a",
  padding: 12,
  borderRadius: 10,
  marginBottom: 15,
};

const botonCerrar = {
  padding: "14px 20px",
  background: "#dc2626",
  color: "white",
  border: "none",
  borderRadius: 10,
  fontWeight: "bold",
  cursor: "pointer",
  fontSize: 16,
};

const alerta = {
  background: "#dcfce7",
  color: "#166534",
  padding: 12,
  borderRadius: 10,
  marginBottom: 15,
  fontWeight: "bold",
};

const sinRegistros = {
  background: "#f3f4f6",
  padding: 20,
  borderRadius: 10,
  textAlign: "center",
};

const historialCard = {
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  marginBottom: 10,
  overflow: "hidden",
};

const botonHistorial = {
  width: "100%",
  padding: 15,
  background: "#f9fafb",
  border: "none",
  cursor: "pointer",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 15,
};

const filaHistorial = {
  padding: 12,
  borderBottom: "1px solid #eee",
  display: "flex",
  justifyContent: "space-between",
  gap: 15,
};