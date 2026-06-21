"use client";

import { useState } from "react";

export default function Modelos() {
  const [modelos, setModelos] = useState([]);
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");

  function agregarModelo() {
    if (!codigo || !nombre) return;

    setModelos([
      ...modelos,
      {
        codigo,
        nombre,
        descripcion,
        operaciones: [],
      },
    ]);

    setCodigo("");
    setNombre("");
    setDescripcion("");
  }

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-bold mb-6">Modelos</h1>

      <section className="bg-white p-4 rounded-xl shadow mb-6">
        <h2 className="text-xl font-bold mb-4">Crear modelo</h2>

        <input
          className="border p-2 rounded w-full mb-3"
          placeholder="Código del modelo, ejemplo: V-1232"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
        />

        <input
          className="border p-2 rounded w-full mb-3"
          placeholder="Nombre de la prenda"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />

        <textarea
          className="border p-2 rounded w-full mb-3"
          placeholder="Descripción"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
        />

        <button
          onClick={agregarModelo}
          className="bg-black text-white px-4 py-2 rounded"
        >
          Guardar modelo
        </button>
      </section>

      <section className="grid gap-4">
        {modelos.map((modelo, index) => (
          <div key={index} className="bg-white p-4 rounded-xl shadow">
            <h2 className="text-xl font-bold">{modelo.codigo}</h2>
            <p>{modelo.nombre}</p>
            <p className="text-gray-500">{modelo.descripcion}</p>
          </div>
        ))}
      </section>
    </main>
  );
}