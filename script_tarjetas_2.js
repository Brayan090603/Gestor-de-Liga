const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://uzmoubiomubvthayvweu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6bW91YmlvbXVidnRoYXl2d2V1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MTcwNzIsImV4cCI6MjA5Nzk5MzA3Mn0.9QDAThCpnG-Xaq2UTCLilIUOIrVMjtyXJd9owMYPCVQ';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const dataToInsert = [
    { nombre: "Héctor Enoc Olivas Blandon", amarillas: 2 },
    { nombre: "Joni Antonio Gonzales H", amarillas: 2 },
    { nombre: "Eliuth José García Espinoza", amarillas: 2 },
    { nombre: "Edgardo Josué Pastrana Vallecillo", amarillas: 2 },
    { nombre: "José Alexander Ávila Rosales", amarillas: 2 },
    { nombre: "Yerald Alcides Gomez Vallecillo", amarillas: 2 },
    { nombre: "Wilmer Noe Rivera Córdoba", amarillas: 2 },
    { nombre: "José Daniel Centeno Bustamante", amarillas: 2 },
    { nombre: "Jaime Ramón Calero Rivas", amarillas: 2 },
    { nombre: "Howard Jair Pineda Acuña", amarillas: 2 },
    { nombre: "Raul Antonio Córdoba Castillo", amarillas: 2 },
    { nombre: "Cerling Antonio Balladares Tercero", amarillas: 2 },
    { nombre: "Lester Saúl Córdoba Calderon", amarillas: 2 },
    { nombre: "Freddy Javier Joya López", amarillas: 2 },
    { nombre: "Javier Saúl Pastrana Villareyna", amarillas: 2 },
    { nombre: "Santiago José González Rosales", amarillas: 2 },
    { nombre: "Wilder Alfredo Loza Morales", amarillas: 2 },
    { nombre: "Eduard Yassir Cruz Molina", amarillas: 2 },
    { nombre: "Fransisco Ramón Acuña Acuña", amarillas: 2 },
    { nombre: "Édgar Abel Huete González", amarillas: 2 },
    { nombre: "Andy Josué Cruz Moreno", amarillas: 2 },
    { nombre: "Josué Ronaldo Palma Espinoza", amarillas: 2 },
    { nombre: "Norman Adiac Escoto Gutiérrez", amarillas: 2 },
    { nombre: "Ángel Alberto Zelaya Córdoba", amarillas: 2 },
    { nombre: "Elthon Jassiel García González", amarillas: 2 },
    { nombre: "Alvaro Efrén González Hernández", amarillas: 2 },

    { nombre: "David Guadalupe Joya Muñoz", amarillas: 1 },
    { nombre: "Franklin Adali Olivas Cruz", amarillas: 1 },
    { nombre: "Héctor José Joya González", amarillas: 1 },
    { nombre: "Leonel Yamil Olivas Sevilla", amarillas: 1 },
    { nombre: "Melvin Ismael Zelaya Córdoba", amarillas: 1 },
    { nombre: "Norman Ernesto Urbina Olivas", amarillas: 1 },
    { nombre: "Oscar Alexander Mayorga Olivas", amarillas: 1 },
    { nombre: "Jorge Isaac Rivera Contreras", amarillas: 1 },
    { nombre: "Cristopher Esteban Hernandez Molina", amarillas: 1 },
    { nombre: "Junior Missael Morales Loza", amarillas: 1 },
    { nombre: "Dariel José López Davila", amarillas: 1 },
    { nombre: "Jonan Eliuth Rivas Hernández", amarillas: 1 },
    { nombre: "Gabriel Alejandro García Carrasco", amarillas: 1 },
    { nombre: "Norvin José Córdoba Davila", amarillas: 1 },
    { nombre: "Yeinier Antonio Acuña Olivas", amarillas: 1 },
    { nombre: "Fransisco Antonio Paz Flores", amarillas: 1 },
    { nombre: "Zaudiel José Pastrana Zelaya", amarillas: 1 },
    { nombre: "Jimmy Antony Espinoza Lopez", amarillas: 1 },
    { nombre: "José Adalberto Olivas Molina", amarillas: 1 },
    { nombre: "Wilder Josué Pérez Lopez", amarillas: 1 },
    { nombre: "Oneyser De Jesús López Rosales", amarillas: 1 },
    { nombre: "Magdiell Jassael Calero Avila", amarillas: 1 },
    { nombre: "Carlos Antonio Torres Zamora", amarillas: 1 },
    { nombre: "Devis Dijen Cruz Cruz", amarillas: 1 }
];

async function run() {
    console.log("Cargando jugadores...");
    const { data: jugadores, error: errJug } = await supabase.from('jugadores').select('*');
    if (errJug) { console.error(errJug); return; }

    const updates = [];
    const partidosToInsert = [];

    const activeId = "da2f17be-512c-497f-94d3-1c0caab92a88"; // asumiendo que este es el torneo actual

    for (const item of dataToInsert) {
        // Encontrar al jugador
        const jugador = jugadores.find(j => j.nombre.trim().toLowerCase() === item.nombre.trim().toLowerCase());
        
        if (!jugador) {
            console.log("No se encontró al jugador: " + item.nombre);
            continue;
        }

        // Actualizar estadísticas de clausura
        const actualAmarillas = jugador.stats_clausura_amarillas || 0;
        const faltan = item.amarillas;

        jugador.stats_clausura_amarillas = actualAmarillas + faltan;
        
        updates.push({
            id: jugador.id,
            equipo_id: jugador.equipo_id,
            nombre: jugador.nombre,
            stats_clausura_amarillas: jugador.stats_clausura_amarillas
        });

        // Generar partidos falsos
        for (let i = 0; i < faltan; i++) {
            partidosToInsert.push({
                id: Date.now() + "_" + Math.floor(Math.random()*100000) + "_" + jugador.id + "_" + i,
                torneo_id: activeId,
                torneo: 'clausura',
                fase: 'manual',
                jornada: 'Importación Manual',
                equipo1_id: jugador.equipo_id,
                equipo2_id: 'vacante',
                goles1: null,
                goles2: null,
                calendario_nombre: 'Torneo Principal',
                detalles: {
                    estado: 'manual',
                    fechaProgramada: new Date().toISOString().split('T')[0],
                    eventos: [
                        {
                            tipo: 'amarilla',
                            jugadorId: jugador.id,
                            minuto: null
                        }
                    ]
                }
            });
        }
    }

    if (updates.length > 0) {
        console.log(`Subiendo ${updates.length} actualizaciones de jugadores...`);
        const { error: e1 } = await supabase.from('jugadores').upsert(updates);
        if (e1) console.error("Error jugadores:", e1);
    }

    if (partidosToInsert.length > 0) {
        console.log(`Subiendo ${partidosToInsert.length} eventos manuales...`);
        const { error: e2 } = await supabase.from('partidos').upsert(partidosToInsert);
        if (e2) console.error("Error partidos:", e2);
    }

    console.log("¡Proceso completado!");
}

run();
