/**
 * ====================================================================
 * FEMFUTPAL - MÓDULO DE ALINEACIONES TÁCTICAS Y GENERADOR WHATSAPP
 * Permite seleccionar formaciones (F11, F7, F8, F9), posicionar jugadores
 * interactivamente sobre el campo (Drag & Drop y Tap) y exportar el póster
 * oficial "LINE UP" de alta resolución para compartir en WhatsApp.
 * ====================================================================
 */

(function () {
    // --- DICCIONARIO DE FORMACIONES ---
    const FORMATIONS_DB = {
        11: {
            '4-4-2': [
                { role: 'POR', x: 50, y: 88, name: 'Portero' },
                { role: 'LI',  x: 16, y: 70, name: 'Lateral Izq.' },
                { role: 'DFC', x: 38, y: 72, name: 'Defensa Central' },
                { role: 'DFC', x: 62, y: 72, name: 'Defensa Central' },
                { role: 'LD',  x: 84, y: 70, name: 'Lateral Der.' },
                { role: 'MI',  x: 16, y: 46, name: 'Medio Izq.' },
                { role: 'MC',  x: 38, y: 48, name: 'Mediocentro' },
                { role: 'MC',  x: 62, y: 48, name: 'Mediocentro' },
                { role: 'MD',  x: 84, y: 46, name: 'Medio Der.' },
                { role: 'DC',  x: 36, y: 22, name: 'Delantero' },
                { role: 'DC',  x: 64, y: 22, name: 'Delantero' }
            ],
            '4-3-3': [
                { role: 'POR', x: 50, y: 88, name: 'Portero' },
                { role: 'LI',  x: 16, y: 70, name: 'Lateral Izq.' },
                { role: 'DFC', x: 38, y: 72, name: 'Defensa Central' },
                { role: 'DFC', x: 62, y: 72, name: 'Defensa Central' },
                { role: 'LD',  x: 84, y: 70, name: 'Lateral Der.' },
                { role: 'MC',  x: 30, y: 48, name: 'Mediocentro' },
                { role: 'MCD', x: 50, y: 55, name: 'Pivote' },
                { role: 'MC',  x: 70, y: 48, name: 'Mediocentro' },
                { role: 'EI',  x: 18, y: 24, name: 'Extremo Izq.' },
                { role: 'DC',  x: 50, y: 19, name: 'Delantero' },
                { role: 'ED',  x: 82, y: 24, name: 'Extremo Der.' }
            ],
            '4-2-3-1': [
                { role: 'POR', x: 50, y: 88, name: 'Portero' },
                { role: 'LI',  x: 16, y: 72, name: 'Lateral Izq.' },
                { role: 'DFC', x: 38, y: 74, name: 'Defensa Central' },
                { role: 'DFC', x: 62, y: 74, name: 'Defensa Central' },
                { role: 'LD',  x: 84, y: 72, name: 'Lateral Der.' },
                { role: 'MCD', x: 35, y: 57, name: 'Pivote' },
                { role: 'MCD', x: 65, y: 57, name: 'Pivote' },
                { role: 'MI',  x: 18, y: 38, name: 'Extremo Izq.' },
                { role: 'MCO', x: 50, y: 36, name: 'Mediapunta' },
                { role: 'MD',  x: 82, y: 38, name: 'Extremo Der.' },
                { role: 'DC',  x: 50, y: 19, name: 'Delantero' }
            ],
            '3-5-2': [
                { role: 'POR', x: 50, y: 88, name: 'Portero' },
                { role: 'DFC', x: 24, y: 72, name: 'Defensa Central' },
                { role: 'DFC', x: 50, y: 74, name: 'Defensa Central' },
                { role: 'DFC', x: 76, y: 72, name: 'Defensa Central' },
                { role: 'CAI', x: 14, y: 48, name: 'Carrilero Izq.' },
                { role: 'MC',  x: 32, y: 52, name: 'Mediocentro' },
                { role: 'MC',  x: 50, y: 44, name: 'Mediapunta' },
                { role: 'MC',  x: 68, y: 52, name: 'Mediocentro' },
                { role: 'CAD', x: 86, y: 48, name: 'Carrilero Der.' },
                { role: 'DC',  x: 36, y: 22, name: 'Delantero' },
                { role: 'DC',  x: 64, y: 22, name: 'Delantero' }
            ],
            '3-4-3': [
                { role: 'POR', x: 50, y: 88, name: 'Portero' },
                { role: 'DFC', x: 24, y: 72, name: 'Defensa Central' },
                { role: 'DFC', x: 50, y: 74, name: 'Defensa Central' },
                { role: 'DFC', x: 76, y: 72, name: 'Defensa Central' },
                { role: 'MI',  x: 16, y: 48, name: 'Medio Izq.' },
                { role: 'MC',  x: 38, y: 49, name: 'Mediocentro' },
                { role: 'MC',  x: 62, y: 49, name: 'Mediocentro' },
                { role: 'MD',  x: 84, y: 48, name: 'Medio Der.' },
                { role: 'EI',  x: 18, y: 23, name: 'Extremo Izq.' },
                { role: 'DC',  x: 50, y: 19, name: 'Delantero' },
                { role: 'ED',  x: 82, y: 23, name: 'Extremo Der.' }
            ],
            '4-3-1-2': [
                { role: 'POR', x: 50, y: 88, name: 'Portero' },
                { role: 'LI',  x: 16, y: 73, name: 'Lateral Izq.' },
                { role: 'DFC', x: 38, y: 74, name: 'Defensa Central' },
                { role: 'DFC', x: 62, y: 74, name: 'Defensa Central' },
                { role: 'LD',  x: 84, y: 73, name: 'Lateral Der.' },
                { role: 'MC',  x: 25, y: 55, name: 'Mediocentro' },
                { role: 'MCD', x: 50, y: 58, name: 'Pivote' },
                { role: 'MC',  x: 75, y: 55, name: 'Mediocentro' },
                { role: 'MCO', x: 50, y: 38, name: 'Enganche' },
                { role: 'DC',  x: 36, y: 20, name: 'Delantero' },
                { role: 'DC',  x: 64, y: 20, name: 'Delantero' }
            ],
            '4-5-1': [
                { role: 'POR', x: 50, y: 88, name: 'Portero' },
                { role: 'LI',  x: 16, y: 72, name: 'Lateral Izq.' },
                { role: 'DFC', x: 38, y: 74, name: 'Defensa Central' },
                { role: 'DFC', x: 62, y: 74, name: 'Defensa Central' },
                { role: 'LD',  x: 84, y: 72, name: 'Lateral Der.' },
                { role: 'MI',  x: 14, y: 46, name: 'Medio Izq.' },
                { role: 'MC',  x: 32, y: 49, name: 'Mediocentro' },
                { role: 'MC',  x: 50, y: 45, name: 'Mediocentro' },
                { role: 'MC',  x: 68, y: 49, name: 'Mediocentro' },
                { role: 'MD',  x: 86, y: 46, name: 'Medio Der.' },
                { role: 'DC',  x: 50, y: 20, name: 'Delantero' }
            ],
            '5-3-2': [
                { role: 'POR', x: 50, y: 88, name: 'Portero' },
                { role: 'LI',  x: 14, y: 70, name: 'Lateral Izq.' },
                { role: 'DFC', x: 32, y: 73, name: 'Defensa Central' },
                { role: 'DFC', x: 50, y: 74, name: 'Defensa Central' },
                { role: 'DFC', x: 68, y: 73, name: 'Defensa Central' },
                { role: 'LD',  x: 86, y: 70, name: 'Lateral Der.' },
                { role: 'MC',  x: 28, y: 48, name: 'Mediocentro' },
                { role: 'MC',  x: 50, y: 45, name: 'Mediocentro' },
                { role: 'MC',  x: 72, y: 48, name: 'Mediocentro' },
                { role: 'DC',  x: 36, y: 21, name: 'Delantero' },
                { role: 'DC',  x: 64, y: 21, name: 'Delantero' }
            ],
            '5-4-1': [
                { role: 'POR', x: 50, y: 88, name: 'Portero' },
                { role: 'LI',  x: 14, y: 70, name: 'Lateral Izq.' },
                { role: 'DFC', x: 32, y: 73, name: 'Defensa Central' },
                { role: 'DFC', x: 50, y: 74, name: 'Defensa Central' },
                { role: 'DFC', x: 68, y: 73, name: 'Defensa Central' },
                { role: 'LD',  x: 86, y: 70, name: 'Lateral Der.' },
                { role: 'MI',  x: 16, y: 47, name: 'Medio Izq.' },
                { role: 'MC',  x: 38, y: 48, name: 'Mediocentro' },
                { role: 'MC',  x: 62, y: 48, name: 'Mediocentro' },
                { role: 'MD',  x: 84, y: 47, name: 'Medio Der.' },
                { role: 'DC',  x: 50, y: 20, name: 'Delantero' }
            ]
        },
        7: {
            '2-3-1': [
                { role: 'POR', x: 50, y: 88, name: 'Portero' },
                { role: 'DEF', x: 30, y: 68, name: 'Defensa Izq.' },
                { role: 'DEF', x: 70, y: 68, name: 'Defensa Der.' },
                { role: 'MED', x: 20, y: 44, name: 'Medio Izq.' },
                { role: 'MED', x: 50, y: 46, name: 'Mediocentro' },
                { role: 'MED', x: 80, y: 44, name: 'Medio Der.' },
                { role: 'DEL', x: 50, y: 20, name: 'Delantero' }
            ],
            '3-2-1': [
                { role: 'POR', x: 50, y: 88, name: 'Portero' },
                { role: 'DEF', x: 22, y: 68, name: 'Defensa Izq.' },
                { role: 'DEF', x: 50, y: 70, name: 'Defensa Central' },
                { role: 'DEF', x: 78, y: 68, name: 'Defensa Der.' },
                { role: 'MED', x: 35, y: 45, name: 'Mediocentro' },
                { role: 'MED', x: 65, y: 45, name: 'Mediocentro' },
                { role: 'DEL', x: 50, y: 20, name: 'Delantero' }
            ],
            '2-2-2': [
                { role: 'POR', x: 50, y: 88, name: 'Portero' },
                { role: 'DEF', x: 30, y: 68, name: 'Defensa Izq.' },
                { role: 'DEF', x: 70, y: 68, name: 'Defensa Der.' },
                { role: 'MED', x: 32, y: 45, name: 'Mediocentro' },
                { role: 'MED', x: 68, y: 45, name: 'Mediocentro' },
                { role: 'DEL', x: 35, y: 22, name: 'Delantero' },
                { role: 'DEL', x: 65, y: 22, name: 'Delantero' }
            ],
            '1-3-2': [
                { role: 'POR', x: 50, y: 88, name: 'Portero' },
                { role: 'DEF', x: 50, y: 70, name: 'Defensa Libre' },
                { role: 'MED', x: 22, y: 45, name: 'Medio Izq.' },
                { role: 'MED', x: 50, y: 47, name: 'Mediocentro' },
                { role: 'MED', x: 78, y: 45, name: 'Medio Der.' },
                { role: 'DEL', x: 35, y: 22, name: 'Delantero' },
                { role: 'DEL', x: 65, y: 22, name: 'Delantero' }
            ],
            '3-1-2': [
                { role: 'POR', x: 50, y: 88, name: 'Portero' },
                { role: 'DEF', x: 22, y: 68, name: 'Defensa Izq.' },
                { role: 'DEF', x: 50, y: 70, name: 'Defensa Central' },
                { role: 'DEF', x: 78, y: 68, name: 'Defensa Der.' },
                { role: 'MED', x: 50, y: 46, name: 'Mediocentro' },
                { role: 'DEL', x: 35, y: 22, name: 'Delantero' },
                { role: 'DEL', x: 65, y: 22, name: 'Delantero' }
            ]
        },
        8: {
            '3-3-1': [
                { role: 'POR', x: 50, y: 88, name: 'Portero' },
                { role: 'DEF', x: 24, y: 68, name: 'Defensa Izq.' },
                { role: 'DEF', x: 50, y: 70, name: 'Defensa Central' },
                { role: 'DEF', x: 76, y: 68, name: 'Defensa Der.' },
                { role: 'MED', x: 24, y: 45, name: 'Medio Izq.' },
                { role: 'MED', x: 50, y: 47, name: 'Mediocentro' },
                { role: 'MED', x: 76, y: 45, name: 'Medio Der.' },
                { role: 'DEL', x: 50, y: 20, name: 'Delantero' }
            ],
            '2-4-1': [
                { role: 'POR', x: 50, y: 88, name: 'Portero' },
                { role: 'DEF', x: 32, y: 68, name: 'Defensa Izq.' },
                { role: 'DEF', x: 68, y: 68, name: 'Defensa Der.' },
                { role: 'MED', x: 18, y: 46, name: 'Medio Izq.' },
                { role: 'MED', x: 39, y: 47, name: 'Mediocentro' },
                { role: 'MED', x: 61, y: 47, name: 'Mediocentro' },
                { role: 'MED', x: 82, y: 46, name: 'Medio Der.' },
                { role: 'DEL', x: 50, y: 20, name: 'Delantero' }
            ],
            '3-2-2': [
                { role: 'POR', x: 50, y: 88, name: 'Portero' },
                { role: 'DEF', x: 24, y: 68, name: 'Defensa Izq.' },
                { role: 'DEF', x: 50, y: 70, name: 'Defensa Central' },
                { role: 'DEF', x: 76, y: 68, name: 'Defensa Der.' },
                { role: 'MED', x: 35, y: 46, name: 'Mediocentro' },
                { role: 'MED', x: 65, y: 46, name: 'Mediocentro' },
                { role: 'DEL', x: 35, y: 22, name: 'Delantero' },
                { role: 'DEL', x: 65, y: 22, name: 'Delantero' }
            ]
        },
        9: {
            '3-3-2': [
                { role: 'POR', x: 50, y: 88, name: 'Portero' },
                { role: 'DEF', x: 24, y: 68, name: 'Defensa Izq.' },
                { role: 'DEF', x: 50, y: 70, name: 'Defensa Central' },
                { role: 'DEF', x: 76, y: 68, name: 'Defensa Der.' },
                { role: 'MED', x: 22, y: 46, name: 'Medio Izq.' },
                { role: 'MED', x: 50, y: 48, name: 'Mediocentro' },
                { role: 'MED', x: 78, y: 46, name: 'Medio Der.' },
                { role: 'DEL', x: 35, y: 22, name: 'Delantero' },
                { role: 'DEL', x: 65, y: 22, name: 'Delantero' }
            ],
            '3-4-1': [
                { role: 'POR', x: 50, y: 88, name: 'Portero' },
                { role: 'DEF', x: 24, y: 68, name: 'Defensa Izq.' },
                { role: 'DEF', x: 50, y: 70, name: 'Defensa Central' },
                { role: 'DEF', x: 76, y: 68, name: 'Defensa Der.' },
                { role: 'MED', x: 18, y: 46, name: 'Medio Izq.' },
                { role: 'MED', x: 39, y: 47, name: 'Mediocentro' },
                { role: 'MED', x: 61, y: 47, name: 'Mediocentro' },
                { role: 'MED', x: 82, y: 46, name: 'Medio Der.' },
                { role: 'DEL', x: 50, y: 20, name: 'Delantero' }
            ],
            '4-3-1': [
                { role: 'POR', x: 50, y: 88, name: 'Portero' },
                { role: 'DEF', x: 16, y: 70, name: 'Lateral Izq.' },
                { role: 'DEF', x: 38, y: 72, name: 'Defensa Central' },
                { role: 'DEF', x: 62, y: 72, name: 'Defensa Central' },
                { role: 'DEF', x: 84, y: 70, name: 'Lateral Der.' },
                { role: 'MED', x: 28, y: 47, name: 'Medio Izq.' },
                { role: 'MED', x: 50, y: 49, name: 'Mediocentro' },
                { role: 'MED', x: 72, y: 47, name: 'Medio Der.' },
                { role: 'DEL', x: 50, y: 20, name: 'Delantero' }
            ]
        }
    };

    // --- ESTADO ACTIVO DEL MÓDULO ---
    const tacticalState = {
        matchId: null,
        teamSide: 'local', // 'local' o 'vis'
        numJugadores: 11,
        formacion: '4-4-2',
        titulares: [], // array de IDs de tamaño numJugadores (o null)
        suplentes: [], // array de IDs
        selectedBenchPlayerId: null,
        selectedSlotIndex: null,
        history: [] // para función deshacer
    };

    // Helper para obtener la configuración de posiciones de una formación
    function getFormationSlots(numJugadores, formacionStr) {
        const count = parseInt(numJugadores) || 11;
        const group = FORMATIONS_DB[count] || FORMATIONS_DB[11];
        if (group && group[formacionStr]) {
            return group[formacionStr];
        }
        // Fallback dinámico si la formación no está en el mapa
        return generateDynamicSlots(count, formacionStr);
    }

    function generateDynamicSlots(count, formacionStr) {
        const slots = [{ role: 'POR', x: 50, y: 88, name: 'Portero' }];
        const parts = (formacionStr || '4-4-2').split('-').map(n => parseInt(n) || 1);
        const numRows = parts.length;
        const yStart = 72;
        const yEnd = 20;
        const yStep = numRows > 1 ? (yStart - yEnd) / (numRows - 1) : 0;

        parts.forEach((lineCount, rIdx) => {
            const y = yStart - (rIdx * yStep);
            for (let i = 0; i < lineCount; i++) {
                const x = ((i + 1) / (lineCount + 1)) * 100;
                let role = 'MED';
                if (rIdx === 0) role = 'DEF';
                else if (rIdx === numRows - 1) role = 'DEL';
                slots.push({ role, x: Math.round(x), y: Math.round(y), name: role });
            }
        });
        return slots.slice(0, count);
    }

    // Helper para guardar snapshot en el historial de deshacer
    function pushHistory() {
        if (tacticalState.history.length > 20) tacticalState.history.shift();
        tacticalState.history.push({
            formacion: tacticalState.formacion,
            numJugadores: tacticalState.numJugadores,
            titulares: [...tacticalState.titulares],
            suplentes: [...tacticalState.suplentes]
        });
    }

    // Helper para obtener datos del jugador por ID
    function getPlayer(id) {
        if (!id || !window.appData || !window.appData.jugadores) return null;
        return window.appData.jugadores.find(j => j.id.toString() === id.toString()) || null;
    }

    // Helper infalible para localizar el partido activo
    function findMatch(matchId) {
        const id = matchId || tacticalState.matchId || window.currentLiveMatchId;
        if (window.appData && Array.isArray(window.appData.partidos)) {
            const found = window.appData.partidos.find(p => p.id == id);
            if (found) return found;
        }
        if (window.currentMatch && (!id || window.currentMatch.id == id)) {
            return window.currentMatch;
        }
        if (window.appData && window.appData.torneoActivo && Array.isArray(window.appData.torneoActivo.fases)) {
            for (const f of window.appData.torneoActivo.fases) {
                if (Array.isArray(f.partidos)) {
                    const found = f.partidos.find(p => p.id == id);
                    if (found) return found;
                }
            }
        }
        if (window.appData && Array.isArray(window.appData.partidos) && window.appData.partidos.length > 0) {
            return window.appData.partidos[0];
        }
        return null;
    }

    // Helper para obtener datos del equipo
    function getTeam(side) {
        const match = findMatch(tacticalState.matchId);
        if (!match) return null;
        const teamId = side === 'local' ? (match.equipo1Id || match.equipo1_id) : (match.equipo2Id || match.equipo2_id);
        return window.appData?.equipos?.find(e => e.id == teamId) || null;
    }

    // Nombre corto legible para las fichas (e.g. "JILBER", "YELSIN M.")
    function getShortName(nombre) {
        if (!nombre) return '';
        const parts = nombre.trim().split(/\s+/);
        if (parts.length === 1) return parts[0].toUpperCase();
        return `${parts[0]} ${parts[1].charAt(0)}.`.toUpperCase();
    }

    // --- APERTURA DE LA PIZARRA TÁCTICA ---
    window.openTacticalPitchModal = function (matchId, side = 'local') {
        const match = findMatch(matchId);
        if (!match) return alert("Partido no encontrado.");

        tacticalState.matchId = match.id;
        tacticalState.teamSide = side;
        tacticalState.history = [];
        tacticalState.selectedBenchPlayerId = null;
        tacticalState.selectedSlotIndex = null;

        if (!match.detalles) match.detalles = {};
        if (!match.detalles.alineacionLocal) {
            match.detalles.alineacionLocal = { formacion: '4-4-2', numJugadores: 11, titulares: [], suplentes: [] };
        }
        if (!match.detalles.alineacionVis) {
            match.detalles.alineacionVis = { formacion: '4-4-2', numJugadores: 11, titulares: [], suplentes: [] };
        }

        const alineacion = side === 'local' ? match.detalles.alineacionLocal : match.detalles.alineacionVis;
        tacticalState.numJugadores = alineacion.numJugadores || 11;
        tacticalState.formacion = alineacion.formacion || (tacticalState.numJugadores === 7 ? '2-3-1' : '4-4-2');

        // Obtener jugadores registrados del equipo
        const team = getTeam(side);
        const teamPlayers = window.appData.jugadores.filter(j => j.equipoId === (team ? team.id : null));

        // Normalizar titulares a la cantidad de la formación
        let titulares = Array.isArray(alineacion.titulares) ? [...alineacion.titulares] : [];
        while (titulares.length < tacticalState.numJugadores) {
            titulares.push(null);
        }
        titulares = titulares.slice(0, tacticalState.numJugadores);

        // Suplentes: los que están en la lista guardada o todos los no asignados del equipo
        let suplentes = Array.isArray(alineacion.suplentes) ? [...alineacion.suplentes] : [];
        teamPlayers.forEach(j => {
            if (!titulares.includes(j.id) && !suplentes.includes(j.id)) {
                suplentes.push(j.id);
            }
        });
        // Filtrar jugadores que hayan sido eliminados
        suplentes = suplentes.filter(id => teamPlayers.some(j => j.id === id) && !titulares.includes(id));

        tacticalState.titulares = titulares;
        tacticalState.suplentes = suplentes;

        updateTacticalHeader();
        renderTacticalPitch();
        renderTacticalBench();

        const modal = document.getElementById("modal-tactical-pitch");
        if (modal) modal.classList.add("active");
    };

    // Actualiza logos, nombres y botones del encabezado
    function updateTacticalHeader() {
        const match = findMatch(tacticalState.matchId);
        if (!match) return;

        const teamId1 = match.equipo1Id || match.equipo1_id;
        const teamId2 = match.equipo2Id || match.equipo2_id;
        const local = window.appData?.equipos?.find(e => e.id == teamId1);
        const vis = window.appData?.equipos?.find(e => e.id == teamId2);

        const btnLocal = document.getElementById("btn-toggle-team-local");
        const btnVis = document.getElementById("btn-toggle-team-vis");
        const logoLocal = document.getElementById("tactical-team-logo-local");
        const logoVis = document.getElementById("tactical-team-logo-vis");
        const nameLocal = document.getElementById("tactical-team-name-local");
        const nameVis = document.getElementById("tactical-team-name-vis");

        if (logoLocal && local) logoLocal.src = local.logo || '';
        if (logoVis && vis) logoVis.src = vis.logo || '';
        if (nameLocal && local) nameLocal.innerText = local.nombre || 'Local';
        if (nameVis && vis) nameVis.innerText = vis.nombre || 'Visitante';

        if (btnLocal && btnVis) {
            if (tacticalState.teamSide === 'local') {
                btnLocal.classList.add("active");
                btnVis.classList.remove("active");
            } else {
                btnVis.classList.add("active");
                btnLocal.classList.remove("active");
            }
        }

        const formationLabel = document.getElementById("tactical-current-formation-label");
        if (formationLabel) formationLabel.innerText = tacticalState.formacion;
    }

    // --- RENDERIZADO DEL CAMPO TÁCTICO (IMAGE 2) ---
    function renderTacticalPitch() {
        const container = document.getElementById("pitch-players-layer");
        if (!container) return;

        container.innerHTML = "";
        const slots = getFormationSlots(tacticalState.numJugadores, tacticalState.formacion);

        slots.forEach((slot, index) => {
            const playerId = tacticalState.titulares[index];
            const player = getPlayer(playerId);
            const isGK = index === 0;

            const slotEl = document.createElement("div");
            slotEl.className = `tactical-slot ${player ? 'occupied' : 'empty'} ${isGK ? 'is-gk' : ''}`;
            slotEl.style.left = `${slot.x}%`;
            slotEl.style.top = `${slot.y}%`;
            slotEl.setAttribute("data-slot-index", index);
            slotEl.setAttribute("draggable", player ? "true" : "false");

            let innerHtml = "";
            if (player) {
                const shortName = getShortName(player.nombre || player.name);
                const hasPhoto = !!player.foto;
                const avatarContent = hasPhoto
                    ? `<img src="${player.foto}" class="slot-avatar-img" alt="${shortName}" />`
                    : `<div class="slot-jersey-icon ${isGK ? 'jersey-gk' : 'jersey-field'}"><i class="fa-solid fa-shirt"></i><span class="jersey-num">${player.dorsal || index + 1}</span></div>`;

                innerHtml = `
                    <div class="slot-token ${tacticalState.selectedSlotIndex === index ? 'token-selected' : ''}">
                        <div class="slot-circle ${hasPhoto ? 'has-photo' : 'no-photo'}">
                            ${avatarContent}
                            ${player.dorsal ? `<span class="slot-dorsal-badge">${player.dorsal}</span>` : ''}
                        </div>
                        <div class="slot-name-badge" title="${player.nombre}">${shortName}</div>
                    </div>
                `;
            } else {
                innerHtml = `
                    <div class="slot-token empty-token ${tacticalState.selectedSlotIndex === index ? 'token-selected' : ''}">
                        <div class="slot-circle empty-circle">
                            <i class="fa-solid fa-plus"></i>
                        </div>
                        <div class="slot-name-badge empty-label">${slot.role || 'POS'}</div>
                    </div>
                `;
            }

            slotEl.innerHTML = innerHtml;

            // --- INTERACCIÓN CLICK / TAP ---
            slotEl.addEventListener("click", (e) => {
                e.stopPropagation();
                handleSlotClick(index);
            });

            // --- DRAG & DROP SOPORTE NATIVO ---
            slotEl.addEventListener("dragstart", (e) => {
                e.dataTransfer.setData("text/plain", JSON.stringify({ type: 'slot', index: index }));
                slotEl.classList.add("dragging");
            });

            slotEl.addEventListener("dragend", () => {
                slotEl.classList.remove("dragging");
                document.querySelectorAll(".tactical-slot").forEach(s => s.classList.remove("drag-over"));
            });

            slotEl.addEventListener("dragover", (e) => {
                e.preventDefault();
                slotEl.classList.add("drag-over");
            });

            slotEl.addEventListener("dragleave", () => {
                slotEl.classList.remove("drag-over");
            });

            slotEl.addEventListener("drop", (e) => {
                e.preventDefault();
                slotEl.classList.remove("drag-over");
                try {
                    const data = JSON.parse(e.dataTransfer.getData("text/plain"));
                    handleDropOnSlot(data, index);
                } catch (err) {
                    console.error("Drop error:", err);
                }
            });

            container.appendChild(slotEl);
        });
    }

    // --- RENDERIZADO DEL BANQUILLO / SUPLENTES ---
    function renderTacticalBench() {
        const strip = document.getElementById("tactical-bench-strip");
        const countBadge = document.getElementById("tactical-bench-count");
        if (!strip) return;

        strip.innerHTML = "";
        if (countBadge) countBadge.innerText = tacticalState.suplentes.length;

        if (tacticalState.suplentes.length === 0) {
            strip.innerHTML = `<div class="bench-empty-msg">No hay suplentes en la lista</div>`;
            return;
        }

        tacticalState.suplentes.forEach(id => {
            const player = getPlayer(id);
            if (!player) return;

            const isSelected = tacticalState.selectedBenchPlayerId === player.id;
            const shortName = getShortName(player.nombre || player.name);
            const hasPhoto = !!player.foto;

            const item = document.createElement("div");
            item.className = `bench-player-item ${isSelected ? 'selected' : ''}`;
            item.setAttribute("draggable", "true");
            item.setAttribute("data-jug-id", player.id);

            const avatarHtml = hasPhoto
                ? `<img src="${player.foto}" class="bench-avatar-img" alt="${shortName}" />`
                : `<div class="bench-jersey-icon ${player.isPortero ? 'jersey-gk' : 'jersey-field'}"><i class="fa-solid fa-shirt"></i></div>`;

            item.innerHTML = `
                <div class="bench-avatar-wrap">
                    ${avatarHtml}
                    ${player.dorsal ? `<span class="bench-dorsal">${player.dorsal}</span>` : ''}
                </div>
                <span class="bench-player-name" title="${player.nombre}">${shortName}</span>
            `;

            // Click en suplente: seleccionar para asignar
            item.addEventListener("click", () => {
                if (tacticalState.selectedBenchPlayerId === player.id) {
                    tacticalState.selectedBenchPlayerId = null;
                } else {
                    tacticalState.selectedBenchPlayerId = player.id;
                }
                renderTacticalBench();
            });

            // Drag desde el banquillo
            item.addEventListener("dragstart", (e) => {
                e.dataTransfer.setData("text/plain", JSON.stringify({ type: 'bench', playerId: player.id }));
                item.classList.add("dragging");
            });

            item.addEventListener("dragend", () => {
                item.classList.remove("dragging");
            });

            strip.appendChild(item);
        });
    }

    // Manejo de Drop en una posición del campo
    function handleDropOnSlot(sourceData, targetIndex) {
        pushHistory();
        if (sourceData.type === 'bench') {
            const incomingId = sourceData.playerId;
            const existingId = tacticalState.titulares[targetIndex];

            // Reemplazar: el entrante va a titulares, el saliente va al banquillo
            tacticalState.titulares[targetIndex] = incomingId;
            tacticalState.suplentes = tacticalState.suplentes.filter(id => id !== incomingId);
            if (existingId && !tacticalState.suplentes.includes(existingId)) {
                tacticalState.suplentes.push(existingId);
            }
        } else if (sourceData.type === 'slot') {
            const sourceIndex = sourceData.index;
            if (sourceIndex === targetIndex) return;
            // Intercambiar las dos posiciones en el campo
            const temp = tacticalState.titulares[targetIndex];
            tacticalState.titulares[targetIndex] = tacticalState.titulares[sourceIndex];
            tacticalState.titulares[sourceIndex] = temp;
        }

        tacticalState.selectedBenchPlayerId = null;
        tacticalState.selectedSlotIndex = null;
        renderTacticalPitch();
        renderTacticalBench();
    }

    // Manejo de Click / Tap en una posición del campo
    function handleSlotClick(slotIndex) {
        // 1. Si hay un jugador del banquillo seleccionado, asignarlo directamente a este slot
        if (tacticalState.selectedBenchPlayerId) {
            pushHistory();
            const incomingId = tacticalState.selectedBenchPlayerId;
            const existingId = tacticalState.titulares[slotIndex];

            tacticalState.titulares[slotIndex] = incomingId;
            tacticalState.suplentes = tacticalState.suplentes.filter(id => id !== incomingId);
            if (existingId && !tacticalState.suplentes.includes(existingId)) {
                tacticalState.suplentes.push(existingId);
            }

            tacticalState.selectedBenchPlayerId = null;
            tacticalState.selectedSlotIndex = null;
            renderTacticalPitch();
            renderTacticalBench();
            return;
        }

        // 2. Si ya hay otro slot seleccionado, intercambiar entre ambos slots
        if (tacticalState.selectedSlotIndex !== null) {
            if (tacticalState.selectedSlotIndex !== slotIndex) {
                pushHistory();
                const temp = tacticalState.titulares[slotIndex];
                tacticalState.titulares[slotIndex] = tacticalState.titulares[tacticalState.selectedSlotIndex];
                tacticalState.titulares[tacticalState.selectedSlotIndex] = temp;
            }
            tacticalState.selectedSlotIndex = null;
            renderTacticalPitch();
            return;
        }

        // 3. Abrir menú de selección / reemplazo para este slot
        openSlotActionsModal(slotIndex);
    }

    // Modal o selector rápido de jugador para un slot
    function openSlotActionsModal(slotIndex) {
        tacticalState.selectedSlotIndex = slotIndex;
        const currentId = tacticalState.titulares[slotIndex];
        const currentPlayer = getPlayer(currentId);
        const team = getTeam(tacticalState.teamSide);
        const teamPlayers = window.appData.jugadores.filter(j => j.equipoId === (team ? team.id : null));

        const modal = document.getElementById("modal-select-pitch-player");
        const titleEl = document.getElementById("select-pitch-player-title");
        const listEl = document.getElementById("pitch-player-options-list");

        if (!modal || !listEl) return;

        const slotInfo = getFormationSlots(tacticalState.numJugadores, tacticalState.formacion)[slotIndex];
        titleEl.innerText = currentPlayer
            ? `Reemplazar: ${currentPlayer.nombre} (${slotInfo.role})`
            : `Asignar Posición: ${slotInfo.name} (${slotInfo.role})`;

        let html = "";

        // Opción: Mandar a la banca (si está ocupado)
        if (currentPlayer) {
            html += `
                <div class="pitch-player-option send-bench-opt" id="btn-slot-send-bench">
                    <i class="fa-solid fa-arrow-down" style="color:var(--card-yellow); font-size:1.2rem;"></i>
                    <div style="flex:1;">
                        <strong style="color:white; display:block;">Mandar al banquillo</strong>
                        <span style="font-size:0.75rem; color:var(--text-muted);">Dejar la posición vacía</span>
                    </div>
                </div>
            `;
        }

        // Listar todos los jugadores del equipo no titulares
        const available = teamPlayers.filter(p => !tacticalState.titulares.includes(p.id) || p.id === currentId);

        // Si es arquero, ordenar arqueros primero
        if (slotIndex === 0) {
            available.sort((a, b) => (b.isPortero ? 1 : 0) - (a.isPortero ? 1 : 0));
        }

        available.forEach(p => {
            const isThisCurrent = p.id === currentId;
            const hasPhoto = !!p.foto;
            const avatarHtml = hasPhoto
                ? `<img src="${p.foto}" style="width:36px; height:36px; border-radius:50%; object-fit:cover;">`
                : `<div class="mini-jersey"><i class="fa-solid fa-shirt"></i></div>`;

            html += `
                <div class="pitch-player-option ${isThisCurrent ? 'is-active' : ''}" data-jug-id="${p.id}">
                    ${avatarHtml}
                    <div style="flex:1; margin-left:10px;">
                        <strong style="color:white; display:block; font-size:0.9rem;">${p.nombre}</strong>
                        <span style="font-size:0.75rem; color:var(--text-muted);">
                            Dorsal: ${p.dorsal || 'S/D'} ${p.isPortero ? '• PORTERO' : ''} ${p.isNovato ? '• NOVATO' : ''}
                        </span>
                    </div>
                    ${isThisCurrent ? '<span class="badge-actual">Titular</span>' : '<i class="fa-solid fa-chevron-right" style="color:var(--text-muted);"></i>'}
                </div>
            `;
        });

        listEl.innerHTML = html;

        // Listeners para seleccionar jugador
        listEl.querySelectorAll(".pitch-player-option[data-jug-id]").forEach(row => {
            row.addEventListener("click", () => {
                const newId = row.getAttribute("data-jug-id");
                pushHistory();
                if (currentId && currentId !== newId) {
                    if (!tacticalState.suplentes.includes(currentId)) {
                        tacticalState.suplentes.push(currentId);
                    }
                }
                tacticalState.titulares[slotIndex] = newId;
                tacticalState.suplentes = tacticalState.suplentes.filter(id => id !== newId);
                tacticalState.selectedSlotIndex = null;
                renderTacticalPitch();
                renderTacticalBench();
                modal.classList.remove("active");
            });
        });

        // Listener para mandar al banquillo
        const sendBenchBtn = document.getElementById("btn-slot-send-bench");
        if (sendBenchBtn) {
            sendBenchBtn.addEventListener("click", () => {
                pushHistory();
                if (currentId && !tacticalState.suplentes.includes(currentId)) {
                    tacticalState.suplentes.push(currentId);
                }
                tacticalState.titulares[slotIndex] = null;
                tacticalState.selectedSlotIndex = null;
                renderTacticalPitch();
                renderTacticalBench();
                modal.classList.remove("active");
            });
        }

        modal.classList.add("active");
    }

    // --- AUTO-ASIGNAR TITULARES DISPONIBLES ---
    function autofillTitulares() {
        pushHistory();
        const team = getTeam(tacticalState.teamSide);
        const teamPlayers = window.appData.jugadores.filter(j => j.equipoId === (team ? team.id : null));

        // Separar arqueros y jugadores de campo
        const porteros = teamPlayers.filter(p => p.isPortero);
        const jugadoresCampo = teamPlayers.filter(p => !p.isPortero);

        // Si la posición 0 (POR) está vacía, asignar arquero
        if (!tacticalState.titulares[0]) {
            const availGK = porteros.find(p => !tacticalState.titulares.includes(p.id)) ||
                            teamPlayers.find(p => !tacticalState.titulares.includes(p.id));
            if (availGK) {
                tacticalState.titulares[0] = availGK.id;
            }
        }

        // Llenar el resto de posiciones con disponibles
        const pool = teamPlayers.filter(p => !tacticalState.titulares.includes(p.id));
        let poolIdx = 0;
        for (let i = 1; i < tacticalState.numJugadores; i++) {
            if (!tacticalState.titulares[i] && poolIdx < pool.length) {
                tacticalState.titulares[i] = pool[poolIdx].id;
                poolIdx++;
            }
        }

        // Actualizar lista de suplentes con los sobrantes
        tacticalState.suplentes = teamPlayers
            .filter(p => !tacticalState.titulares.includes(p.id))
            .map(p => p.id);

        renderTacticalPitch();
        renderTacticalBench();
    }

    // --- GUARDAR ALINEACIÓN EN EL PARTIDO ---
    function saveTacticalPitch() {
        const match = findMatch(tacticalState.matchId);
        if (!match) return;

        if (!match.detalles) match.detalles = {};
        const alineacionKey = tacticalState.teamSide === 'local' ? 'alineacionLocal' : 'alineacionVis';

        match.detalles[alineacionKey] = {
            formacion: tacticalState.formacion,
            numJugadores: tacticalState.numJugadores,
            titulares: tacticalState.titulares.filter(Boolean),
            suplentes: tacticalState.suplentes.filter(Boolean)
        };

        if (typeof window.saveLiveMatchState === 'function') {
            window.saveLiveMatchState(match);
        } else if (typeof window.savePartidosToSupabase === 'function') {
            window.savePartidosToSupabase();
        }

        // Actualizar las vistas en el dashboard
        if (typeof window.renderAlineaciones === 'function') {
            window.renderAlineaciones(match);
        }
        renderMiniPitches(match);

        const modal = document.getElementById("modal-tactical-pitch");
        if (modal) modal.classList.remove("active");

        alert("¡Alineación táctica guardada exitosamente!");
    }

    // --- FORMATION PICKER DRAWER (IMAGE 1) ---
    function openFormationPicker() {
        const modal = document.getElementById("modal-formation-picker");
        if (!modal) return;

        // Renderizar chips de número de jugadores
        document.querySelectorAll(".player-count-chip").forEach(chip => {
            const count = parseInt(chip.getAttribute("data-count"));
            if (count === tacticalState.numJugadores) {
                chip.classList.add("active");
            } else {
                chip.classList.remove("active");
            }
        });

        renderFormationOptions(tacticalState.numJugadores);
        modal.classList.add("active");
    }

    function renderFormationOptions(playerCount) {
        const list = document.getElementById("formation-options-list");
        if (!list) return;

        const count = parseInt(playerCount) || 11;
        const formations = FORMATIONS_DB[count] || FORMATIONS_DB[11];

        let html = "";
        Object.keys(formations).forEach(fKey => {
            const isSelected = tacticalState.formacion === fKey && tacticalState.numJugadores === count;
            html += `
                <div class="formation-option-item ${isSelected ? 'selected' : ''}" data-formation="${fKey}" data-count="${count}">
                    <span class="formation-name">${fKey}</span>
                    <span class="formation-radio ${isSelected ? 'checked' : ''}"></span>
                </div>
            `;
        });

        list.innerHTML = html;

        list.querySelectorAll(".formation-option-item").forEach(item => {
            item.addEventListener("click", () => {
                const newF = item.getAttribute("data-formation");
                const newCount = parseInt(item.getAttribute("data-count"));

                pushHistory();
                tacticalState.numJugadores = newCount;
                tacticalState.formacion = newF;

                // Ajustar cantidad de titulares si cambió el número de jugadores
                while (tacticalState.titulares.length < newCount) {
                    tacticalState.titulares.push(null);
                }
                if (tacticalState.titulares.length > newCount) {
                    const extra = tacticalState.titulares.slice(newCount);
                    extra.forEach(id => {
                        if (id && !tacticalState.suplentes.includes(id)) {
                            tacticalState.suplentes.push(id);
                        }
                    });
                    tacticalState.titulares = tacticalState.titulares.slice(0, newCount);
                }

                updateTacticalHeader();
                renderTacticalPitch();
                renderTacticalBench();

                document.getElementById("modal-formation-picker").classList.remove("active");
            });
        });
    }

    // --- FORMATEADOR DE FECHA PARA EL PÓSTER DE WHATSAPP ---
    function formatMatchDateForPoster(match) {
        let dateObj = null;
        if (match.detalles && match.detalles.fechaProgramada) {
            dateObj = new Date(match.detalles.fechaProgramada);
        }
        if (!dateObj || isNaN(dateObj.getTime())) {
            dateObj = new Date();
        }
        const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
        const dayName = days[dateObj.getDay()];
        const dayNum = dateObj.getDate();
        const monthName = months[dateObj.getMonth()];
        const year = dateObj.getFullYear();
        return `${dayName}, ${dayNum} de ${monthName} de ${year}`;
    }

    // --- GENERADOR Y COMPARTIDOR WHATSAPP (IMAGE 3) ---
    window.openLineupShareModal = async function (matchId, side = 'local') {
        const match = findMatch(matchId);
        if (!match) return alert("Partido no seleccionado.");

        tacticalState.matchId = match.id;
        tacticalState.teamSide = side;

        renderSharePoster(match, side);

        const modal = document.getElementById("modal-lineup-share");
        if (modal) modal.classList.add("active");
    };

    function renderSharePoster(match, side) {
        const teamId1 = match.equipo1Id || match.equipo1_id;
        const teamId2 = match.equipo2Id || match.equipo2_id;
        const local = window.appData?.equipos?.find(e => e.id == teamId1);
        const vis = window.appData?.equipos?.find(e => e.id == teamId2);
        const targetTeam = side === 'local' ? local : vis;

        const alineacion = side === 'local' ? match.detalles?.alineacionLocal : match.detalles?.alineacionVis;
        const formacion = (alineacion && alineacion.formacion) ? alineacion.formacion : '4-4-2';
        const numJugadores = (alineacion && alineacion.numJugadores) ? alineacion.numJugadores : 11;
        const titulares = (alineacion && alineacion.titulares) ? alineacion.titulares : [];

        // Logos y títulos en el póster
        const logoLocalEl = document.getElementById("poster-logo-local");
        const logoVisEl = document.getElementById("poster-logo-vis");
        const brandNameEl = document.getElementById("poster-brand-name");
        const formationTagEl = document.getElementById("poster-formation-tag");
        const teamNameSubEl = document.getElementById("poster-team-name-sub");
        const dateTextEl = document.getElementById("poster-date-text");

        if (logoLocalEl) logoLocalEl.src = local?.logo || '';
        if (logoVisEl) logoVisEl.src = vis?.logo || '';
        if (brandNameEl) brandNameEl.innerText = (window.appData.config?.nombreLiga || 'FEMFUTPAL').toUpperCase();
        if (formationTagEl) formationTagEl.innerText = formacion;
        if (teamNameSubEl) teamNameSubEl.innerText = targetTeam ? targetTeam.nombre.toUpperCase() : 'EQUIPO';
        if (dateTextEl) dateTextEl.innerText = formatMatchDateForPoster(match);

        // Renderizar los jugadores colocados en el campo 3D
        const posterLayer = document.getElementById("poster-players-layer");
        if (!posterLayer) return;

        posterLayer.innerHTML = "";
        const slots = getFormationSlots(numJugadores, formacion);

        slots.forEach((slot, idx) => {
            const playerId = titulares[idx];
            const player = getPlayer(playerId);
            const isGK = idx === 0;

            const node = document.createElement("div");
            node.className = `poster-player-slot ${isGK ? 'is-gk' : ''}`;
            node.style.left = `${slot.x}%`;
            node.style.top = `${slot.y}%`;

            if (player) {
                const shortName = getShortName(player.nombre || player.name);
                const hasPhoto = !!player.foto;
                const avatar = hasPhoto
                    ? `<img src="${player.foto}" class="poster-avatar-img" crossorigin="anonymous" />`
                    : `<div class="poster-jersey-icon ${isGK ? 'jersey-gk' : 'jersey-field'}"><i class="fa-solid fa-shirt"></i></div>`;

                node.innerHTML = `
                    <div class="poster-avatar-ring">
                        ${avatar}
                    </div>
                    <div class="poster-name-tag">${shortName}</div>
                `;
            } else {
                node.innerHTML = `
                    <div class="poster-avatar-ring empty-ring">
                        <i class="fa-solid fa-shield"></i>
                    </div>
                    <div class="poster-name-tag">${slot.role}</div>
                `;
            }

            posterLayer.appendChild(node);
        });

        // Fondo Césped Real en Base64 para evitar errores de CORS con protocolo file://
        const grassBgEl = document.getElementById("poster-grass-bg");
        if (grassBgEl) {
            const turfB64 = (typeof window.SOCCER_TURF_B64 !== 'undefined') ? window.SOCCER_TURF_B64 : 'img/soccer_field_turf.jpg';
            grassBgEl.style.backgroundImage = `url("${turfB64}")`;
        }

        // Actualizar pestañas de selección de equipo para el póster
        const btnLocal = document.getElementById("btn-share-team-local");
        const btnVis = document.getElementById("btn-share-team-vis");
        if (btnLocal && btnVis) {
            btnLocal.innerText = local ? local.nombre : 'Local';
            btnVis.innerText = vis ? vis.nombre : 'Visitante';
            if (side === 'local') {
                btnLocal.classList.add("active");
                btnVis.classList.remove("active");
            } else {
                btnVis.classList.add("active");
                btnLocal.classList.remove("active");
            }
        }
    }

    // Convierte una URL a DataURL base64 para evitar errores de CORS / canvas manchado (tainted canvas)
    async function toSafeDataUrl(url) {
        if (!url || typeof url !== 'string') return '';
        if (url.startsWith('data:')) return url;
        
        // Si es la imagen de césped local y tenemos el recurso en Base64 precargado:
        if (url.includes('soccer_field_turf.jpg') && typeof window.SOCCER_TURF_B64 !== 'undefined') {
            return window.SOCCER_TURF_B64;
        }

        try {
            const resp = await fetch(url, { mode: 'cors' });
            if (!resp.ok) throw new Error("Fetch failed");
            const blob = await resp.blob();
            return await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (e) {
            // Si el fetch directo falla por CORS o protocolo file://, intentar vía elemento Image
            return await new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => {
                    try {
                        const c = document.createElement('canvas');
                        c.width = img.naturalWidth || img.width || 100;
                        c.height = img.naturalHeight || img.height || 100;
                        const ctx = c.getContext('2d');
                        ctx.drawImage(img, 0, 0);
                        resolve(c.toDataURL('image/png'));
                    } catch (err) {
                        // Si falla dibujar al canvas, devolver vacío para no manchar el canvas final
                        resolve('');
                    }
                };
                img.onerror = () => resolve('');
                img.src = url;
            });
        }
    }

    // --- CAPTURAR PÓSTER EN ALTA RESOLUCIÓN MEDIANTE HTML2CANVAS ---
    async function capturePosterCanvas() {
        const posterEl = document.getElementById("whatsapp-poster-card");
        if (!posterEl || !window.html2canvas) {
            throw new Error("Elemento o librería html2canvas no disponibles.");
        }

        // Asegurar fondo en Base64
        const bgGrass = posterEl.querySelector('.poster-grass-bg');
        if (bgGrass && typeof window.SOCCER_TURF_B64 !== 'undefined') {
            bgGrass.style.backgroundImage = `url("${window.SOCCER_TURF_B64}")`;
        }

        // 1. Convertir imágenes externas (logos, avatares de jugadores) a DataURL seguro
        const images = Array.from(posterEl.querySelectorAll('img'));
        await Promise.all(images.map(async img => {
            const currentSrc = img.getAttribute('src');
            if (currentSrc && !currentSrc.startsWith('data:')) {
                try {
                    const dataUrl = await toSafeDataUrl(currentSrc);
                    if (dataUrl && dataUrl.startsWith('data:')) {
                        img.setAttribute('src', dataUrl);
                    } else {
                        // Si no se puede convertir (bloqueo total CORS file://), ocultar temporalmente para que no manche
                        img.dataset.origSrc = currentSrc;
                        img.style.visibility = 'hidden';
                    }
                } catch (e) {
                    img.dataset.origSrc = currentSrc;
                    img.style.visibility = 'hidden';
                }
            }
        }));

        // Asegurar que las imágenes internas se hayan terminado de renderizar
        await Promise.all(images.map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise(resolve => {
                img.onload = resolve;
                img.onerror = resolve;
            });
        }));

        await new Promise(r => setTimeout(r, 180));

        let canvas;
        try {
            // Renderizar a escala nítida (1080px de ancho) con allowTaint: false y useCORS: true
            canvas = await window.html2canvas(posterEl, {
                scale: 2.2,
                useCORS: true,
                allowTaint: false,
                backgroundColor: "#0d1b12",
                logging: false
            });
        } finally {
            // Restaurar imágenes que se ocultaron si alguna falló
            images.forEach(img => {
                if (img.dataset.origSrc) {
                    img.setAttribute('src', img.dataset.origSrc);
                    img.style.visibility = 'visible';
                    delete img.dataset.origSrc;
                }
            });
        }

        return canvas;
    }

    // --- ACCIÓN COMPARTIR POR WHATSAPP ---
    async function doWhatsAppShare() {
        if (typeof window.showLoader === 'function') {
            window.showLoader("Generando póster para WhatsApp...");
        }

        try {
            const canvas = await capturePosterCanvas();
            const match = window.appData.partidos.find(p => p.id === tacticalState.matchId);
            const team = getTeam(tacticalState.teamSide);
            const teamName = team ? team.nombre : 'Equipo';
            const fileName = `Alineacion_${teamName.replace(/\s+/g, '_')}.png`;

            // Convertir canvas a Blob
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 0.95));
            const file = new File([blob], fileName, { type: 'image/png' });

            const shareText = `⚽ *ALINEACIÓN OFICIAL - ${teamName.toUpperCase()}*\n📋 Formación: ${tacticalState.formacion}\n📅 ${formatMatchDateForPoster(match || {})}\n🏆 Liga ${(window.appData.config?.nombreLiga || 'FEMFUTPAL')}`;

            // Si el navegador soporta compartir archivos directamente (móviles Android, iOS, tablets)
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    title: `Alineación Oficial - ${teamName}`,
                    text: shareText,
                    files: [file]
                });
            } else {
                // Fallback: descargar imagen y abrir enlace de WhatsApp
                const link = document.createElement("a");
                link.download = fileName;
                link.href = canvas.toDataURL("image/png");
                link.click();

                const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + "\n(Imagen de alineación descargada)")}`;
                window.open(waUrl, '_blank');
            }
        } catch (err) {
            console.error("Error al compartir en WhatsApp:", err);
            // Si el usuario canceló el share modal nativo, ignorar silenciosamente
            if (err.name !== 'AbortError') {
                alert("Ocurrió un detalle al generar el póster. Puedes descargarlo directamente con el botón 'Descargar Imagen'.");
            }
        } finally {
            if (typeof window.hideLoader === 'function') {
                window.hideLoader();
            }
        }
    }

    // --- ACCIÓN DESCARGAR IMAGEN ---
    async function doDownloadPoster() {
        if (typeof window.showLoader === 'function') {
            window.showLoader("Preparando descarga...");
        }
        try {
            const canvas = await capturePosterCanvas();
            const team = getTeam(tacticalState.teamSide);
            const teamName = team ? team.nombre : 'Equipo';
            const link = document.createElement("a");
            link.download = `Alineacion_${teamName.replace(/\s+/g, '_')}.png`;
            link.href = canvas.toDataURL("image/png");
            link.click();
        } catch (err) {
            console.error("Error descargando imagen:", err);
            alert("No se pudo descargar la imagen.");
        } finally {
            if (typeof window.hideLoader === 'function') {
                window.hideLoader();
            }
        }
    }

    // --- ACCIÓN COPIAR IMAGEN AL PORTAPAPELES ---
    async function doCopyPoster() {
        if (typeof window.showLoader === 'function') {
            window.showLoader("Copiando imagen...");
        }
        try {
            const canvas = await capturePosterCanvas();
            canvas.toBlob(async (blob) => {
                if (!blob) throw new Error("No se pudo generar el blob");
                if (navigator.clipboard && window.ClipboardItem) {
                    await navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]);
                    alert("¡Imagen copiada al portapapeles! Puedes pegarla (Ctrl+V) en WhatsApp Web o chat.");
                } else {
                    alert("Tu navegador no soporta copiar imágenes directamente. Usa el botón 'Descargar'.");
                }
            }, 'image/png');
        } catch (err) {
            console.error("Error al copiar imagen:", err);
            alert("No se pudo copiar al portapapeles.");
        } finally {
            if (typeof window.hideLoader === 'function') {
                window.hideLoader();
            }
        }
    }

    // --- RENDERIZADO DE MINI CANCHAS EN LA PESTAÑA ALINEACIÓN ---
    function renderMiniPitches(match) {
        const m = match || findMatch();
        if (!m) return;
        if (!m.detalles) m.detalles = {};
        if (!m.detalles.alineacionLocal) m.detalles.alineacionLocal = { formacion: '4-4-2', numJugadores: 11, titulares: [], suplentes: [] };
        if (!m.detalles.alineacionVis) m.detalles.alineacionVis = { formacion: '4-4-2', numJugadores: 11, titulares: [], suplentes: [] };

        ['local', 'vis'].forEach(side => {
            const container = document.getElementById(`mini-pitch-${side}`);
            if (!container) return;

            const alineacion = side === 'local' ? m.detalles.alineacionLocal : m.detalles.alineacionVis;
            if (!alineacion) return;

            const formacion = alineacion.formacion || '4-4-2';
            const numJugadores = alineacion.numJugadores || 11;
            const titulares = alineacion.titulares || [];
            const slots = getFormationSlots(numJugadores, formacion);

            let dotsHtml = "";
            slots.forEach((s, idx) => {
                const pid = titulares[idx];
                const p = getPlayer(pid);
                const isGK = idx === 0;
                const dotClass = isGK ? 'mini-gk' : 'mini-field';
                const label = p ? getShortName(p.nombre || p.name) : s.role;

                dotsHtml += `
                    <div class="mini-pitch-dot ${dotClass} ${p ? 'occupied' : 'empty'}" style="left:${s.x}%; top:${s.y}%;" title="${p ? p.nombre : s.name}">
                        <span class="mini-dot-inner"></span>
                        <span class="mini-dot-label">${label}</span>
                    </div>
                `;
            });

            container.innerHTML = `
                <div class="mini-pitch-field">
                    <div class="mini-pitch-markings">
                        <div class="mini-half"></div>
                        <div class="mini-circle"></div>
                    </div>
                    ${dotsHtml}
                </div>
            `;
        });
    }
    window.renderMiniPitches = renderMiniPitches;

    // Hook para enganchar con renderAlineaciones de app.js
    const oldRenderAlineaciones = window.renderAlineaciones;
    window.renderAlineaciones = function (match) {
        if (typeof oldRenderAlineaciones === 'function') {
            oldRenderAlineaciones(match);
        }
        renderMiniPitches(match);
    };

    // --- REGISTRO DE EVENTOS GLOBALES CUANDO CARGUE EL DOM ---
    document.addEventListener("DOMContentLoaded", () => {
        // 1. Botón cerrar pizarra táctica
        document.getElementById("btn-close-tactical-pitch")?.addEventListener("click", () => {
            document.getElementById("modal-tactical-pitch")?.classList.remove("active");
        });

        // 2. Switch Local / Visitante en pizarra
        document.getElementById("btn-toggle-team-local")?.addEventListener("click", () => {
            if (tacticalState.teamSide !== 'local') {
                window.openTacticalPitchModal(tacticalState.matchId, 'local');
            }
        });

        document.getElementById("btn-toggle-team-vis")?.addEventListener("click", () => {
            if (tacticalState.teamSide !== 'vis') {
                window.openTacticalPitchModal(tacticalState.matchId, 'vis');
            }
        });

        // 3. Botones deshacer y restablecer
        document.getElementById("btn-tactical-undo")?.addEventListener("click", () => {
            if (tacticalState.history.length > 0) {
                const prev = tacticalState.history.pop();
                tacticalState.formacion = prev.formacion;
                tacticalState.numJugadores = prev.numJugadores;
                tacticalState.titulares = [...prev.titulares];
                tacticalState.suplentes = [...prev.suplentes];
                updateTacticalHeader();
                renderTacticalPitch();
                renderTacticalBench();
            }
        });

        document.getElementById("btn-tactical-reset")?.addEventListener("click", () => {
            if (confirm("¿Deseas vaciar las posiciones del campo y devolver todos al banquillo?")) {
                pushHistory();
                tacticalState.titulares.forEach(id => {
                    if (id && !tacticalState.suplentes.includes(id)) {
                        tacticalState.suplentes.push(id);
                    }
                });
                tacticalState.titulares = new Array(tacticalState.numJugadores).fill(null);
                renderTacticalPitch();
                renderTacticalBench();
            }
        });

        // 4. Botón guardar pizarra
        document.getElementById("btn-save-tactical-pitch")?.addEventListener("click", saveTacticalPitch);

        // 5. Botón abrir selector de formaciones (Image 1)
        document.getElementById("btn-open-formation-picker")?.addEventListener("click", openFormationPicker);

        // 6. Chips de número de jugadores en selector de formaciones
        document.querySelectorAll(".player-count-chip").forEach(chip => {
            chip.addEventListener("click", () => {
                document.querySelectorAll(".player-count-chip").forEach(c => c.classList.remove("active"));
                chip.classList.add("active");
                const count = parseInt(chip.getAttribute("data-count"));
                renderFormationOptions(count);
            });
        });

        document.getElementById("btn-close-formation-picker")?.addEventListener("click", () => {
            document.getElementById("modal-formation-picker")?.classList.remove("active");
        });

        // 7. Auto-asignar
        document.getElementById("btn-tactical-autofill")?.addEventListener("click", autofillTitulares);

        // 8. Botón WhatsApp desde la pizarra
        document.getElementById("btn-tactical-share-whatsapp")?.addEventListener("click", () => {
            window.openLineupShareModal(tacticalState.matchId, tacticalState.teamSide);
        });

        // 9. Modal de selección de jugador de posición
        document.getElementById("btn-close-select-pitch-player")?.addEventListener("click", () => {
            document.getElementById("modal-select-pitch-player")?.classList.remove("active");
        });

        // 10. Modal de compartir alineación
        document.getElementById("btn-close-lineup-share")?.addEventListener("click", () => {
            document.getElementById("modal-lineup-share")?.classList.remove("active");
        });

        document.getElementById("btn-share-team-local")?.addEventListener("click", () => {
            tacticalState.teamSide = 'local';
            const match = window.appData.partidos.find(p => p.id === tacticalState.matchId);
            if (match) renderSharePoster(match, 'local');
        });

        document.getElementById("btn-share-team-vis")?.addEventListener("click", () => {
            tacticalState.teamSide = 'vis';
            const match = window.appData.partidos.find(p => p.id === tacticalState.matchId);
            if (match) renderSharePoster(match, 'vis');
        });

        document.getElementById("btn-do-whatsapp-share")?.addEventListener("click", doWhatsAppShare);
        document.getElementById("btn-download-lineup-image")?.addEventListener("click", doDownloadPoster);
        document.getElementById("btn-copy-lineup-image")?.addEventListener("click", doCopyPoster);

        // 11. Botón compartir en el encabezado del match dashboard
        document.getElementById("btn-match-share-header")?.addEventListener("click", () => {
            window.openLineupShareModal(window.currentLiveMatchId, 'local');
        });

        // 12. Botones dentro de la pestaña "Alineación" del Dashboard
        document.addEventListener("click", (e) => {
            const btnTactical = e.target.closest(".btn-open-tactical");
            if (btnTactical) {
                const side = btnTactical.getAttribute("data-team") || 'local';
                window.openTacticalPitchModal(window.currentLiveMatchId, side);
                return;
            }

            const btnShareTab = e.target.closest(".btn-share-whatsapp-tab");
            if (btnShareTab) {
                const side = btnShareTab.getAttribute("data-team") || 'local';
                window.openLineupShareModal(window.currentLiveMatchId, side);
                return;
            }
        });
    });

})();
