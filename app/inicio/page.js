"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function InicioPage() {
  const [ordenes, setOrdenes] = useState([]);
  const [asignacionesPendientes, setAsignacionesPendientes] = useState([]);
  const [asignacionesTerminadas, setAsignacionesTerminadas] = useState([]);
  const [trabajosActivos, setTrabajosActivos] = useState([]);
  const [trabajosTerminados, setTrabajosTerminados] = useState([]);
  const [empleados, setEmpleados] = useState([]);

  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");

  useEffect(() => {
    cargarCentroInteligencia();
  }, []);

  async function cargarCentroInteligencia() {
    setCargando(true);
    setErrorCarga("");

    try {
      const [
        respuestaOrdenes,
        respuestaPendientes,
        respuestaTerminadas,
        respuestaTiempoActivo,
        respuestaTiempoTerminado,
        respuestaEmpleados,
      ] = await Promise.all([
        supabase
          .from("ordenes")
          .select(`
            id,
            folio,
            cliente,
            estado,
            modelo_id,
            modelos(id,codigo,nombre,precio_cliente)
          `)
          .neq("estado", "Terminada")
          .order("id", { ascending: false }),

        supabase
          .from("asignaciones")
          .select(`
            id,
            empleado_id,
            orden_id,
            proceso_id,
            orden_bulto_id,
            estado,
            empleados(id,nombre,alias,puesto),
            modelo_procesos(id,nombre,costo),
            orden_bultos_v2(
              id,
              nombre_bulto,
              talla,
              cantidad
            ),
            ordenes(
              id,
              folio,
              cliente,
              modelos(id,codigo,nombre)
            )
          `)
          .eq("estado", "Asignado")
          .order("id", { ascending: false }),

        supabase
          .from("asignaciones")
          .select(`
            id,
            empleado_id,
            fecha_terminado,
            semana_nomina_id,
            empleados(id,nombre,alias,puesto),
            modelo_procesos(id,nombre,costo),
            orden_bultos_v2(
              id,
              nombre_bulto,
              talla,
              cantidad
            ),
            ordenes(
              id,
              folio,
              cliente,
              modelos(id,codigo,nombre)
            )
          `)
          .eq("estado", "Terminado")
          .is("semana_nomina_id", null)
          .order("fecha_terminado", { ascending: false }),

        supabase
          .from("trabajos_tiempo")
          .select(`
            id,
            empleado_id,
            descripcion,
            tarifa_hora,
            fecha_inicio,
            estado,
            empleados(id,nombre,alias,puesto),
            modelo_procesos(id,nombre),
            ordenes(
              id,
              folio,
              modelos(id,codigo,nombre)
            )
          `)
          .eq("estado", "Trabajando")
          .order("fecha_inicio", { ascending: true }),

        supabase
          .from("trabajos_tiempo")
          .select(`
            id,
            empleado_id,
            descripcion,
            fecha_fin,
            minutos_trabajados,
            total_pago,
            semana_id,
            empleados(id,nombre,alias,puesto),
            modelo_procesos(id,nombre),
            ordenes(
              id,
              folio,
              modelos(id,codigo,nombre)
            )
          `)
          .eq("estado", "Terminado")
          .is("semana_id", null)
          .order("fecha_fin", { ascending: false }),

        supabase
          .from("empleados")
          .select("id,nombre,alias,puesto,activo")
          .eq("activo", true)
          .order("nombre"),
      ]);

      const respuestas = [
        respuestaOrdenes,
        respuestaPendientes,
        respuestaTerminadas,
        respuestaTiempoActivo,
        respuestaTiempoTerminado,
        respuestaEmpleados,
      ];

      const respuestaConError = respuestas.find(
        (respuesta) => respuesta.error
      );

      if (respuestaConError?.error) {
        throw respuestaConError.error;
      }

      setOrdenes(respuestaOrdenes.data || []);
      setAsignacionesPendientes(respuestaPendientes.data || []);
      setAsignacionesTerminadas(respuestaTerminadas.data || []);
      setTrabajosActivos(respuestaTiempoActivo.data || []);
      setTrabajosTerminados(respuestaTiempoTerminado.data || []);
      setEmpleados(respuestaEmpleados.data || []);
    } catch (error) {
      console.error(error);
      setErrorCarga(
        error.message || "No se pudo cargar el Centro de Inteligencia"
      );
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

  function minutosDesde(fecha) {
    if (!fecha) return 0;

    return Math.max(
      0,
      Math.floor(
        (Date.now() - new Date(fecha).getTime()) / 60000
      )
    );
  }

  function formatearDuracion(minutos) {
    const total = Number(minutos || 0);
    const horas = Math.floor(total / 60);
    const restantes = total % 60;

    if (horas === 0) {
      return `${restantes} min`;
    }

    return `${horas} h ${restantes} min`;
  }

  function formatearDinero(valor) {
    return Number(valor || 0).toLocaleString("es-MX", {
      style: "currency",
      currency: "MXN",
    });
  }

  function formatearFecha(fecha) {
    if (!fecha) return "—";

    return new Date(fecha).toLocaleString("es-MX", {
      dateStyle: "short",
      timeStyle: "short",
    });
  }

  const resumen = useMemo(() => {
    const pasosHoy = asignacionesTerminadas.filter((registro) =>
      esHoy(registro.fecha_terminado)
    );

    const horasHoy = trabajosTerminados.filter((registro) =>
      esHoy(registro.fecha_fin)
    );

    const pagoPasosSemana = asignacionesTerminadas.reduce(
      (total, registro) => total + calcularPagoPaso(registro),
      0
    );

    const pagoHorasSemana = trabajosTerminados.reduce(
      (total, registro) =>
        total + Number(registro.total_pago || 0),
      0
    );

    const pagoPasosHoy = pasosHoy.reduce(
      (total, registro) => total + calcularPagoPaso(registro),
      0
    );

    const pagoHorasHoy = horasHoy.reduce(
      (total, registro) =>
        total + Number(registro.total_pago || 0),
      0
    );

    const empleadosConActividad = new Set();

    asignacionesPendientes.forEach((registro) => {
      empleadosConActividad.add(registro.empleado_id);
    });

    trabajosActivos.forEach((registro) => {
      empleadosConActividad.add(registro.empleado_id);
    });

    return {
      ordenesAbiertas: ordenes.length,
      bultosPendientes: asignacionesPendientes.length,
      bultosTerminadosHoy: pasosHoy.length,
      trabajosHoraActivos: trabajosActivos.length,
      empleadosActivos: empleadosConActividad.size,
      empleadosRegistrados: empleados.length,
      pagoPasosSemana,
      pagoHorasSemana,
      nominaSemana: pagoPasosSemana + pagoHorasSemana,
      pagoHoy: pagoPasosHoy + pagoHorasHoy,
    };
  }, [
    ordenes,
    asignacionesPendientes,
    asignacionesTerminadas,
    trabajosActivos,
    trabajosTerminados,
    empleados,
  ]);

  const ranking = useMemo(() => {
    const mapa = new Map();

    function obtenerEmpleado(registro) {
      const id = Number(registro.empleado_id);
      const persona = registro.empleados;

      if (!mapa.has(id)) {
        mapa.set(id, {
          empleadoId: id,
          nombre:
            persona?.alias ||
            persona?.nombre ||
            `Empleado ${id}`,
          pagoPasos: 0,
          pagoHoras: 0,
          total: 0,
          bultos: 0,
          trabajosHora: 0,
        });
      }

      return mapa.get(id);
    }

    asignacionesTerminadas.forEach((registro) => {
      const empleado = obtenerEmpleado(registro);
      const pago = calcularPagoPaso(registro);

      empleado.pagoPasos += pago;
      empleado.total += pago;
      empleado.bultos += 1;
    });

    trabajosTerminados.forEach((registro) => {
      const empleado = obtenerEmpleado(registro);
      const pago = Number(registro.total_pago || 0);

      empleado.pagoHoras += pago;
      empleado.total += pago;
      empleado.trabajosHora += 1;
    });

    return [...mapa.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [asignacionesTerminadas, trabajosTerminados]);

  const procesosDestacados = useMemo(() => {
    const mapa = new Map();

    asignacionesTerminadas.forEach((registro) => {
      const nombre =
        registro.modelo_procesos?.nombre || "Sin proceso";

      if (!mapa.has(nombre)) {
        mapa.set(nombre, {
          proceso: nombre,
          bultos: 0,
          unidadesProcesadas: 0,
          pagoGenerado: 0,
        });
      }

      const proceso = mapa.get(nombre);

      proceso.bultos += 1;
      proceso.unidadesProcesadas += Number(
        registro.orden_bultos_v2?.cantidad || 0
      );
      proceso.pagoGenerado += calcularPagoPaso(registro);
    });

    return [...mapa.values()]
      .sort((a, b) => b.pagoGenerado - a.pagoGenerado)
      .slice(0, 5);
  }, [asignacionesTerminadas]);

  const alertas = useMemo(() => {
    const lista = [];

    if (asignacionesPendientes.length > 0) {
      lista.push({
        nivel: "amarillo",
        titulo: `${asignacionesPendientes.length} bultos continúan asignados`,
        descripcion:
          "Estos bultos todavía no han sido entregados y no se incluyen en la nómina.",
      });
    }

    trabajosActivos.forEach((trabajo) => {
      const minutos = minutosDesde(trabajo.fecha_inicio);

      if (minutos >= 240) {
        lista.push({
          nivel: "rojo",
          titulo: `${
            trabajo.empleados?.alias ||
            trabajo.empleados?.nombre
          } lleva ${formatearDuracion(minutos)} por tiempo`,
          descripcion:
            trabajo.descripcion ||
            "Trabajo por hora actualmente activo.",
        });
      }
    });

    if (ordenes.length > 0) {
      lista.push({
        nivel: "azul",
        titulo: `${ordenes.length} órdenes siguen abiertas`,
        descripcion:
          "Consulta Estado de órdenes para revisar el avance de cada corte.",
      });
    }

    if (
      asignacionesPendientes.length === 0 &&
      trabajosActivos.length === 0
    ) {
      lista.push({
        nivel: "verde",
        titulo: "No hay trabajo pendiente registrado",
        descripcion:
          "Actualmente no hay bultos asignados ni trabajos por hora activos.",
      });
    }

    return lista.slice(0, 8);
  }, [asignacionesPendientes, trabajosActivos, ordenes]);

  const saludTaller = useMemo(() => {
    const produccion =
      resumen.bultosPendientes <= 10 ? "verde" : "amarillo";

    const tiempo =
      trabajosActivos.some(
        (trabajo) => minutosDesde(trabajo.fecha_inicio) >= 240
      )
        ? "rojo"
        : trabajosActivos.length > 0
        ? "amarillo"
        : "verde";

    const nomina =
      resumen.nominaSemana > 0 ? "verde" : "amarillo";

    const ordenesEstado =
      ordenes.length <= 5 ? "verde" : "amarillo";

    return [
      {
        nombre: "Producción",
        nivel: produccion,
        texto:
          resumen.bultosPendientes === 0
            ? "Sin bultos pendientes"
            : `${resumen.bultosPendientes} bultos pendientes`,
      },
      {
        nombre: "Trabajos por hora",
        nivel: tiempo,
        texto:
          resumen.trabajosHoraActivos === 0
            ? "Sin cronómetros activos"
            : `${resumen.trabajosHoraActivos} activos`,
      },
      {
        nombre: "Nómina",
        nivel: nomina,
        texto: formatearDinero(resumen.nominaSemana),
      },
      {
        nombre: "Órdenes",
        nivel: ordenesEstado,
        texto: `${resumen.ordenesAbiertas} abiertas`,
      },
    ];
  }, [resumen, trabajosActivos, ordenes]);

  if (cargando) {
    return <h2>Cargando Centro de Inteligencia...</h2>;
  }

  return (
    <div>
      <div style={encabezado}>
        <div>
          <h1 style={{ marginBottom: 4 }}>
            🧠 Centro de Inteligencia
          </h1>

          <p style={{ marginTop: 0, color: "#6b7280" }}>
            Resumen operativo del taller en tiempo real
          </p>
        </div>

        <button
          type="button"
          onClick={cargarCentroInteligencia}
          style={botonActualizar}
        >
          🔄 Actualizar
        </button>
      </div>

      {errorCarga && (
        <div style={alertaError}>
          <strong>No se pudo cargar toda la información.</strong>
          <br />
          {errorCarga}
        </div>
      )}

      <section style={gridPrincipal}>
        <Card
          titulo="📦 Órdenes abiertas"
          valor={resumen.ordenesAbiertas}
          texto="Cortes actualmente en producción"
        />

        <Card
          titulo="🧵 Bultos terminados hoy"
          valor={resumen.bultosTerminadosHoy}
          texto="Pasos entregados durante el día"
        />

        <Card
          titulo="👷 Trabajadores con actividad"
          valor={resumen.empleadosActivos}
          texto={`${resumen.empleadosRegistrados} empleados activos registrados`}
        />

        <Card
          titulo="⏱ Trabajos por hora activos"
          valor={resumen.trabajosHoraActivos}
          texto="Cronómetros actualmente corriendo"
        />

        <Card
          titulo="💵 Generado hoy"
          valor={formatearDinero(resumen.pagoHoy)}
          texto="Pago por pasos y por tiempo"
        />

        <Card
          titulo="💰 Nómina acumulada"
          valor={formatearDinero(resumen.nominaSemana)}
          texto={`Pasos ${formatearDinero(
            resumen.pagoPasosSemana
          )} · Horas ${formatearDinero(
            resumen.pagoHorasSemana
          )}`}
          destacada
        />

        <Card
          titulo="🟡 Bultos pendientes"
          valor={resumen.bultosPendientes}
          texto="Asignados, pero todavía no entregados"
        />
      </section>

      <section style={card}>
        <h2>🏭 Salud del taller</h2>

        <div style={saludGrid}>
          {saludTaller.map((indicador) => (
            <div
              key={indicador.nombre}
              style={{
                ...saludCard,
                borderLeft: `6px solid ${colorNivel(
                  indicador.nivel
                )}`,
              }}
            >
              <strong>{indicador.nombre}</strong>
              <span>{indicador.texto}</span>
            </div>
          ))}
        </div>
      </section>

      <section style={dosColumnas}>
        <div style={card}>
          <h2>⚠ Alertas importantes</h2>

          {alertas.map((alerta, index) => (
            <div
              key={`${alerta.titulo}-${index}`}
              style={{
                ...alertaCard,
                borderLeft: `6px solid ${colorNivel(
                  alerta.nivel
                )}`,
              }}
            >
              <strong>{alerta.titulo}</strong>
              <small>{alerta.descripcion}</small>
            </div>
          ))}
        </div>

        <div style={card}>
          <h2>🏆 Productividad semanal</h2>

          <p style={{ color: "#6b7280" }}>
            Ranking por pago generado en pasos y trabajos por hora.
          </p>

          {ranking.length === 0 && (
            <p>Todavía no hay trabajos terminados esta semana.</p>
          )}

          {ranking.map((empleado, index) => (
            <div key={empleado.empleadoId} style={rankingFila}>
              <div style={posicionRanking}>{index + 1}</div>

              <div style={{ flex: 1 }}>
                <strong>{empleado.nombre}</strong>

                <small style={{ display: "block" }}>
                  {empleado.bultos} bultos procesados ·{" "}
                  {empleado.trabajosHora} trabajos por hora
                </small>
              </div>

              <div style={{ textAlign: "right" }}>
                <strong>{formatearDinero(empleado.total)}</strong>

                <small style={{ display: "block" }}>
                  Pasos: {formatearDinero(empleado.pagoPasos)}
                </small>

                <small style={{ display: "block" }}>
                  Horas: {formatearDinero(empleado.pagoHoras)}
                </small>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={dosColumnas}>
        <div style={card}>
          <h2>🧵 Procesos con mayor pago generado</h2>

          {procesosDestacados.length === 0 && (
            <p>Todavía no hay procesos terminados esta semana.</p>
          )}

          {procesosDestacados.map((proceso, index) => (
            <div key={proceso.proceso} style={procesoFila}>
              <div>
                <strong>
                  {index + 1}. {proceso.proceso}
                </strong>

                <small style={{ display: "block" }}>
                  {proceso.bultos} bultos ·{" "}
                  {proceso.unidadesProcesadas} unidades procesadas
                  dentro del paso
                </small>
              </div>

              <strong>
                {formatearDinero(proceso.pagoGenerado)}
              </strong>
            </div>
          ))}
        </div>

        <div style={card}>
          <h2>⏱ Trabajos por hora activos</h2>

          {trabajosActivos.length === 0 && (
            <p>No hay trabajos por hora activos.</p>
          )}

          {trabajosActivos.map((trabajo) => {
            const minutos = minutosDesde(trabajo.fecha_inicio);

            return (
              <div key={trabajo.id} style={trabajoActivoCard}>
                <div>
                  <strong>
                    {trabajo.empleados?.alias ||
                      trabajo.empleados?.nombre}
                  </strong>

                  <small style={{ display: "block" }}>
                    {trabajo.descripcion}
                  </small>

                  <small style={{ display: "block" }}>
                    Inicio: {formatearFecha(trabajo.fecha_inicio)}
                  </small>
                </div>

                <div style={{ textAlign: "right" }}>
                  <strong>{formatearDuracion(minutos)}</strong>

                  <small style={{ display: "block" }}>
                    {formatearDinero(trabajo.tarifa_hora)} por hora
                  </small>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section style={card}>
        <h2>⚡ Accesos rápidos</h2>

        <div style={accesosGrid}>
          <Acceso
            href="/asignaciones"
            titulo="📋 Asignar trabajo"
          />

          <Acceso
            href="/entrega"
            titulo="✅ Registrar entrega"
          />

          <Acceso
            href="/nomina"
            titulo="💵 Revisar nómina"
          />

          <Acceso
            href="/perfil-empleado"
            titulo="👤 Ver perfil empleado"
          />

          <Acceso
            href="/ordenes"
            titulo="📦 Ver órdenes"
          />

          <Acceso
            href="/buscar-bulto"
            titulo="🔎 Buscar bulto"
          />
        </div>
      </section>
    </div>
  );
}

function Card({ titulo, valor, texto, destacada = false }) {
  return (
    <div
      style={{
        ...tarjetaPrincipal,
        ...(destacada ? tarjetaDestacada : {}),
      }}
    >
      <small>{titulo}</small>
      <strong style={{ fontSize: 28 }}>{valor}</strong>
      <span style={{ fontSize: 13, opacity: 0.82 }}>{texto}</span>
    </div>
  );
}

function Acceso({ href, titulo }) {
  return (
    <Link href={href} style={accesoRapido}>
      {titulo}
    </Link>
  );
}

function colorNivel(nivel) {
  const colores = {
    verde: "#16a34a",
    amarillo: "#f59e0b",
    rojo: "#dc2626",
    azul: "#2563eb",
  };

  return colores[nivel] || "#6b7280";
}

const encabezado = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 15,
  flexWrap: "wrap",
  marginBottom: 20,
};

const botonActualizar = {
  padding: "10px 14px",
  border: "none",
  borderRadius: 8,
  background: "#2563eb",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
};

const gridPrincipal = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(210px, 1fr))",
  gap: 15,
  marginBottom: 20,
};

const tarjetaPrincipal = {
  background: "white",
  padding: 18,
  borderRadius: 12,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  display: "grid",
  gap: 8,
};

const tarjetaDestacada = {
  background: "#166534",
  color: "white",
};

const card = {
  background: "white",
  padding: 20,
  borderRadius: 12,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  marginBottom: 20,
};

const dosColumnas = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(340px, 1fr))",
  gap: 20,
};

const saludGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(190px, 1fr))",
  gap: 12,
};

const saludCard = {
  display: "grid",
  gap: 6,
  padding: 14,
  background: "#f9fafb",
  borderRadius: 8,
};

const alertaCard = {
  display: "grid",
  gap: 5,
  padding: 13,
  marginBottom: 10,
  borderRadius: 8,
  background: "#f9fafb",
};

const rankingFila = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "12px 0",
  borderBottom: "1px solid #eee",
};

const posicionRanking = {
  width: 34,
  height: 34,
  borderRadius: "50%",
  background: "#e5e7eb",
  display: "grid",
  placeItems: "center",
  fontWeight: "bold",
};

const procesoFila = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 15,
  padding: "12px 0",
  borderBottom: "1px solid #eee",
};

const trabajoActivoCard = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 15,
  padding: 13,
  marginBottom: 10,
  background: "#f0fdf4",
  border: "1px solid #bbf7d0",
  borderRadius: 10,
};

const accesosGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
};

const accesoRapido = {
  padding: 14,
  borderRadius: 10,
  background: "#1f2937",
  color: "white",
  textDecoration: "none",
  fontWeight: "bold",
  textAlign: "center",
};

const alertaError = {
  background: "#fee2e2",
  color: "#991b1b",
  padding: 14,
  borderRadius: 10,
  marginBottom: 20,
};