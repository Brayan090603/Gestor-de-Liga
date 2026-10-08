// Default Initial Data
const defaultData = {
    equipos: [],
    jugadores: [],
    movimientos: [], // { fecha, jugadorId, tipo: 'alta'|'baja'|'traspaso', equipoOrigenId, equipoDestinoId }
    config: {
        anioActual: 2026,
        estadoApertura: 'activo', // activo | finalizado
        estadoClausura: 'pendiente' // pendiente | activo | finalizado
    }
};

const tabTitles = {
    goleadores: { title: "Tabla de Goleadores", statName: "Goles" },
    amarillas: { title: "Tarjetas Amarillas", statName: "Tarjetas" },
    rojas: { title: "Tarjetas Rojas", statName: "Tarjetas" },
    novatos: { title: "Jóvenes Promesas", statName: "Goles" },
    porteros: { title: "Porteros Menos Goleados", statName: "Goles Recibidos" }
};

// State Management
let activeId = localStorage.getItem('femfutpal_active_id');

if (!activeId) {
    window.location.href = 'index.html';
}

let appData = {
    equipos: [],
    jugadores: [],
    movimientos: [],
    partidos: [],
    config: {
        anioActual: 2026,
        estadoApertura: 'activo',
        estadoClausura: 'pendiente',
        tipoTorneo: 'dual'
    }
};

async function loadDataFromSupabase() {
    showLoader("Cargando torneo...");

    // 1. Cargar Torneo
    const { data: torneosData, error } = await supabase.from('torneos').select('*').eq('id', activeId);
    if (error) {
        throw new Error(error.message);
    }
    if (!torneosData || torneosData.length === 0) {
        hideLoader();
        window.location.href = 'index.html';
        return;
    }
    const torneo = torneosData[0];
    appData.config.anioActual = torneo.anio_actual;
    appData.config.estadoApertura = torneo.estado_apertura;
    appData.config.estadoClausura = torneo.estado_clausura;
    appData.config.tipoTorneo = torneo.tipo_torneo;
    appData.config.ligaInfo = {
        nombre: torneo.nombre,
        lugar: torneo.lugar,
        campo: torneo.campo,
        celular: torneo.celular,
        logo: torneo.logo,
        portada: torneo.portada,
        dedicatoria: torneo.dedicatoria || "",
        eslogan: torneo.eslogan || "",
        correo: torneo.correo || "",
        sitio_web: torneo.sitio_web || "",
        fecha_inicio: torneo.fecha_inicio || "",
        fecha_fin: torneo.fecha_fin || ""
    };

    // 2. Cargar Equipos
    const { data: equiposData } = await supabase.from('equipos').select('*').eq('torneo_id', activeId);
    if (equiposData) {
        appData.equipos = equiposData.map(e => ({
            id: e.id.toString(),
            nombre: e.nombre,
            logo: e.logo,
            portada: e.portada || ''
        }));
    }

    // 3. Cargar Jugadores
    const { data: jugData } = await supabase.from('jugadores').select('*').eq('torneo_id', activeId);
    if (jugData) {
        appData.jugadores = jugData.map(j => ({
            id: j.id.toString(),
            equipoId: j.equipo_id ? j.equipo_id.toString() : null,
            nombre: j.nombre,
            name: j.nombre,
            isNovato: j.is_novato,
            isPortero: j.is_portero,
            status: j.status,
            transferencias: j.transferencias,
            foto: j.foto || null,
            dorsal: j.dorsal || null,
            stats: {
                apertura: {
                    goles: j.stats_apertura_goles,
                    amarillas: j.stats_apertura_amarillas,
                    rojas: j.stats_apertura_rojas,
                    golesRecibidos: j.stats_apertura_goles_recibidos,
                    minutos: j.stats_apertura_minutos || 0
                },
                clausura: {
                    goles: j.stats_clausura_goles,
                    amarillas: j.stats_clausura_amarillas,
                    rojas: j.stats_clausura_rojas,
                    golesRecibidos: j.stats_clausura_goles_recibidos,
                    minutos: j.stats_clausura_minutos || 0
                }
            }
        }));
    }

    // 4. Cargar Movimientos
    const { data: movData } = await supabase.from('movimientos').select('*').eq('torneo_id', activeId).order('created_at', { ascending: true });
    if (movData) {
        appData.movimientos = movData.map(m => ({
            id: m.id.toString(),
            fecha: m.fecha,
            tipo: m.tipo,
            jugadorId: m.jugador_id ? m.jugador_id.toString() : null,
            equipoOrigenId: m.equipo_origen_id ? m.equipo_origen_id.toString() : null,
            equipoDestinoId: m.equipo_destino_id ? m.equipo_destino_id.toString() : null
        }));
    }

    // 5. Cargar Partidos (Supabase + Fallback a LocalStorage)
    const { data: partData } = await supabase.from('partidos').select('*').eq('torneo_id', activeId);
    if (partData && partData.length > 0) {
        appData.partidos = partData
            .filter(p => p.calendario_nombre !== '__DELETED__')
            .map(p => ({
            id: p.id.toString(),
            torneo: p.torneo,
            fase: p.fase,
            jornada: p.jornada,
            grupo: p.grupo,
            equipo1Id: p.equipo1_id,
            equipo2Id: p.equipo2_id,
            goles1: p.goles1,
            goles2: p.goles2,
            calendario_nombre: p.calendario_nombre || 'Torneo Principal',
            detalles: p.detalles || {}
        }));
    } else {
        const localPartidos = localStorage.getItem(`femfutpal_partidos_${activeId}`);
        if (localPartidos) {
            appData.partidos = JSON.parse(localPartidos).map(p => ({
                ...p,
                calendario_nombre: p.calendario_nombre || 'Torneo Principal'
            }));
            // Intentar subirlos de una vez
            if (appData.partidos.length > 0) {
                setTimeout(savePartidosToSupabase, 2000);
            }
        } else {
            appData.partidos = [];
        }
    }
    
    // Initialize calendars list
    window.currentCalendarioNombre = 'Torneo Principal';
    let uniqueCalendarios = [...new Set(appData.partidos.map(p => p.calendario_nombre))];
    
    // Merge with any empty calendars saved in localStorage
    const savedCals = localStorage.getItem(`femfutpal_calendarios_${activeId}`);
    if (savedCals) {
        try {
            const parsedCals = JSON.parse(savedCals);
            parsedCals.forEach(c => {
                if (!uniqueCalendarios.includes(c) && c !== '__DELETED__') {
                    uniqueCalendarios.push(c);
                }
            });
        } catch(e) {}
    }
    
    if(uniqueCalendarios.length === 0) uniqueCalendarios.push('Torneo Principal');
    window.calendariosDisponibles = uniqueCalendarios;

    console.log("Partidos cargados en memoria:", appData.partidos.length);

    hideLoader();
}

async function saveData() {
    // Config
    await supabase.from('torneos').update({
        estado_apertura: appData.config.estadoApertura,
        estado_clausura: appData.config.estadoClausura,
        anio_actual: appData.config.anioActual
    }).eq('id', activeId);

    // Equipos
    if (appData.equipos.length > 0) {
        const eqData = appData.equipos.map(eq => ({
            id: eq.id,
            torneo_id: activeId,
            nombre: eq.nombre,
            logo: eq.logo,
            portada: eq.portada || null
        }));
        const { error } = await supabase.from('equipos').upsert(eqData);
        if (error && error.message.includes('portada')) {
            // Reintentar sin portada si la columna no existe
            const eqDataSafe = appData.equipos.map(eq => ({
                id: eq.id,
                torneo_id: activeId,
                nombre: eq.nombre,
                logo: eq.logo
            }));
            await supabase.from('equipos').upsert(eqDataSafe);
        }
    }

    // Jugadores
    if (appData.jugadores.length > 0) {
        const jugData = appData.jugadores.map(j => ({
            id: j.id,
            torneo_id: activeId,
            equipo_id: j.equipoId,
            nombre: j.name || j.nombre, // Using j.name from the edit form
            is_novato: j.isNovato,
            is_portero: j.isPortero,
            status: j.status,
            transferencias: j.transferencias,
            foto: j.foto || null,
            dorsal: j.dorsal || null,
            stats_apertura_goles: j.stats.apertura.goles,
            stats_apertura_amarillas: j.stats.apertura.amarillas,
            stats_apertura_rojas: j.stats.apertura.rojas,
            stats_apertura_goles_recibidos: j.stats.apertura.golesRecibidos,
            stats_apertura_minutos: j.stats.apertura.minutos,
            stats_clausura_goles: j.stats.clausura.goles,
            stats_clausura_amarillas: j.stats.clausura.amarillas,
            stats_clausura_rojas: j.stats.clausura.rojas,
            stats_clausura_goles_recibidos: j.stats.clausura.golesRecibidos,
            stats_clausura_minutos: j.stats.clausura.minutos
        }));
        const { error } = await supabase.from('jugadores').upsert(jugData);
        if (error) {
            console.error("Error al guardar jugadores principal:", error);
            try {
                // Fallback ultra-seguro (solo las columnas más esenciales)
                const jugDataSafe = appData.jugadores.map(j => ({
                    id: j.id,
                    torneo_id: activeId,
                    equipo_id: j.equipoId === 'libre' ? null : j.equipoId,
                    nombre: j.name || j.nombre,
                    is_novato: j.isNovato,
                    is_portero: j.isPortero,
                    status: j.status,
                    transferencias: j.transferencias,
                    stats_apertura_goles: j.stats?.apertura?.goles || 0,
                    stats_apertura_amarillas: j.stats?.apertura?.amarillas || 0,
                    stats_apertura_rojas: j.stats?.apertura?.rojas || 0,
                    stats_apertura_goles_recibidos: j.stats?.apertura?.golesRecibidos || 0,
                    stats_clausura_goles: j.stats?.clausura?.goles || 0,
                    stats_clausura_amarillas: j.stats?.clausura?.amarillas || 0,
                    stats_clausura_rojas: j.stats?.clausura?.rojas || 0,
                    stats_clausura_goles_recibidos: j.stats?.clausura?.golesRecibidos || 0
                }));
                const { error: error2 } = await supabase.from('jugadores').upsert(jugDataSafe);
                if (error2) console.error("Error crítico en el fallback de jugadores:", error2);
            } catch(e) {
                console.error("Excepción al preparar fallback:", e);
            }
        }
    }

    // Movimientos
    if (appData.movimientos.length > 0) {
        const movData = appData.movimientos.map(m => {
            if (!m.id) m.id = Date.now() + Math.floor(Math.random() * 1000000);
            return {
                id: m.id,
                torneo_id: activeId,
                fecha: m.fecha,
                tipo: m.tipo,
                jugador_id: m.jugadorId,
                equipo_origen_id: m.equipoOrigenId || null,
                equipo_destino_id: m.equipoDestinoId || null
            };
        });
        await supabase.from('movimientos').upsert(movData);
    }
}

async function savePartidosToSupabase() {
    localStorage.setItem(`femfutpal_partidos_${activeId}`, JSON.stringify(appData.partidos));

    if (appData.partidos && appData.partidos.length > 0) {
        const partData = appData.partidos.map(p => ({
            id: p.id.toString(),
            torneo_id: activeId,
            torneo: p.torneo,
            fase: p.fase,
            jornada: p.jornada,
            grupo: p.grupo || null,
            equipo1_id: p.equipo1Id,
            equipo2_id: p.equipo2Id,
            goles1: p.goles1,
            goles2: p.goles2,
            calendario_nombre: p.calendario_nombre || 'Torneo Principal',
            detalles: p.detalles || {}
        }));

        let { error } = await supabase.from('partidos').upsert(partData);
        
        // Si falla porque no existe la columna detalles, reintentamos sin ella
        if (error && JSON.stringify(error).includes('detalles')) {
            console.warn("La columna 'detalles' no existe en Supabase. Guardando sin detalles...");
            const fallbackData = partData.map(p => {
                const copy = { ...p };
                delete copy.detalles;
                return copy;
            });
            const fallbackRes = await supabase.from('partidos').upsert(fallbackData);
            error = fallbackRes.error;
            
            if (!error) {
                // Silenciamos el alert si el fallback funcionó, pero avisamos en consola
                console.log("Partidos guardados exitosamente usando el fallback (sin detalles).");
            }
        }

        if (error) {
            console.error("Error guardando partidos en Supabase:", error);
            alert("Error guardando en la base de datos: " + error.message);
        }
    }
}

let currentTorneo = "apertura"; // "apertura" or "clausura"

document.addEventListener("DOMContentLoaded", async () => {
    try {
        await loadDataFromSupabase();
    } catch (e) {
        console.error("Fallo crítico de conexión:", e);
        alert("Error de conexión a la base de datos. Trabajando en modo sin conexión (si los datos estaban guardados localmente).");
        hideLoader();
    }
    
    try {
    // Initialize fallback for calendarios if loadDataFromSupabase failed
    window.currentCalendarioNombre = window.currentCalendarioNombre || 'Torneo Principal';
    window.calendariosDisponibles = window.calendariosDisponibles || ['Torneo Principal'];

    // Nav Items
    const navItems = document.querySelectorAll(".nav-item:not(#btn-open-admin):not(.external)");
    const viewSections = document.querySelectorAll(".view-section");
    const currentTabTitle = document.getElementById("current-tab-title");
    const tournamentBtns = document.querySelectorAll(".tournament-btn");
    const btnFinishApertura = document.getElementById("btn-finish-apertura");

    // Elements - Views
    const viewEquipos = document.getElementById("view-equipos");
    const viewEquipoDetalle = document.getElementById("view-equipo-detalle");
    const teamsContainer = document.getElementById("teams-container");
    const rosterBody = document.getElementById("roster-body");
    const detailTeamName = document.getElementById("detail-team-name");
    const detailTeamLogo = document.getElementById("detail-team-logo");
    const btnBackEquipos = document.getElementById("btn-back-equipos");
    const btnInlineAddPlayer = document.getElementById("btn-inline-add-player");
    const uploadPortada = document.getElementById("upload-portada");
    const uploadLogo = document.getElementById("upload-logo");
    const detailTeamBanner = document.getElementById("detail-team-banner");
    
    // Scanner Elements
    const btnScanPlantilla = document.getElementById("btn-scan-plantilla");
    const uploadPlantillaScan = document.getElementById("upload-plantilla-scan");
    const scannerModal = document.getElementById("scanner-modal");
    const btnCloseScanner = document.getElementById("btn-close-scanner");
    const scannerResultsBody = document.getElementById("scanner-results-body");
    const btnInscribirEscaneados = document.getElementById("btn-inscribir-escaneados");

    if (uploadPortada) {
        uploadPortada.addEventListener("change", function () {
            const file = this.files[0];
            if (file && currentTeamId) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    const dataUrl = e.target.result;
                    const team = appData.equipos.find(t => t.id == currentTeamId);
                    if (team) {
                        team.portada = dataUrl;
                        detailTeamBanner.style.backgroundImage = `url(${dataUrl})`;
                        saveData();
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (uploadLogo) {
        uploadLogo.addEventListener("change", function () {
            const file = this.files[0];
            if (file && currentTeamId) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    const dataUrl = e.target.result;
                    const team = appData.equipos.find(t => t.id == currentTeamId);
                    if (team) {
                        team.logo = dataUrl;
                        const fallback = document.getElementById("detail-team-logo-fallback");
                        if (fallback) fallback.style.display = 'none';
                        detailTeamLogo.src = dataUrl;
                        detailTeamLogo.style.display = 'block';
                        saveData();
                        renderEquipos(); // Refresh teams grid
                        updateSelects(); // Refresh dropdowns
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // --- LÓGICA ESCÁNER OCR ---
    if (btnScanPlantilla) {
        btnScanPlantilla.addEventListener("click", () => {
            if (appData.config.estadoApertura === 'finalizado' && appData.config.estadoClausura === 'finalizado') {
                return alert("La temporada ha finalizado. No puedes añadir jugadores nuevos.");
            }
            uploadPlantillaScan.click();
        });
    }

    if (btnCloseScanner) {
        btnCloseScanner.addEventListener("click", () => {
            scannerModal.classList.remove("active");
            setTimeout(() => { scannerModal.style.display = "none"; }, 300);
            uploadPlantillaScan.value = "";
        });
    }

    let scannedPlayersState = [];

    if (uploadPlantillaScan) {
        uploadPlantillaScan.addEventListener("change", async function () {
            const file = this.files[0];
            if (!file) return;

            // Abrimos el modal INMEDIATAMENTE para dar feedback visual asegurado
            scannerModal.style.display = "flex";
            setTimeout(() => scannerModal.classList.add("active"), 10);
            scannerResultsBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 30px;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 24px; margin-bottom:10px;"></i><br>Preparando imagen...</td></tr>`;

            const img = new Image();
            const objectUrl = URL.createObjectURL(file);
            
            img.onload = async () => {
                // Liberar memoria
                URL.revokeObjectURL(objectUrl);
                
                // Reducir la imagen si es muy grande (previene crashes silenciosos en móviles/fotos HD)
                const MAX_WIDTH = 1500;
                let width = img.width;
                let height = img.height;
                
                if (width > MAX_WIDTH) {
                    height = Math.round((height * MAX_WIDTH) / width);
                    width = MAX_WIDTH;
                }
                
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                try {
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                    
                    const result = await Tesseract.recognize(dataUrl, 'spa', {
                        logger: m => {
                            console.log(m);
                            if(m.status === 'recognizing text'){
                                scannerResultsBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 30px;"><i class="fa-solid fa-microchip" style="font-size: 24px; margin-bottom:10px; color: var(--accent-primary)"></i><br>Escaneando texto: ${Math.round(m.progress * 100)}%</td></tr>`;
                            } else {
                                scannerResultsBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 30px;"><i class="fa-solid fa-download" style="font-size: 24px; margin-bottom:10px;"></i><br>Descargando modelo de IA (${m.status})...</td></tr>`;
                            }
                        }
                    });
                    
                    const text = result.data.text;
                    console.log("Texto extraído:", text);
                    
                    // Procesar texto
                    let lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 3);
                    scannedPlayersState = [];
                    
                    for (const line of lines) {
                        let rawName = line.replace(/^[0-9\.\-\_\*\#]+/, '').trim();
                        if (rawName.length < 3) continue;
                        
                        let nameLower = rawName.toLowerCase();
                        let existingPlayer = appData.jugadores.find(j => (j.nombre || "").toLowerCase() === nameLower);
                        
                        let status = 'nuevo';
                        let statusText = 'Nuevo';
                        let statusClass = 'status-nuevo';
                        let canTransfer = false;
                        
                        if (existingPlayer) {
                            if (existingPlayer.equipoId == currentTeamId) {
                                status = 'existe_aqui';
                                statusText = 'Ya en el equipo';
                                statusClass = 'status-existe-aqui';
                            } else {
                                status = 'existe_otro';
                                let equipo = appData.equipos.find(e => e.id == existingPlayer.equipoId);
                                statusText = equipo ? `En ${equipo.nombre}` : 'En otro equipo';
                                statusClass = 'status-existe-otro';
                                canTransfer = true;
                            }
                        }
                        
                        scannedPlayersState.push({
                            rawName: rawName,
                            status: status,
                            statusText: statusText,
                            statusClass: statusClass,
                            canTransfer: canTransfer,
                            existingPlayer: existingPlayer
                        });
                    }
                    
                    if (scannedPlayersState.length === 0) {
                        scannerResultsBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 30px; color: var(--error-color)"><i class="fa-solid fa-triangle-exclamation" style="font-size: 24px; margin-bottom:10px;"></i><br>No se encontraron nombres válidos en la imagen. Intenta con otra foto.</td></tr>`;
                        return;
                    }
                    
                    scannerResultsBody.innerHTML = '';
                    scannedPlayersState.forEach((player, index) => {
                        const tr = document.createElement('tr');
                        let transferHtml = '';
                        if (player.canTransfer) {
                            transferHtml = `<label><input type="checkbox" class="scan-transfer-check" data-index="${index}"> Sí</label>`;
                        } else if (player.status === 'existe_aqui') {
                            transferHtml = `<span style="color:var(--text-muted)">N/A</span>`;
                        }
                        
                        tr.innerHTML = `
                            <td><input type="text" class="scanner-input scan-name-input" data-index="${index}" value="${player.rawName}" ${player.status === 'existe_aqui' ? 'disabled' : ''}></td>
                            <td><input type="checkbox" class="scan-novato-check" data-index="${index}" ${player.status !== 'nuevo' ? 'disabled' : ''}></td>
                            <td><input type="checkbox" class="scan-portero-check" data-index="${index}" ${player.status !== 'nuevo' ? 'disabled' : ''}></td>
                            <td><span class="${player.statusClass}">${player.statusText}</span></td>
                            <td>${transferHtml}</td>
                            <td><button class="btn-action btn-scan-remove" data-index="${index}" style="color:var(--error-color)"><i class="fa-solid fa-trash"></i></button></td>
                        `;
                        scannerResultsBody.appendChild(tr);
                    });
                    
                    document.querySelectorAll('.btn-scan-remove').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            e.target.closest('tr').remove();
                        });
                    });
                    
                } catch (err) {
                    console.error("Error en OCR:", err);
                    scannerResultsBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 30px; color: var(--error-color)"><i class="fa-solid fa-triangle-exclamation" style="font-size: 24px; margin-bottom:10px;"></i><br>Hubo un error al procesar la imagen: ${err.message}</td></tr>`;
                }
            };
            
            img.onerror = () => {
                scannerResultsBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 30px; color: var(--error-color)"><i class="fa-solid fa-triangle-exclamation" style="font-size: 24px; margin-bottom:10px;"></i><br>Error al leer el archivo de imagen.</td></tr>`;
            };
            
            img.src = objectUrl;
            this.value = '';
        });
    }

    if (btnInscribirEscaneados) {
        btnInscribirEscaneados.addEventListener("click", async () => {
            const rows = scannerResultsBody.querySelectorAll('tr');
            if (rows.length === 0) return alert("No hay jugadores para inscribir.");
            
            showLoader("Inscribiendo jugadores...");
            let addedCount = 0;
            let transferCount = 0;
            
            const teamPlayers = appData.jugadores.filter(j => j.equipoId == currentTeamId);
            let totalPlantilla = teamPlayers.length;
            
            for (const tr of rows) {
                if (totalPlantilla >= 22) {
                    alert(`Límite alcanzado (22). Se inscribieron/traspasaron ${addedCount + transferCount} jugadores.`);
                    break;
                }
                
                const nameInput = tr.querySelector('.scan-name-input');
                if (!nameInput) continue;
                
                const index = nameInput.dataset.index;
                const playerState = scannedPlayersState[index];
                const finalName = nameInput.value.trim();
                if (!finalName) continue;
                if (playerState.status === 'existe_aqui') continue;
                
                if (playerState.status === 'existe_otro') {
                    const transferCheck = tr.querySelector('.scan-transfer-check');
                    if (transferCheck && transferCheck.checked) {
                        if (playerState.existingPlayer.transferencias >= 2) {
                            console.log(`Jugador ${finalName} no puede ser traspasado (límite 2).`);
                            continue;
                        }
                        const oldTeamId = playerState.existingPlayer.equipoId;
                        const { error } = await supabase.from('jugadores')
                            .update({ equipo_id: currentTeamId, transferencias: playerState.existingPlayer.transferencias + 1 })
                            .eq('id', playerState.existingPlayer.id);
                            
                        if (!error) {
                            playerState.existingPlayer.equipoId = currentTeamId;
                            playerState.existingPlayer.transferencias += 1;
                            
                            const { data: movData } = await supabase.from('movimientos').insert([{
                                torneo_id: activeId,
                                jugador_id: playerState.existingPlayer.id,
                                tipo: 'traspaso',
                                equipo_origen_id: oldTeamId,
                                equipo_destino_id: currentTeamId,
                                fecha: new Date().toISOString()
                            }]).select();
                            
                            if (movData) appData.movimientos.push(movData[0]);
                            transferCount++;
                            totalPlantilla++;
                        }
                    }
                    continue;
                }
                
                if (playerState.status === 'nuevo') {
                    const isNovato = tr.querySelector('.scan-novato-check').checked;
                    const isPortero = tr.querySelector('.scan-portero-check').checked;
                    
                    const { data, error } = await supabase.from('jugadores').insert([{
                        torneo_id: activeId,
                        equipo_id: currentTeamId,
                        nombre: finalName,
                        is_novato: isNovato,
                        is_portero: isPortero,
                        status: 'activo',
                        transferencias: 0
                    }]).select();
                    
                    if (!error && data && data.length > 0) {
                        const j = data[0];
                        appData.jugadores.push({
                            id: j.id.toString(),
                            equipoId: j.equipo_id.toString(),
                            nombre: j.nombre,
                            name: j.nombre,
                            isNovato: j.is_novato,
                            isPortero: j.is_portero,
                            status: j.status,
                            transferencias: j.transferencias,
                            stats: {
                                apertura: { goles: 0, amarillas: 0, rojas: 0, golesRecibidos: 0 },
                                clausura: { goles: 0, amarillas: 0, rojas: 0, golesRecibidos: 0 }
                            }
                        });
                        
                        const { data: movData } = await supabase.from('movimientos').insert([{
                            torneo_id: activeId,
                            jugador_id: j.id,
                            tipo: 'alta',
                            equipo_destino_id: currentTeamId,
                            fecha: new Date().toISOString()
                        }]).select();
                        if (movData) appData.movimientos.push(movData[0]);
                        
                        addedCount++;
                        totalPlantilla++;
                    }
                }
            }
            
            hideLoader();
            scannerModal.style.display = "none";
            alert(`Proceso finalizado. Nuevos: ${addedCount}. Traspasos: ${transferCount}.`);
            
            renderTeamDetail(currentTeamId);
            updateSelects();
            renderMercado();
        });
    }
    // --- FIN LÓGICA ESCÁNER OCR ---
    
    // Elements - Mercado
    const altasBody = document.getElementById("altas-body");
    const bajasBody = document.getElementById("bajas-body");

    // Elements - Sorteos
    const formGenerarSorteo = document.getElementById("form-generar-sorteo");
    const sorteoResultadosContainer = document.getElementById("sorteo-resultados-container");
    const sorteoResultadosSection = document.getElementById("sorteo-resultados-section");

    // Elements - Stats
    const tableBody = document.getElementById("table-body");
    const theadTr = document.querySelector("#view-stats thead tr");
    const tableContainer = document.querySelector("#view-stats .table-container");

    const topPlayerName = document.getElementById("top-player-name");
    const topPlayerStat = document.getElementById("top-player-stat");
    const statColumnHeader = document.getElementById("stat-column-header");

    // Elements - General Modal
    const btnOpenAdmin = document.getElementById("btn-open-admin");
    const btnCloseAdmin = document.getElementById("btn-close-admin");
    const adminModal = document.getElementById("admin-modal");

    // Elements - Inline Modals
    const inlineEditModal = document.getElementById("inline-edit-modal");
    const inlineTransferModal = document.getElementById("inline-transfer-modal");

    // BTN IMPORTAR EQUIPOS
    const btnImportarEquipos = document.getElementById("btn-importar-equipos");
    if (btnImportarEquipos) {
        btnImportarEquipos.addEventListener("click", async () => {
            showLoader("Importando tus 16 equipos a la base de datos...");
            const teamsToAdd = [
                "FC VALLE DEL ATLETICO", "ATLTEICO LAS LLANTAS", "FC MUSULI", "FK BODO/GLIMT",
                "PUMAS FC", "FENIX FC", "DIABLOS ROJOS", "SHALQUE 04",
                "PC GALAXY", "EL BARRIO", "FC CALERA", "FC LOS ARADOS",
                "FC ROSALES", "FC LA UNION", "FC LOS HALCONES", "LA SELE-SAGUASCA"
            ];
            let count = 0;
            for (const name of teamsToAdd) {
                const { error } = await supabase.from('equipos').insert([{
                    torneo_id: activeId,
                    nombre: name,
                    logo: ''
                }]);
                if (!error) count++;
            }
            alert(`¡Importación exitosa! Se han agregado ${count} equipos. La página se recargará ahora.`);
            window.location.reload();
        });
    }

    // Removed magic import logic

    // Forms
    const formNewTeam = document.getElementById("form-new-team");
    const formNewPlayer = document.getElementById("form-new-player");
    const formAddStat = document.getElementById("form-add-stat");
    const formTransfer = document.getElementById("form-transfer");
    const formBaja = document.getElementById("form-baja");

    const formInlineEdit = document.getElementById("form-inline-edit");
    const formInlineTransfer = document.getElementById("form-inline-transfer");
    
    const editPlayerPhotoInput = document.getElementById("edit-player-photo-input");
    if (editPlayerPhotoInput) {
        editPlayerPhotoInput.addEventListener("change", function () {
            const file = this.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    const dataUrl = e.target.result;
                    const preview = document.getElementById("edit-player-photo-preview");
                    const fallback = document.getElementById("edit-player-photo-fallback");
                    if (preview && fallback) {
                        preview.src = dataUrl;
                        preview.style.display = 'block';
                        fallback.style.display = 'none';
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }

    let currentView = "equipos";
    let currentTab = "equipos";
    window.currentJornadaTab = null;
    let currentTeamId = null;

    // Initialize UI
    const seasonLabel = document.getElementById("season-label");
    if (seasonLabel) seasonLabel.textContent = appData.config.anioActual;

    function initLigaInfo() {
        const liga = appData.config.ligaInfo;
        if (!liga) return;

        // Títulos
        if (liga.nombre) {
            document.getElementById("liga-name-title").textContent = liga.nombre;
        }

        const subtitle = document.getElementById("liga-lugar-subtitle");
        if (liga.lugar) {
            subtitle.textContent = liga.lugar.toUpperCase();
            subtitle.style.display = 'block';
        } else {
            subtitle.style.display = 'none';
        }

        // Logo
        const iconLogo = document.getElementById("liga-logo-icon");
        const imgLogo = document.getElementById("liga-logo-img");
        if (liga.logo) {
            iconLogo.style.display = 'none';
            imgLogo.src = liga.logo;
            imgLogo.style.display = 'block';
        }

        // Portada
        const banner = document.getElementById("liga-portada-banner");
        if (liga.portada) {
            banner.style.backgroundImage = `url(${liga.portada})`;
            banner.style.display = 'block';
        }

        // Contact info
        const contactDiv = document.getElementById("liga-contact-info");
        const campoText = document.getElementById("liga-campo-text");
        const celularText = document.getElementById("liga-celular-text");

        let hasContactInfo = false;
        if (liga.campo) {
            campoText.textContent = liga.campo;
            campoText.parentElement.style.display = 'block';
            hasContactInfo = true;
        } else {
            campoText.parentElement.style.display = 'none';
        }

        if (liga.celular) {
            celularText.textContent = liga.celular;
            celularText.parentElement.style.display = 'block';
            hasContactInfo = true;
        } else {
            celularText.parentElement.style.display = 'none';
        }

        if (hasContactInfo) {
            contactDiv.style.display = 'block';
        }
    }

    // Banner Elements
    const finishedBanner = document.getElementById("finished-tournament-banner");
    const finishedBannerTitle = document.getElementById("finished-banner-title");
    const finishedBannerDesc = document.getElementById("finished-banner-desc");

    function updateFinishedBanner() {
        if (!finishedBanner || !finishedBannerTitle || !finishedBannerDesc) return;

        const config = appData.config;
        if (config.tipoTorneo === 'unico') {
            if (config.estadoApertura === 'finalizado') {
                finishedBannerTitle.textContent = "Temporada Finalizada";
                finishedBannerDesc.textContent = `La temporada ${config.anioActual} ha concluido. El registro está en modo de solo lectura.`;
                finishedBanner.style.display = 'flex';
            } else {
                finishedBanner.style.display = 'none';
            }
        } else {
            if (currentTorneo === 'apertura' && config.estadoApertura === 'finalizado') {
                finishedBannerTitle.textContent = "Torneo de Apertura ha finalizado";
                finishedBannerDesc.textContent = `El Torneo de Apertura de la temporada ${config.anioActual} ha finalizado y está en modo de solo lectura. Selecciona el torneo Clausura en el menú superior para registrar nuevos movimientos y estadísticas.`;
                finishedBanner.style.display = 'flex';
            } else if (currentTorneo === 'clausura' && config.estadoClausura === 'finalizado') {
                finishedBannerTitle.textContent = "Torneo de Clausura ha finalizado";
                finishedBannerDesc.textContent = `El Torneo de Clausura ha concluido. Toda la temporada ${config.anioActual} ha finalizado y está en modo de solo lectura.`;
                finishedBanner.style.display = 'flex';
            } else {
                finishedBanner.style.display = 'none';
            }
        }
    }

    initLigaInfo();

    const logoContainerInit = document.querySelector(".sidebar .logo-container");
    if (logoContainerInit) logoContainerInit.style.display = 'none';
    renderInicio();
    renderTeams();
    updateSelects();
    updateCalendarioUI();

    function applyTorneoMode() {
        const tBtns = document.querySelector(".tournament-selector");
        if (appData.config.tipoTorneo === 'unico') {
            if (tBtns) tBtns.style.display = 'none';
        } else {
            if (tBtns) tBtns.style.display = 'flex';
        }
    }

    applyTorneoMode();
    updateSeasonBtn();
    updateFinishedBanner();

    // Event Listeners for Tournament Toggle
    tournamentBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const targetTorneo = btn.getAttribute("data-torneo");

            // Bloquear ver Clausura si Apertura sigue activo
            if (targetTorneo === 'clausura' && appData.config.estadoApertura === 'activo') {
                return alert("Debes Finalizar el Apertura antes de poder entrar al torneo Clausura.");
            }

            tournamentBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentTorneo = targetTorneo;

            // Update banner
            updateFinishedBanner();

            // Refresh current view if it's stats
            if (document.getElementById("view-stats").classList.contains("active")) {
                renderStats(currentTab);
            }

            // Refresh team detail if it is open
            if (currentTeamId) {
                showTeamDetail(appData.equipos.find(t => t.id === currentTeamId));
            }
        });
    });

    function updateSeasonBtn() {
        if (!btnFinishApertura) return;
        const config = appData.config;

        if (config.tipoTorneo === 'unico') {
            if (config.estadoApertura === 'activo') {
                btnFinishApertura.innerHTML = '<i class="fa-solid fa-flag-checkered"></i> Finalizar Temporada';
                btnFinishApertura.style.backgroundColor = '#EF4444';
            } else {
                btnFinishApertura.innerHTML = `<i class="fa-solid fa-play"></i> Iniciar Nueva Temporada`;
                btnFinishApertura.style.backgroundColor = '#10B981'; // Green
            }
        } else {
            if (config.estadoApertura === 'activo') {
                btnFinishApertura.innerHTML = '<i class="fa-solid fa-flag-checkered"></i> Finalizar Apertura';
                btnFinishApertura.style.backgroundColor = '#EF4444';
            } else if (config.estadoApertura === 'finalizado' && config.estadoClausura === 'activo') {
                btnFinishApertura.innerHTML = '<i class="fa-solid fa-flag-checkered"></i> Finalizar Clausura';
                btnFinishApertura.style.backgroundColor = '#EF4444';
            } else if (config.estadoApertura === 'finalizado' && config.estadoClausura === 'finalizado') {
                btnFinishApertura.innerHTML = `<i class="fa-solid fa-play"></i> Iniciar Nueva Temporada`;
                btnFinishApertura.style.backgroundColor = '#10B981'; // Green
            }
        }
    }

    if (btnFinishApertura) {
        btnFinishApertura.addEventListener("click", () => {
            const config = appData.config;

            if (config.tipoTorneo === 'unico') {
                if (config.estadoApertura === 'activo') {
                    if (!confirm("¿Estás seguro de que deseas FINALIZAR LA TEMPORADA? \n\nEsto finalizará el campeonato. No podrás editar más estadísticas ni movimientos hasta iniciar la próxima temporada.")) return;

                    config.estadoApertura = 'finalizado';
                    saveData();
                    updateSeasonBtn();
                    updateFinishedBanner();
                    if (currentTeamId) showTeamDetail(appData.equipos.find(t => t.id === currentTeamId));
                    alert("Temporada Finalizada. Modo de solo lectura activado.");
                } else {
                    let nuevoAnio = prompt(`¿Qué año deseas para la nueva temporada?`, config.anioActual + 1);
                    if (nuevoAnio !== null && nuevoAnio.trim() !== '') {
                        nuevoAnio = parseInt(nuevoAnio);
                        if (!isNaN(nuevoAnio)) {
                            config.anioActual = nuevoAnio;
                            config.estadoApertura = 'activo';

                            // Resetear estadísticas y movimientos
                            appData.jugadores.forEach(p => {
                                p.transferencias = 0;
                                p.stats = {
                                    apertura: { goles: 0, amarillas: 0, rojas: 0, golesRecibidos: 0, minutos: 0 },
                                    clausura: { goles: 0, amarillas: 0, rojas: 0, golesRecibidos: 0, minutos: 0 }
                                };
                            });
                            appData.movimientos = [];

                            saveData();
                            updateSeasonBtn();
                            updateFinishedBanner();
                            document.getElementById("season-label").textContent = config.anioActual;

                            // Forzar volver a inicio de equipos
                            document.querySelector('[data-view="equipos"]').click();
                            alert(`¡Nueva Temporada ${nuevoAnio} Iniciada! Se han reiniciado las estadísticas y transferencias.`);
                        } else {
                            alert("Año inválido. Operación cancelada.");
                        }
                    }
                }
            } else {
                if (config.estadoApertura === 'activo') {
                    if (!confirm("¿Estás seguro de que deseas FINALIZAR EL APERTURA? \n\nEsto pasará automáticamente al torneo Clausura. Los goles y estadísticas empezarán de cero, pero el acumulado de tarjetas amarillas y rojas se mantendrá para el nuevo torneo.")) return;

                    appData.jugadores.forEach(p => {
                        p.stats.clausura.amarillas = p.stats.apertura.amarillas;
                        p.stats.clausura.rojas = p.stats.apertura.rojas;
                    });

                    config.estadoApertura = 'finalizado';
                    config.estadoClausura = 'activo';
                    saveData();
                    updateSeasonBtn();
                    updateFinishedBanner();
                    document.querySelector('[data-torneo="clausura"]').click();
                    alert("Torneo Apertura Finalizado. Las tarjetas han sido transferidas al Clausura.");

                } else if (config.estadoApertura === 'finalizado' && config.estadoClausura === 'activo') {
                    if (!confirm("¿Estás seguro de que deseas FINALIZAR EL CLAUSURA? \n\nEsto finalizará toda la temporada. No podrás editar más estadísticas ni movimientos hasta iniciar la próxima temporada.")) return;

                    config.estadoClausura = 'finalizado';
                    
                    // Limpiar movimientos al finalizar la temporada
                    appData.movimientos = [];
                    
                    saveData();
                    updateSeasonBtn();
                    updateFinishedBanner();
                    if (currentTeamId) showTeamDetail(appData.equipos.find(t => t.id === currentTeamId));
                    if (document.getElementById("view-mercado").classList.contains("active")) renderMercado();
                    
                    alert("Temporada Finalizada. Modo de solo lectura activado y se ha limpiado el mercado de transferencias para la próxima temporada.");

                } else if (config.estadoApertura === 'finalizado' && config.estadoClausura === 'finalizado') {
                    let nuevoAnio = prompt(`¿Qué año deseas para la nueva temporada?`, config.anioActual + 1);
                    if (nuevoAnio !== null && nuevoAnio.trim() !== '') {
                        nuevoAnio = parseInt(nuevoAnio);
                        if (!isNaN(nuevoAnio)) {
                            config.anioActual = nuevoAnio;
                            config.estadoApertura = 'activo';
                            config.estadoClausura = 'pendiente';

                            // Resetear estadísticas y movimientos
                            appData.jugadores.forEach(p => {
                                p.transferencias = 0;
                                p.stats = {
                                    apertura: { goles: 0, amarillas: 0, rojas: 0, golesRecibidos: 0, minutos: 0 },
                                    clausura: { goles: 0, amarillas: 0, rojas: 0, golesRecibidos: 0, minutos: 0 }
                                };
                            });
                            appData.movimientos = [];

                            saveData();
                            updateSeasonBtn();
                            updateFinishedBanner();
                            document.getElementById("season-label").textContent = config.anioActual;

                            // Forzar ir a Apertura
                            document.querySelector('[data-torneo="apertura"]').click();
                            document.querySelector('[data-view="equipos"]').click();
                            alert(`¡Nueva Temporada ${nuevoAnio} Iniciada! Se han reiniciado las estadísticas y transferencias.`);
                        } else {
                            alert("Año inválido. Operación cancelada.");
                        }
                    }
                }
            }
        });
    }

    // Event Listeners for Sidebar Nav
    navItems.forEach(item => {
        item.addEventListener("click", (e) => {
            e.preventDefault();
            navItems.forEach(nav => nav.classList.remove("active"));
            item.classList.add("active");

            const viewTarget = item.getAttribute("data-view");
            currentTab = item.getAttribute("data-tab");

            viewSections.forEach(sec => sec.classList.remove("active"));

            const logoContainer = document.querySelector(".sidebar .logo-container");

            if (viewTarget === 'inicio') {
                if (logoContainer) logoContainer.style.display = 'none';
                document.getElementById("view-inicio").classList.add("active");
                currentTabTitle.textContent = "Resumen del Campeonato";
                renderInicio();
            } else if (viewTarget === 'stats') {
                if (logoContainer) logoContainer.style.display = 'flex';
                document.getElementById("view-stats").classList.add("active");
                renderStats(currentTab);
            } else if (viewTarget === 'equipos') {
                if (logoContainer) logoContainer.style.display = 'flex';
                viewEquipos.classList.add("active");
                currentTabTitle.textContent = "Equipos de la Liga";
                renderTeams();
            } else if (viewTarget === 'mercado') {
                if (logoContainer) logoContainer.style.display = 'flex';
                document.getElementById("view-mercado").classList.add("active");
                currentTabTitle.textContent = "Mercado de Jugadores";
                renderMercado();
            } else if (viewTarget === 'inactivos') {
                if (logoContainer) logoContainer.style.display = 'flex';
                document.getElementById("view-inactivos").classList.add("active");
                currentTabTitle.textContent = "Agentes Libres e Inactivos";
                renderInactivos();
            } else if (viewTarget === 'sorteos') {
                if (logoContainer) logoContainer.style.display = 'flex';
                document.getElementById("view-sorteos").classList.add("active");
                currentTabTitle.textContent = "Sorteos y Emparejamientos";
                updateCalendarioUI();
            } else if (viewTarget === 'posiciones') {
                if (logoContainer) logoContainer.style.display = 'flex';
                document.getElementById("view-posiciones").classList.add("active");
                currentTabTitle.textContent = "Tabla de Posiciones";
                renderTablaPosiciones();
            }

        });
    });

    btnBackEquipos.addEventListener("click", () => {
        viewEquipoDetalle.classList.remove("active");
        viewEquipos.classList.add("active");
        currentTabTitle.textContent = "Equipos de la Liga";
    });

    // Inline Add Player Button
    const addPlayerModal = document.getElementById("add-player-modal");

    btnInlineAddPlayer.addEventListener("click", () => {
        addPlayerModal.classList.add("active");
        updateSelects();
        if (currentTeamId) {
            document.getElementById("new-player-team").value = currentTeamId;
            const t = appData.equipos.find(eq => eq.id === currentTeamId);
            if (t) document.getElementById("new-player-team-name").value = t.nombre;
        }
    });

    document.getElementById("btn-close-add-player").addEventListener("click", () => {
        addPlayerModal.classList.remove("active");
    });

    // Admin Modal Logic
    document.querySelectorAll(".admin-tab").forEach(tab => {
        tab.addEventListener("click", (e) => {
            e.preventDefault();
            document.querySelectorAll(".admin-tab").forEach(t => t.classList.remove("active"));
            document.querySelectorAll(".admin-section-content").forEach(s => s.classList.remove("active"));

            tab.classList.add("active");
            const target = tab.getAttribute("data-target");
            document.getElementById(target).classList.add("active");

            // Populate Liga Form
            if (target === "admin-liga") {
                const info = appData.config.ligaInfo || {};
                document.getElementById("liga-dedicatoria").value = info.dedicatoria || "";
                document.getElementById("liga-eslogan").value = info.eslogan || "";
                document.getElementById("liga-correo").value = info.correo || "";
                document.getElementById("liga-web").value = info.sitio_web || "";
                document.getElementById("liga-fecha-inicio").value = info.fecha_inicio || "";
                document.getElementById("liga-fecha-fin").value = info.fecha_fin || "";
            }
        });
    });

    btnOpenAdmin.addEventListener("click", (e) => {
        e.preventDefault();
        const config = appData.config;
        const isLocked = currentTorneo === 'apertura' ? config.estadoApertura === 'finalizado' : config.estadoClausura === 'finalizado';
        if (isLocked) {
            return alert(`El torneo ${currentTorneo.toUpperCase()} ha finalizado y está en modo de solo lectura. Selecciona el torneo activo para realizar modificaciones.`);
        }
        adminModal.classList.add("active");
        updateSelects();
    });

    btnCloseAdmin.addEventListener("click", () => adminModal.classList.remove("active"));
    document.getElementById("btn-close-inline-edit").addEventListener("click", () => inlineEditModal.classList.remove("active"));
    document.getElementById("btn-close-inline-transfer").addEventListener("click", () => inlineTransferModal.classList.remove("active"));

    const modalOpcionesFecha = document.getElementById("modal-opciones-fecha");
    if (modalOpcionesFecha) {
        document.getElementById("btn-close-opciones-fecha").addEventListener("click", () => {
            modalOpcionesFecha.classList.remove("active");
        });
        // Cerrar si se hace clic fuera del modal content
        modalOpcionesFecha.addEventListener("click", (e) => {
            if (e.target === modalOpcionesFecha) {
                modalOpcionesFecha.classList.remove("active");
            }
        });
    }

    const modalExportar = document.getElementById("modal-exportar");
    if (modalExportar) {
        document.getElementById("btn-close-exportar").addEventListener("click", () => {
            modalExportar.classList.remove("active");
        });
        modalExportar.addEventListener("click", (e) => {
            if (e.target === modalExportar) {
                modalExportar.classList.remove("active");
            }
        });

        const btnAbrirExportar = document.getElementById("btn-abrir-exportar");
        if (btnAbrirExportar) {
            btnAbrirExportar.addEventListener("click", () => {
                if (modalOpcionesFecha) modalOpcionesFecha.classList.remove("active");
                modalExportar.classList.add("active");
            });
        }

        // Export Actions
        const btnExportPdf = document.getElementById("btn-export-pdf");
        if (btnExportPdf) {
            btnExportPdf.addEventListener("click", () => {
                exportarPDF();
                modalExportar.classList.remove("active");
            });
        }

        const btnExportImg = document.getElementById("btn-export-img");
        if (btnExportImg) {
            btnExportImg.addEventListener("click", () => {
                exportarImagen();
                modalExportar.classList.remove("active");
            });
        }

        const btnExportCsv = document.getElementById("btn-export-csv");
        if (btnExportCsv) {
            btnExportCsv.addEventListener("click", () => {
                exportarCSV();
                modalExportar.classList.remove("active");
            });
        }
    }

    // Save Liga Data
    document.getElementById("form-update-liga").addEventListener("submit", async (e) => {
        e.preventDefault();

        const dedicatoria = document.getElementById("liga-dedicatoria").value.trim();
        const eslogan = document.getElementById("liga-eslogan").value.trim();
        const correo = document.getElementById("liga-correo").value.trim();
        const web = document.getElementById("liga-web").value.trim();
        const finicio = document.getElementById("liga-fecha-inicio").value;
        const ffin = document.getElementById("liga-fecha-fin").value;

        showLoader("Guardando datos de liga...");

        // Update Supabase
        let updateData = {
            dedicatoria: dedicatoria,
            eslogan: eslogan,
            correo: correo,
            sitio_web: web,
            fecha_inicio: finicio,
            fecha_fin: ffin
        };
        
        let { error } = await supabase.from('torneos').update(updateData).eq('id', activeId);

        if (error && error.message.includes('dedicatoria')) {
            // Fallback si la columna no existe
            delete updateData.dedicatoria;
            const res = await supabase.from('torneos').update(updateData).eq('id', activeId);
            error = res.error;
        }

        hideLoader();

        if (error) {
            console.error(error);
            alert("Error al guardar: " + error.message + "\n\n¿Agregaste las columnas a Supabase?");
        } else {
            // Update local state
            appData.config.ligaInfo.dedicatoria = dedicatoria;
            appData.config.ligaInfo.eslogan = eslogan;
            appData.config.ligaInfo.correo = correo;
            appData.config.ligaInfo.sitio_web = web;
            appData.config.ligaInfo.fecha_inicio = finicio;
            appData.config.ligaInfo.fecha_fin = ffin;

            // Re-render
            if (currentTab === "inicio" || document.getElementById("view-inicio").classList.contains("active")) {
                renderInicio();
            }

            alert("Datos de liga actualizados exitosamente.");
            document.getElementById("btn-close-admin").click();
        }
    });

    // Utils
    function formatDate(dateString) {
        const d = new Date(dateString);
        return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    }

    // 1. Crear Equipo
    formNewTeam.addEventListener("submit", (e) => {
        e.preventDefault();
        const name = document.getElementById("new-team-name").value;
        const logoFile = document.getElementById("new-team-logo").files[0];

        const saveTeam = (logoDataUrl) => {
            appData.equipos.push({
                id: Date.now().toString(),
                nombre: name, // Corregido de name: name a nombre: name
                logo: logoDataUrl || ''
            });
            saveData();
            renderTeams();
            updateSelects();
            formNewTeam.reset();
            alert("Equipo creado con éxito.");
        };

        if (logoFile) {
            const reader = new FileReader();
            reader.onload = (e) => saveTeam(e.target.result);
            reader.readAsDataURL(logoFile);
        } else {
            saveTeam(null);
        }
    });

    // 2. Crear Jugador
    formNewPlayer.addEventListener("submit", (e) => {
        e.preventDefault();

        const config = appData.config;
        const isLocked = config.tipoTorneo === 'unico' ? config.estadoApertura === 'finalizado' : config.estadoClausura === 'finalizado';

        if (isLocked) {
            return alert("La temporada ha finalizado. No puedes añadir jugadores nuevos.");
        }

        const name = document.getElementById("new-player-name").value.trim();
        const teamId = document.getElementById("new-player-team").value;
        const isNovato = document.getElementById("new-player-novato").checked;
        const isPortero = document.getElementById("new-player-portero").checked;
        const isFichaje = document.getElementById("new-player-mercado").checked;
        const photoFile = document.getElementById("new-player-photo").files[0];

        if (!teamId) return alert("Selecciona un equipo.");

        const currentPlayersCount = appData.jugadores.filter(p => p.equipoId === teamId && p.status === 'activo').length;
        if (currentPlayersCount >= 22) {
            return alert("LÍMITE ALCANZADO: El equipo ya cuenta con 22 jugadores en su plantilla. Deberás dar de baja a un jugador actual antes de poder inscribir a otro.");
        }

        // Validación de Nombre Duplicado (Ignorando mayúsculas/minúsculas)
        const nameLower = name.toLowerCase();
        const existingPlayer = appData.jugadores.find(p => p.name && p.name.toLowerCase() === nameLower);

        if (existingPlayer) {
            // Si el jugador ya existe, revisamos en qué equipo está
            if (existingPlayer.equipoId === teamId) {
                formNewPlayer.reset();
                if (currentTeamId === teamId) showTeamDetail(appData.equipos.find(t => t.id === teamId));
                return alert(`¡El jugador "${name}" ya está inscrito en tu equipo y listo para jugar la temporada! No es necesario volver a inscribirlo.`);
            } else if (existingPlayer.equipoId !== null) {
                const equipoObj = appData.equipos.find(eq => eq.id === existingPlayer.equipoId);
                const equipoNombre = equipoObj ? equipoObj.name : "otro equipo";

                // Moverlo automáticamente al nuevo equipo (Fricción Cero)
                const equipoOrigenId = existingPlayer.equipoId;
                existingPlayer.equipoId = teamId;
                existingPlayer.status = 'activo';
                existingPlayer.isNovato = isNovato;
                existingPlayer.isPortero = isPortero;

                if (isFichaje) {
                    appData.movimientos.push({
                        id: Date.now(),
                        fecha: new Date().toISOString(),
                        jugadorId: existingPlayer.id,
                        tipo: 'alta', // Lo registramos como alta/traspaso directo
                        equipoOrigenId: equipoOrigenId,
                        equipoDestinoId: teamId
                    });
                }

                saveData();
                updateSelects();
                formNewPlayer.reset();
                if (currentTeamId === teamId) showTeamDetail(appData.equipos.find(t => t.id === teamId));
                return alert(`El jugador "${name}" pertenecía a ${equipoNombre.toUpperCase()}, pero ha sido inscrito exitosamente en tu equipo para esta nueva temporada.`);
            } else {
                // El jugador existe pero está LIBRE (dado de baja)
                // Lo re-inscribimos en el nuevo equipo
                existingPlayer.equipoId = teamId;
                existingPlayer.status = 'activo';
                existingPlayer.isNovato = isNovato;
                existingPlayer.isPortero = isPortero;

                if (isFichaje) {
                    appData.movimientos.push({
                        id: Date.now(),
                        fecha: new Date().toISOString(),
                        jugadorId: existingPlayer.id,
                        tipo: 'alta',
                        equipoOrigenId: null,
                        equipoDestinoId: teamId
                    });
                }

                saveData();
                updateSelects();
                formNewPlayer.reset();
                if (currentTeamId === teamId) showTeamDetail(appData.equipos.find(t => t.id === teamId));
                return alert(`El jugador "${name}" (que estaba libre) ha sido re-inscrito exitosamente en el equipo.`);
            }
        }

        const savePlayer = (photoDataUrl) => {
            const newPlayerId = Date.now();
            appData.jugadores.push({
                id: newPlayerId,
                name: name,
                nombre: name,
                equipoId: teamId,
                isNovato: isNovato,
                isPortero: isPortero,
                status: 'activo',
                transferencias: 0,
                foto: photoDataUrl || '',
                stats: {
                    apertura: { goles: 0, amarillas: 0, rojas: 0, golesRecibidos: 0, minutos: 0 },
                    clausura: { goles: 0, amarillas: 0, rojas: 0, golesRecibidos: 0, minutos: 0 }
                }
            });

            if (isFichaje) {
                appData.movimientos.push({
                    id: Date.now(),
                    fecha: new Date().toISOString(),
                    jugadorId: newPlayerId,
                    tipo: 'alta',
                    equipoOrigenId: null,
                    equipoDestinoId: teamId
                });
            }

            saveData();
            renderTeams();
            updateSelects();
            formNewPlayer.reset();
            document.getElementById("new-player-photo-label").innerHTML = '<i class="fa-solid fa-camera"></i><span>Subir Foto</span>';
            addPlayerModal.classList.remove("active");
            if (currentTeamId === teamId) showTeamDetail(appData.equipos.find(t => t.id === teamId));
            alert("Jugador creado con éxito.");
        };

        if (photoFile) {
            const reader = new FileReader();
            reader.onload = (e) => savePlayer(e.target.result);
            reader.readAsDataURL(photoFile);
        } else {
            savePlayer(null);
        }
    });

    // Preview de foto de jugador
    const newPlayerPhotoInput = document.getElementById("new-player-photo");
    if (newPlayerPhotoInput) {
        newPlayerPhotoInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            const label = document.getElementById("new-player-photo-label");
            if (file && label) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    label.innerHTML = `<img src="${ev.target.result}" style="width:100%; height:100%; object-fit:cover; border-radius:var(--radius-full);">`;
                };
                reader.readAsDataURL(file);
            } else if (label) {
                label.innerHTML = '<i class="fa-solid fa-camera"></i><span>Subir Foto</span>';
            }
        });
    }

    // 3. Añadir Estadística
    formAddStat.addEventListener("submit", (e) => {
        e.preventDefault();

        // Verificar bloqueo de edición
        const config = appData.config;
        const isLocked = config.tipoTorneo === 'unico' ? config.estadoApertura === 'finalizado' : config.estadoClausura === 'finalizado';

        if (isLocked) {
            return alert("Toda la temporada ha finalizado. No puedes añadir estadísticas.");
        }
        if (currentTorneo === 'apertura' && config.estadoApertura === 'finalizado') {
            return alert("El torneo Apertura ha finalizado. No puedes modificar sus estadísticas.");
        }

        const playerId = parseInt(document.getElementById("select-player-stat").value);
        const statType = document.getElementById("select-stat-type").value;

        if (!playerId) return alert("Selecciona un jugador.");

        const player = appData.jugadores.find(p => p.id === playerId);
        if (player) {
            if (statType === 'golesRecibidos' && !player.isPortero) {
                return alert("Este jugador no es portero.");
            }
            player.stats[currentTorneo][statType] += 1;
            saveData();
            alert(`Estadística sumada en el torneo ${currentTorneo.toUpperCase()}.`);

            if (document.getElementById("view-stats").classList.contains("active")) {
                renderStats(currentTab);
            }
        }
    });

    // 4. Traspaso (Main Admin)
    formTransfer.addEventListener("submit", (e) => {
        e.preventDefault();
        const playerId = document.getElementById("select-player-transfer").value;
        const newTeamId = document.getElementById("select-team-transfer").value;
        handleTransfer(playerId, newTeamId);
    });

    // 5. Baja (Main Admin)
    formBaja.addEventListener("submit", (e) => {
        e.preventDefault();
        const playerId = document.getElementById("select-player-baja").value;
        handleBaja(playerId);
    });

    // UI de Calendarios
    function updateCalendarioUI() {
        window.manualCalendars = window.manualCalendars || [];
        const sel = document.getElementById("calendario-selector");
        if (sel) {
            sel.innerHTML = window.calendariosDisponibles.map(c => `<option value="${c}" ${c === window.currentCalendarioNombre ? 'selected' : ''}>${c}</option>`).join('');
        }
        
        // Save available calendars to localStorage to persist empty ones
        localStorage.setItem(`femfutpal_calendarios_${activeId}`, JSON.stringify(window.calendariosDisponibles));

        const matchesInCurrent = appData.partidos.filter(p => p.torneo === currentTorneo && p.calendario_nombre === window.currentCalendarioNombre);
        
        const isManual = window.manualCalendars.includes(window.currentCalendarioNombre);

        const panelGenerar = document.getElementById("panel-generar-calendario");
        const panelFase = document.getElementById("panel-agregar-fase");

        if (matchesInCurrent.length > 0 || isManual) {
            if(panelGenerar) panelGenerar.style.display = 'none';
            if(panelFase) panelFase.style.display = 'block';
        } else {
            if(panelGenerar) panelGenerar.style.display = 'block';
            if(panelFase) panelFase.style.display = 'none';
        }

        renderPartidosGenerados();
        renderTablaPosiciones();
    }
    
    window.startManualCalendar = function() {
        window.manualCalendars = window.manualCalendars || [];
        if (!window.manualCalendars.includes(window.currentCalendarioNombre)) {
            window.manualCalendars.push(window.currentCalendarioNombre);
        }
        updateCalendarioUI();
    };

    const selCalendario = document.getElementById("calendario-selector");
    if(selCalendario) {
        selCalendario.addEventListener("change", (e) => {
            window.currentCalendarioNombre = e.target.value;
            window.currentJornadaTab = null; // Reset tab on change
            updateCalendarioUI();
        });
    }

    const btnNuevoCalendario = document.getElementById("btn-nuevo-calendario");
    if (btnNuevoCalendario) {
        btnNuevoCalendario.addEventListener("click", () => {
            const nombre = prompt("Ingresa el nombre para el nuevo calendario (Ej: Liguilla, 2º Fase):");
            if (nombre && nombre.trim() !== "") {
                const trimNombre = nombre.trim();
                if (!window.calendariosDisponibles.includes(trimNombre)) {
                    window.calendariosDisponibles.push(trimNombre);
                }
                window.currentCalendarioNombre = trimNombre;
                window.currentJornadaTab = null;
                updateCalendarioUI();
            }
        });
    }

    const btnEliminarCalendario = document.getElementById("btn-eliminar-calendario");
    if (btnEliminarCalendario) {
        btnEliminarCalendario.addEventListener("click", async () => {
            if (window.calendariosDisponibles.length <= 1 && appData.partidos.filter(p=>p.calendario_nombre === window.currentCalendarioNombre).length === 0) {
                return alert("No se puede eliminar el único calendario base si ya está vacío.");
            }
            if (confirm(`¿Estás seguro de eliminar todo el calendario "${window.currentCalendarioNombre}"?`)) {
                showLoader("Eliminando calendario...");
                const calToDelete = window.currentCalendarioNombre;
                
                // Filter memory
                appData.partidos = appData.partidos.filter(p => !(p.torneo === currentTorneo && p.calendario_nombre === calToDelete));
                
                // Set default
                window.calendariosDisponibles = window.calendariosDisponibles.filter(c => c !== calToDelete);
                if(window.calendariosDisponibles.length === 0) window.calendariosDisponibles.push("Torneo Principal");
                window.currentCalendarioNombre = window.calendariosDisponibles[0];
                
                // Soft delete in Supabase (because RLS blocks DELETE commands)
                const { error: delError } = await supabase.from('partidos').update({ calendario_nombre: '__DELETED__' })
                    .eq('torneo_id', activeId)
                    .eq('calendario_nombre', calToDelete);
                
                if (delError) {
                    console.error("Error soft-deleting calendar from Supabase:", delError);
                }

                await savePartidosToSupabase();
                updateCalendarioUI();
                hideLoader();
            }
        });
    }

    // 6. Generador de Sorteos / Partidos
    if (formGenerarSorteo) {
        const sorteoFaseSelect = document.getElementById("sorteo-fase");
        const grupoNumContainer = document.getElementById("grupo-num-container");
        const elimClasifContainer = document.getElementById("eliminatoria-top-container");

        if (sorteoFaseSelect) {
            sorteoFaseSelect.addEventListener("change", () => {
                if (sorteoFaseSelect.value === 'grupos') {
                    if (grupoNumContainer) grupoNumContainer.style.display = 'block';
                    if (elimClasifContainer) elimClasifContainer.style.display = 'none';
                } else if (sorteoFaseSelect.value === 'eliminatorias_clasificacion') {
                    if (grupoNumContainer) grupoNumContainer.style.display = 'none';
                    if (elimClasifContainer) elimClasifContainer.style.display = 'block';
                } else {
                    if (grupoNumContainer) grupoNumContainer.style.display = 'none';
                    if (elimClasifContainer) elimClasifContainer.style.display = 'none';
                }
            });
        }

        formGenerarSorteo.addEventListener("submit", async (e) => {
            e.preventDefault();

            const fase = document.getElementById("sorteo-fase").value; // liga | grupos | eliminatorias | eliminatorias_clasificacion
            const formato = document.getElementById("sorteo-formato").value; // ida | idayvuelta

            if (appData.equipos.length < 2) {
                return alert("Necesitas al menos 2 equipos registrados para generar un sorteo.");
            }

            const isEliminatoria = fase.startsWith('eliminatorias');

            // Buscar si ya hay partidos en este calendario
            const partidosExistentes = appData.partidos.filter(p => p.torneo === currentTorneo && p.calendario_nombre === window.currentCalendarioNombre);
            
            if (partidosExistentes.length > 0) {
                // Filtrar partidos del mismo tipo (eliminatoria o regular)
                const partidosMismoTipo = partidosExistentes.filter(p => isEliminatoria ? p.fase.startsWith('eliminatoria') : (p.fase === 'liga' || p.fase === 'grupos'));
                
                if (partidosMismoTipo.length > 0) {
                    const tipoNombre = isEliminatoria ? "llaves eliminatorias" : "partidos regulares (liga/grupos)";
                    if (!confirm(`Ya hay ${tipoNombre} en el calendario "${window.currentCalendarioNombre}". ¿Borrar y sobreescribir esta fase?`)) return;
                    
                    // Solo borramos los del mismo tipo, preservando los demás
                    appData.partidos = appData.partidos.filter(p => {
                        if (p.torneo === currentTorneo && p.calendario_nombre === window.currentCalendarioNombre) {
                            const pIsEliminatoria = p.fase.startsWith('eliminatoria');
                            return pIsEliminatoria !== isEliminatoria; // Conservar solo si es de distinto tipo
                        }
                        return true;
                    });
                }
            }

            showLoader(`Generando calendario en ${window.currentCalendarioNombre}...`);
            let equiposActivos = [...appData.equipos].sort(() => Math.random() - 0.5);
            let idCounter = Date.now();

            if (fase === 'liga') {
                let equiposLiga = [...equiposActivos];
                if (equiposLiga.length % 2 !== 0) {
                    equiposLiga.push({ id: 'vacante', nombre: 'VACANTE (Descansa)', logo: '' });
                }

                const numEquipos = equiposLiga.length;
                const jornadas = numEquipos - 1;
                const partidosPorJornada = numEquipos / 2;

                for (let r = 0; r < jornadas; r++) {
                    for (let i = 0; i < partidosPorJornada; i++) {
                        const local = equiposLiga[i];
                        const visitante = equiposLiga[numEquipos - 1 - i];

                        appData.partidos.push({
                            id: (idCounter++).toString(),
                            torneo: currentTorneo,
                            calendario_nombre: window.currentCalendarioNombre,
                            fase: 'liga',
                            jornada: r + 1,
                            equipo1Id: local.id,
                            equipo2Id: visitante.id,
                            goles1: null,
                            goles2: null,
                            grupo: 'unico'
                        });

                        if (formato === 'idayvuelta') {
                            appData.partidos.push({
                                id: (idCounter++).toString(),
                                torneo: currentTorneo,
                                calendario_nombre: window.currentCalendarioNombre,
                                fase: 'liga',
                                jornada: r + 1 + jornadas,
                                equipo1Id: visitante.id,
                                equipo2Id: local.id,
                                goles1: null,
                                goles2: null,
                                grupo: 'unico'
                            });
                        }
                    }
                    equiposLiga.splice(1, 0, equiposLiga.pop());
                }

            } else if (fase === 'grupos') {
                const numGrupos = parseInt(document.getElementById("sorteo-grupos-num").value) || 2;
                if (numGrupos < 2 || numGrupos > 8) return alert("El número de grupos debe estar entre 2 y 8.");

                const letras = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
                const grupos = Array.from({ length: numGrupos }, () => []);

                equiposActivos.forEach((eq, index) => {
                    grupos[index % numGrupos].push(eq);
                });

                grupos.forEach((grupoEqs, gIndex) => {
                    const nombreGrupo = `Grupo ${letras[gIndex]}`;

                    let equiposLiga = [...grupoEqs];
                    if (equiposLiga.length % 2 !== 0) {
                        equiposLiga.push({ id: 'vacante', nombre: 'VACANTE (Descansa)', logo: '' });
                    }

                    const numEquipos = equiposLiga.length;
                    const jornadas = numEquipos - 1;
                    const partidosPorJornada = numEquipos / 2;

                    for (let r = 0; r < jornadas; r++) {
                        for (let i = 0; i < partidosPorJornada; i++) {
                            const local = equiposLiga[i];
                            const visitante = equiposLiga[numEquipos - 1 - i];

                            appData.partidos.push({
                                id: (idCounter++).toString(),
                                torneo: currentTorneo,
                                calendario_nombre: window.currentCalendarioNombre,
                                fase: 'grupos',
                                jornada: r + 1,
                                equipo1Id: local.id,
                                equipo2Id: visitante.id,
                                goles1: null,
                                goles2: null,
                                grupo: nombreGrupo
                            });

                            if (formato === 'idayvuelta') {
                                appData.partidos.push({
                                    id: (idCounter++).toString(),
                                    torneo: currentTorneo,
                                    calendario_nombre: window.currentCalendarioNombre,
                                    fase: 'grupos',
                                    jornada: r + 1 + jornadas,
                                    equipo1Id: visitante.id,
                                    equipo2Id: local.id,
                                    goles1: null,
                                    goles2: null,
                                    grupo: nombreGrupo
                                });
                            }
                        }
                        equiposLiga.splice(1, 0, equiposLiga.pop());
                    }
                });

            } else if (fase === 'eliminatorias') {
                let i = 0;
                let partidoCount = 1;
                while (i < equiposActivos.length) {
                    const local = equiposActivos[i];
                    const visitante = i + 1 < equiposActivos.length ? equiposActivos[i + 1] : { id: 'vacante', nombre: 'VACANTE (Descansa)', logo: '' };

                    appData.partidos.push({
                        id: (idCounter++).toString(),
                        torneo: currentTorneo,
                        calendario_nombre: window.currentCalendarioNombre,
                        fase: 'eliminatoria',
                        jornada: 1,
                        equipo1Id: local.id,
                        equipo2Id: visitante.id,
                        goles1: null,
                        goles2: null,
                        grupo: `Llave ${partidoCount}`
                    });

                    if (formato === 'idayvuelta' && visitante.id !== 'vacante') {
                        appData.partidos.push({
                            id: (idCounter++).toString(),
                            torneo: currentTorneo,
                            calendario_nombre: window.currentCalendarioNombre,
                            fase: 'eliminatoria',
                            jornada: 2,
                            equipo1Id: visitante.id,
                            equipo2Id: local.id,
                            goles1: null,
                            goles2: null,
                            grupo: `Llave ${partidoCount}`
                        });
                    }
                    partidoCount++;
                    i += 2;
                }
            } else if (fase === 'eliminatorias_clasificacion') {
                const clasificadosCount = parseInt(document.getElementById("sorteo-top-num").value) || 8;
                const tabla = getTablaDePosicionesArray();
                
                if (tabla.length < clasificadosCount) {
                    hideLoader();
                    return alert(`No hay suficientes equipos en la tabla de posiciones anterior. Tienes ${tabla.length} y quieres clasificar ${clasificadosCount}.`);
                }

                const clasificados = tabla.slice(0, clasificadosCount).map(t => t.equipo);
                let llaveCount = 1;
                for (let i = 0; i < clasificadosCount / 2; i++) {
                    const local = clasificados[i];
                    const visitante = clasificados[clasificadosCount - 1 - i];

                    appData.partidos.push({
                        id: (idCounter++).toString(),
                        torneo: currentTorneo,
                        calendario_nombre: window.currentCalendarioNombre,
                        fase: 'eliminatoria',
                        jornada: 1,
                        equipo1Id: local.id,
                        equipo2Id: visitante.id,
                        goles1: null,
                        goles2: null,
                        grupo: `Llave ${llaveCount} (${i+1}º vs ${clasificadosCount-i}º)`
                    });

                    if (formato === 'idayvuelta') {
                        appData.partidos.push({
                            id: (idCounter++).toString(),
                            torneo: currentTorneo,
                            calendario_nombre: window.currentCalendarioNombre,
                            fase: 'eliminatoria',
                            jornada: 2,
                            equipo1Id: visitante.id,
                            equipo2Id: local.id,
                            goles1: null,
                            goles2: null,
                            grupo: `Llave ${llaveCount} (${i+1}º vs ${clasificadosCount-i}º)`
                        });
                    }
                    llaveCount++;
                }
            }

            hideLoader();
            await savePartidosToSupabase();
            updateCalendarioUI();

            setTimeout(() => {
                sorteoResultadosSection.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        });
    }

    const btnAgregarVuelta = document.getElementById("btn-agregar-vuelta");
    if(btnAgregarVuelta) {
        btnAgregarVuelta.addEventListener("click", async () => {
            if(!confirm("¿Agregar una nueva vuelta invertida basada en los partidos existentes de este calendario?")) return;
            const matchesInCurrent = appData.partidos.filter(p => p.torneo === currentTorneo && p.calendario_nombre === window.currentCalendarioNombre);
            
            let maxJornada = 0;
            matchesInCurrent.forEach(p => { if(p.jornada > maxJornada) maxJornada = p.jornada; });
            
            // Replicar partidos de la 1er vuelta pero invirtiendo local/visitante
            const matchesPrimeraVuelta = matchesInCurrent.filter(p => p.jornada <= (maxJornada/2 || maxJornada)); // Aproximación
            let idCounter = Date.now();
            
            matchesPrimeraVuelta.forEach(p => {
                appData.partidos.push({
                    id: (idCounter++).toString(),
                    torneo: currentTorneo,
                    calendario_nombre: window.currentCalendarioNombre,
                    fase: p.fase,
                    jornada: p.jornada + maxJornada,
                    equipo1Id: p.equipo2Id, // INVERTIDOS
                    equipo2Id: p.equipo1Id,
                    goles1: null,
                    goles2: null,
                    grupo: p.grupo
                });
            });

            await savePartidosToSupabase();
            updateCalendarioUI();
        });
    }

    const btnCrearLlavesFase = document.getElementById("btn-crear-llaves-fase");
    if (btnCrearLlavesFase) {
        btnCrearLlavesFase.addEventListener("click", () => {
            // Activa el panel superior con la opción de eliminatorias por clasificación
            const panelGenerar = document.getElementById("panel-generar-calendario");
            if (panelGenerar) {
                panelGenerar.style.display = 'block';
                const sorteoFaseSelect = document.getElementById("sorteo-fase");
                if (sorteoFaseSelect) {
                    sorteoFaseSelect.value = "eliminatorias_clasificacion";
                    sorteoFaseSelect.dispatchEvent(new Event("change"));
                }
                document.querySelector(".tools-panel").scrollIntoView({ behavior: 'smooth' });
            }
        });
    }

    window.actualizarMarcador = function (partidoId) {
        const input1 = document.getElementById(`goles1-${partidoId}`);
        const input2 = document.getElementById(`goles2-${partidoId}`);

        const g1 = parseInt(input1.value);
        const g2 = parseInt(input2.value);

        if (isNaN(g1) || isNaN(g2)) {
            return alert("Ingresa un número válido para ambos goles (0 o mayor).");
        }

        const partido = appData.partidos.find(p => p.id === partidoId);
        if (partido) {
            partido.goles1 = g1;
            partido.goles2 = g2;
            savePartidosToSupabase();

            // Actualizar vista (feedback visual)
            input1.style.borderColor = "var(--accent-primary)";
            input2.style.borderColor = "var(--accent-primary)";
            input1.style.boxShadow = "var(--shadow-neon)";
            input2.style.boxShadow = "var(--shadow-neon)";
            setTimeout(() => {
                input1.style.borderColor = "var(--border-color)";
                input2.style.borderColor = "var(--border-color)";
                input1.style.boxShadow = "none";
                input2.style.boxShadow = "none";
            }, 500);

            renderTablaPosiciones();
        }
    }

    window.activeFaseTab = window.activeFaseTab || 'liga';

    // Manejador global para las tabs de fase (se asignan una vez si no están)
    if (!window.faseTabsInit) {
        document.addEventListener('click', (e) => {
            if (e.target.id === 'tab-fase-liga') {
                window.activeFaseTab = 'liga';
                renderPartidosGenerados();
            } else if (e.target.id === 'tab-fase-llaves') {
                window.activeFaseTab = 'llaves';
                renderPartidosGenerados();
            }
        });
        window.faseTabsInit = true;
    }

    function renderPartidosGenerados() {
        if (!sorteoResultadosContainer) return;

        let todosPartidos = appData.partidos.filter(p => p.torneo === currentTorneo && p.calendario_nombre === window.currentCalendarioNombre);
        
        const tieneLiga = todosPartidos.some(p => p.fase === 'liga' || p.fase === 'grupos');
        const tieneLlaves = todosPartidos.some(p => p.fase === 'eliminatoria' || p.fase.startsWith('eliminatorias'));

        const sorteoFaseTabs = document.getElementById("sorteo-fase-tabs");
        const tabLigaBtn = document.getElementById("tab-fase-liga");
        const tabLlavesBtn = document.getElementById("tab-fase-llaves");

        if (sorteoFaseTabs) {
            if (tieneLiga && tieneLlaves) {
                sorteoFaseTabs.style.display = "flex";
                if (window.activeFaseTab === 'liga') {
                    tabLigaBtn.className = "btn-primary";
                    tabLigaBtn.style.background = "";
                    tabLigaBtn.style.color = "";
                    tabLlavesBtn.className = "btn-secondary";
                    tabLlavesBtn.style.background = "transparent";
                    tabLlavesBtn.style.color = "var(--text-secondary)";
                } else {
                    tabLlavesBtn.className = "btn-primary";
                    tabLlavesBtn.style.background = "";
                    tabLlavesBtn.style.color = "";
                    tabLigaBtn.className = "btn-secondary";
                    tabLigaBtn.style.background = "transparent";
                    tabLigaBtn.style.color = "var(--text-secondary)";
                }
            } else {
                sorteoFaseTabs.style.display = "none";
                if (tieneLiga) window.activeFaseTab = 'liga';
                else if (tieneLlaves) window.activeFaseTab = 'llaves';
            }
        }

        if (todosPartidos.length === 0) {
            let emptyHtml = `<div class="jornadas-tabs" style="margin-bottom: 20px;">`;
            emptyHtml += `<button class="btn-jornada-tab" id="btn-open-opciones-fecha" style="padding: 8px 12px; background: #334155; color: white; border-radius: 8px;"><i class="fa-solid fa-plus"></i></button>`;
            emptyHtml += `</div>`;
            emptyHtml += `<p style="text-align:center; color: var(--text-muted); font-size: 14px;">El calendario está vacío. Haz clic en el botón '+' de arriba para empezar a agregar partidos manualmente.</p>`;
            sorteoResultadosContainer.innerHTML = emptyHtml;
            
            const btnOpenOpciones = document.getElementById("btn-open-opciones-fecha");
            if (btnOpenOpciones) {
                btnOpenOpciones.addEventListener("click", () => {
                    document.getElementById("modal-opciones-fecha").classList.add('active');
                });
            }
            return;
        }

        let partidos = todosPartidos.filter(p => {
            if (window.activeFaseTab === 'liga') return p.fase === 'liga' || p.fase === 'grupos';
            return p.fase === 'eliminatoria' || p.fase.startsWith('eliminatorias');
        });

        // Check if current view is eliminatoria
        if (window.activeFaseTab === 'llaves' && partidos.length > 0) {
            sorteoResultadosContainer.innerHTML = renderBracketView();
            if (sorteoResultadosSection) sorteoResultadosSection.style.display = "block";
            attachBracketEvents();
            return;
        }

        // Agrupar por jornada
        const partidosPorJornada = {};
        partidos.forEach(p => {
            let key;
            if (p.fase === 'eliminatorias') {
                key = p.jornada === 1 ? 'Ida' : 'Vuelta';
            } else {
                key = `Jornada ${p.jornada}`;
            }
            if (!partidosPorJornada[key]) partidosPorJornada[key] = [];
            partidosPorJornada[key].push(p);
        });

        const keys = Object.keys(partidosPorJornada).sort((a, b) => {
            const numA = parseInt(a.replace(/[^\d]/g, '')) || 0;
            const numB = parseInt(b.replace(/[^\d]/g, '')) || 0;
            return numA - numB;
        });

        if (!window.currentJornadaTab || !keys.includes(window.currentJornadaTab)) {
            window.currentJornadaTab = keys[0];
        }

        let html = "";

        // Render Tabs
        html += `<div class="jornadas-tabs">`;
        html += `<button class="btn-jornada-tab" id="btn-open-opciones-fecha" style="padding: 8px 12px; background: #334155; color: white;"><i class="fa-solid fa-plus"></i></button>`;
        keys.forEach(jornadaName => {
            const tabName = jornadaName.replace(/Jornada\s(\d+)/, "$1º Fecha");
            const activeClass = window.currentJornadaTab === jornadaName ? "active" : "";
            html += `<button class="btn-jornada-tab ${activeClass}" data-jornada="${jornadaName}">${tabName}</button>`;
        });
        html += `</div>`;

        // Render Matches for active tab
        const jornadaName = window.currentJornadaTab;
        html += `<div class="jornada-matches">`;
        html += `<h4 style="margin: 0 0 15px 0; color: var(--accent-primary); border-bottom: 1px solid var(--border-color); padding-bottom: 5px;">${jornadaName.replace(/Jornada\s(\d+)/, "$1º Fecha")}</h4>`;

        partidosPorJornada[jornadaName].forEach((p, index) => {
            const local = p.equipo1Id === 'vacante' ? { id: 'vacante', nombre: 'VACANTE (Descansa)', logo: '' } : appData.equipos.find(e => e.id === p.equipo1Id) || { nombre: 'Equipo Desconocido' };
            const visitante = p.equipo2Id === 'vacante' ? { id: 'vacante', nombre: 'VACANTE (Descansa)', logo: '' } : appData.equipos.find(e => e.id === p.equipo2Id) || { nombre: 'Equipo Desconocido' };

            const isVacante = local.id === 'vacante' || visitante.id === 'vacante';

            let inputArea = "";
            let isFinalizado = false;
            if (!isVacante) {
                const g1Val = p.goles1 !== null ? p.goles1 : "";
                const g2Val = p.goles2 !== null ? p.goles2 : "";

                let scoreDisplay = "";
                if ((p.detalles && p.detalles.estado === 'finalizado') || (p.goles1 !== null && p.goles2 !== null && p.goles1 !== "" && p.goles2 !== "")) {
                    isFinalizado = true;
                    scoreDisplay = `<div style="font-size: 1.5rem; font-weight: 800; color: white; margin-top: 5px;">${p.goles1 || 0} - ${p.goles2 || 0}</div>`;
                }
                inputArea = scoreDisplay;
            } else {
                inputArea = `<span style="font-size: 13px; color: var(--text-muted); margin-top: 5px;">(Descansa en esta fecha)</span>`;
            }

            const localImg = local.logo ? `<img src="${local.logo}" alt="L">` : `<i class="fa-solid fa-shield"></i>`;
            const visImg = visitante.logo ? `<img src="${visitante.logo}" alt="V">` : `<i class="fa-solid fa-shield"></i>`;

            const localClasses = local.id === 'vacante' ? 'match-team local match-vacante' : 'match-team local';
            const visClasses = visitante.id === 'vacante' ? 'match-team away match-vacante' : 'match-team away';

            const badgeHtml = (p.fase === 'grupos' && p.grupo) ? `<div style="text-align:center; margin-bottom:5px;"><span class="team-badge" style="background:var(--accent-primary);color:var(--bg-primary);">${p.grupo}</span></div>` : '';

            let actionButtons = '';
            if (local.id !== 'vacante' && visitante.id !== 'vacante') {
                if (isFinalizado) {
                    actionButtons = `
                        <div style="display:flex; gap: 5px; margin-top:5px;">
                            <button class="btn-primary btn-fast-result" data-match-id="${p.id}" style="font-size:0.75rem; padding: 4px 10px; border-radius:15px; background: #3b82f6;"><i class="fa-solid fa-pen"></i> Editar</button>
                            <span style="font-size:0.75rem; padding: 4px 10px; border-radius:15px; background: rgba(0, 0, 0, 0.1); color: var(--text-muted); display:flex; align-items:center; gap:5px;"><i class="fa-solid fa-flag-checkered"></i> Final</span>
                        </div>
                    `;
                } else {
                    actionButtons = `
                        <div style="display:flex; gap: 5px; margin-top:5px;" onclick="event.stopPropagation()">
                            <button class="btn-primary btn-fast-result" data-match-id="${p.id}" style="font-size:0.75rem; padding: 4px 10px; border-radius:15px; background: #3b82f6;"><i class="fa-solid fa-pen"></i> Res</button>
                            <button class="btn-primary btn-manage-match" data-match-id="${p.id}" style="font-size:0.75rem; padding: 4px 10px; border-radius:15px; background: #10b981;"><i class="fa-solid fa-gamepad"></i> Vivo</button>
                        </div>
                    `;
                }
            }

            let centerVsHtml = '';
            if (isFinalizado) {
                centerVsHtml = `<div style="font-size: 1.5rem; font-weight: 800; color: white; margin: 10px 0;">${p.goles1 || 0} - ${p.goles2 || 0}</div>`;
            } else {
                centerVsHtml = `<div class="match-vs"><div class="dots"><span></span><span></span></div></div>`;
            }
            
            // Si el partido tiene fecha y hora asignadas
            let dateTimeHtml = '';
            if (!isVacante && p.detalles && (p.detalles.fecha || p.detalles.hora)) {
                let dt = [];
                if(p.detalles.fecha) dt.push(p.detalles.fecha);
                if(p.detalles.hora) dt.push(p.detalles.hora);
                dateTimeHtml = `<div class="match-datetime-info">${dt.join(' | ')}</div>`;
            }

            const matchCardHtml = `
                <div class="match-card fade-in" ${isFinalizado ? `onclick="openMatchSummary('${p.id}')" style="cursor:pointer;"` : ''}>
                    <div style="position: absolute; top: 15px; left: 20px; font-size: 0.85rem; color: var(--text-muted); font-weight: bold; background: rgba(0,0,0,0.2); padding: 2px 8px; border-radius: 10px;">
                        #${index + 1}
                    </div>
                    <div class="match-team local">
                        ${local.logo ? `<img src="${local.logo}" alt="L">` : `<i class="fa-solid fa-shield"></i>`}
                        <span>${local.nombre || local.name}</span>
                    </div>

                    <div style="display:flex; flex-direction:column; align-items:center;">
                        ${badgeHtml}
                        ${centerVsHtml}
                        ${dateTimeHtml}
                        ${actionButtons}
                    </div>

                    <div class="match-team away">
                        ${visitante.logo ? `<img src="${visitante.logo}" alt="V">` : `<i class="fa-solid fa-shield"></i>`}
                        <span>${visitante.nombre || visitante.name}</span>
                    </div>
                </div>
            `;
            html += matchCardHtml;
        });
        html += `</div>`;

        sorteoResultadosContainer.innerHTML = html;
        if (sorteoResultadosSection) sorteoResultadosSection.style.display = "block";

        // Add event listeners to tabs
        sorteoResultadosContainer.querySelectorAll(".btn-jornada-tab[data-jornada]").forEach(btn => {
            btn.addEventListener("click", (e) => {
                window.currentJornadaTab = e.target.getAttribute("data-jornada");
                renderPartidosGenerados();
            });
        });

        // Add event listeners for Fast Result
        sorteoResultadosContainer.querySelectorAll(".btn-fast-result").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const matchId = e.target.closest("button").getAttribute("data-match-id");
                openFastResultModal(matchId);
            });
        });

        // Add event listeners for En vivo
        sorteoResultadosContainer.querySelectorAll(".btn-manage-match").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const matchId = e.target.closest("button").getAttribute("data-match-id");
                openMatchDashboard(matchId);
            });
        });



        const btnOpenOpciones = document.getElementById("btn-open-opciones-fecha");
        if (btnOpenOpciones) {
            btnOpenOpciones.addEventListener("click", () => {
                const modal = document.getElementById("modal-opciones-fecha");
                if (modal) modal.classList.add("active");
            });
        }
    }

    window.openMatchSummary = function(matchId) {
        const match = appData.partidos.find(p => p.id === matchId);
        if (!match) return;

        const local = appData.equipos.find(e => e.id === match.equipo1Id) || { nombre: 'Descansa', logo: '' };
        const vis = appData.equipos.find(e => e.id === match.equipo2Id) || { nombre: 'Descansa', logo: '' };

        document.getElementById('resumen-logo-local').src = local.logo || 'assets/default_shield.png';
        document.getElementById('resumen-nombre-local').textContent = local.nombre || 'Equipo Local';
        document.getElementById('resumen-goles-local').textContent = match.goles1 !== null ? match.goles1 : '-';

        document.getElementById('resumen-logo-vis').src = vis.logo || 'assets/default_shield.png';
        document.getElementById('resumen-nombre-vis').textContent = vis.nombre || 'Equipo Visitante';
        document.getElementById('resumen-goles-vis').textContent = match.goles2 !== null ? match.goles2 : '-';

        let faseText = match.fase === 'eliminatoria' || match.fase.startsWith('eliminatorias') ? 'Fase Eliminatoria' : `Jornada ${match.jornada}`;
        if (match.grupo && match.grupo !== 'unico') faseText += ` - ${match.grupo}`;
        document.getElementById('resumen-fase-info').textContent = faseText;

        const eventsLocalContainer = document.getElementById('resumen-events-local');
        const eventsVisContainer = document.getElementById('resumen-events-vis');
        eventsLocalContainer.innerHTML = '';
        eventsVisContainer.innerHTML = '';

        if (match.detalles && match.detalles.eventos && match.detalles.eventos.length > 0) {
            // Sort events by minute ascending
            const sortedEvents = [...match.detalles.eventos].sort((a, b) => a.minuto - b.minuto);
            
            sortedEvents.forEach(ev => {
                const getIcon = (tipo) => {
                    if(tipo === 'gol') return '<i class="fa-solid fa-futbol" style="color:var(--text-primary);"></i>';
                    if(tipo === 'amarilla') return '<div style="width:10px;height:14px;background:#facc15;display:inline-block;border-radius:2px;box-shadow: 1px 1px 2px rgba(0,0,0,0.2);"></div>';
                    if(tipo === 'roja') return '<div style="width:10px;height:14px;background:#ef4444;display:inline-block;border-radius:2px;box-shadow: 1px 1px 2px rgba(0,0,0,0.2);"></div>';
                    if(tipo === 'asistencia') return '<i class="fa-solid fa-handshake" style="color:var(--text-muted);"></i>';
                    return '';
                };

                const evHtml = `
                    <div style="display:flex; align-items:center; gap:8px; justify-content: ${ev.equipo === 'local' ? 'flex-end' : 'flex-start'};">
                        ${ev.equipo === 'local' ? `<span>${ev.jugadorNombre} ${ev.minuto}'</span> ${getIcon(ev.tipo)}` : `${getIcon(ev.tipo)} <span>${ev.jugadorNombre} ${ev.minuto}'</span>`}
                    </div>
                `;
                
                if (ev.equipo === 'local') {
                    eventsLocalContainer.innerHTML += evHtml;
                } else {
                    eventsVisContainer.innerHTML += evHtml;
                }
            });
        } else {
            // If it's a quick result, just say no detailed events
            eventsLocalContainer.innerHTML = `<div style="text-align:center; color:var(--text-muted); font-style:italic;">Sin detalles</div>`;
            eventsVisContainer.innerHTML = `<div style="text-align:center; color:var(--text-muted); font-style:italic;">Sin detalles</div>`;
        }

        const modal = document.getElementById('modal-resumen-partido');
        if (modal) modal.classList.add('active');
    } // End renderPartidosGenerados



    window.openAddJornadaModal = function() {
        alert("¡Próximamente! Función para agregar una fecha manual.");
    };
    
    window.openAddMatchManualModal = function() {
        alert("¡Próximamente! Función para agregar un partido manual.");
    };
    
    window.openEditJornadaModal = function() {
        alert("¡Próximamente! Función para editar la fecha y hora de la jornada.");
    };
    
    window.openReorderJornadasModal = function() {
        alert("¡Próximamente! Función para reordenar las rondas.");
    };
    
    window.exportCalendarPDF = function() {
        alert("¡Próximamente! Función para exportar calendario a PDF.");
    };

    function attachBracketEvents() {
        sorteoResultadosContainer.querySelectorAll('.btn-fast-result').forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const matchId = e.target.closest('button').getAttribute('data-match-id');
                openFastResultModal(matchId);
            });
        });

        sorteoResultadosContainer.querySelectorAll('.btn-manage-match').forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const matchId = e.target.closest('button').getAttribute('data-match-id');
                openMatchDashboard(matchId);
            });
        });
    }
    
    window.renderPartidosGenerados = renderPartidosGenerados;

    function renderBracketView() {
        const eliminatorias = appData.partidos.filter(p => p.torneo === currentTorneo && p.calendario_nombre === window.currentCalendarioNombre && (p.fase === 'eliminatoria' || p.fase.startsWith('eliminatorias')));
        
        const llavesDict = {};
        eliminatorias.forEach(p => {
            if(!llavesDict[p.grupo]) llavesDict[p.grupo] = [];
            llavesDict[p.grupo].push(p);
        });
        
        const initialLlaves = Object.keys(llavesDict).filter(k => k.startsWith('Llave'));
        const numLlaves = initialLlaves.length;
        const llavesArr = initialLlaves.sort((a,b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0])).map(k => llavesDict[k]);
        
        const renderMatchCard = (matches) => {
            if (!matches) {
                return `
                    <div class="bracket-match empty-match">
                        <div class="bracket-match-team">
                            <i class="fa-solid fa-shield" style="color:#adb5bd; margin-right:8px;"></i>
                            <span class="name" style="color:#adb5bd;">Por definir</span>
                        </div>
                        <div class="bracket-match-team">
                            <i class="fa-solid fa-shield" style="color:#adb5bd; margin-right:8px;"></i>
                            <span class="name" style="color:#adb5bd;">Por definir</span>
                        </div>
                    </div>
                `;
            }
            
            const ida = matches.find(m => m.jornada === 1) || matches[0];
            const vuelta = matches.find(m => m.jornada === 2);
            
            const local = ida.equipo1Id === 'vacante' ? { id: 'vacante', nombre: 'VACANTE', logo: '' } : appData.equipos.find(e => e.id === ida.equipo1Id) || { nombre: 'Desc.' };
            const visitante = ida.equipo2Id === 'vacante' ? { id: 'vacante', nombre: 'VACANTE', logo: '' } : appData.equipos.find(e => e.id === ida.equipo2Id) || { nombre: 'Desc.' };
            
            const lLogo = local.logo ? `<img src="${local.logo}">` : `<i class="fa-solid fa-shield"></i>`;
            const vLogo = visitante.logo ? `<img src="${visitante.logo}">` : `<i class="fa-solid fa-shield"></i>`;
            
            let scoreL = ida.goles1 !== null ? ida.goles1 : "-";
            let scoreV = ida.goles2 !== null ? ida.goles2 : "-";
            
            if (vuelta && vuelta.goles1 !== null && vuelta.goles2 !== null && ida.goles1 !== null && ida.goles2 !== null) {
                scoreL = ida.goles1 + vuelta.goles2;
                scoreV = ida.goles2 + vuelta.goles1;
            }
            
            return `
                <div class="bracket-match fade-in">
                    <div style="font-size:10px; color:#6c757d; text-align:center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom:2px; margin-bottom:2px;">
                        ${ida.grupo} ${vuelta ? '(Global)' : ''}
                    </div>
                    <div class="bracket-match-team">
                        ${lLogo}
                        <span class="name">${local.nombre || local.name}</span>
                        <span class="score">${scoreL}</span>
                    </div>
                    <div class="bracket-match-team">
                        ${vLogo}
                        <span class="name">${visitante.nombre || visitante.name}</span>
                        <span class="score">${scoreV}</span>
                    </div>
                    ${(local.id !== 'vacante' && visitante.id !== 'vacante') ? `
                        <div style="display:flex; gap: 5px; justify-content: center; margin-top:5px;">
                            <button class="edit-btn btn-fast-result" data-match-id="${ida.id}"><i class="fa-solid fa-pen"></i> Ida</button>
                            ${vuelta ? `<button class="edit-btn btn-fast-result" data-match-id="${vuelta.id}" style="background:#10b981;" title="Vuelta"><i class="fa-solid fa-pen"></i> Vuelta</button>` : ''}
                        </div>
                    ` : ''}
                </div>
            `;
        };

        let html = `<div class="bracket-wrapper"><div class="bracket-container">`;

        if (numLlaves === 4 || numLlaves === 8) { 
            html += `<div class="bracket-half left-side">`;
            html += `<div class="bracket-round"><div class="bracket-round-title">Cuartos</div>`;
            html += `<div class="bracket-connector-wrapper">${renderMatchCard(llavesArr[0])}</div>`;
            html += `<div class="bracket-connector-wrapper">${renderMatchCard(llavesArr[1])}</div>`;
            html += `</div>`;
            
            html += `<div class="bracket-round"><div class="bracket-round-title">Semifinal</div>`;
            html += `<div class="bracket-connector-wrapper">${renderMatchCard(llavesDict['Semifinal 1'] || null)}</div>`;
            html += `</div>`;
            html += `</div>`;

            html += `<div class="bracket-round final-round">
                        <div class="bracket-round-title" style="color: #f59e0b;">Final</div>
                        <div class="bracket-connector-wrapper">${renderMatchCard(llavesDict['Final'] || null)}</div>
                     </div>`;

            html += `<div class="bracket-half right-side">`;
            html += `<div class="bracket-round"><div class="bracket-round-title">Cuartos</div>`;
            html += `<div class="bracket-connector-wrapper">${renderMatchCard(llavesArr[2])}</div>`;
            html += `<div class="bracket-connector-wrapper">${renderMatchCard(llavesArr[3])}</div>`;
            html += `</div>`;

            html += `<div class="bracket-round"><div class="bracket-round-title">Semifinal</div>`;
            html += `<div class="bracket-connector-wrapper">${renderMatchCard(llavesDict['Semifinal 2'] || null)}</div>`;
            html += `</div>`;
            html += `</div>`;
        } 
        else if (numLlaves === 2) {
            html += `<div class="bracket-half left-side">`;
            html += `<div class="bracket-round"><div class="bracket-round-title">Semifinal</div>`;
            html += `<div class="bracket-connector-wrapper">${renderMatchCard(llavesArr[0])}</div>`;
            html += `</div></div>`;

            html += `<div class="bracket-round final-round">
                        <div class="bracket-round-title" style="color: #f59e0b;">Final</div>
                        <div class="bracket-connector-wrapper">${renderMatchCard(llavesDict['Final'] || null)}</div>
                     </div>`;

            html += `<div class="bracket-half right-side">`;
            html += `<div class="bracket-round"><div class="bracket-round-title">Semifinal</div>`;
            html += `<div class="bracket-connector-wrapper">${renderMatchCard(llavesArr[1])}</div>`;
            html += `</div></div>`;
        }
        else if (numLlaves === 1) {
            html += `<div class="bracket-round final-round" style="margin: 0 auto;">
                        <div class="bracket-round-title" style="color: #f59e0b;">Gran Final</div>
                        <div class="bracket-connector-wrapper">${renderMatchCard(llavesArr[0])}</div>
                     </div>`;
        }
        else {
            html += `<div class="bracket-round final-round" style="margin: 0 auto;">
                        <div class="bracket-round-title">Eliminatorias</div>`;
            llavesArr.forEach(llave => {
                html += `<div class="bracket-connector-wrapper">${renderMatchCard(llave)}</div>`;
            });
            html += `</div>`;
        }

        html += `</div></div>`;
        return html;
    }

    function getTablaDePosicionesArray() {
        let todosLosPartidos = appData.partidos.filter(p => p.torneo === currentTorneo && p.calendario_nombre === window.currentCalendarioNombre && (p.fase === 'liga' || p.fase === 'grupos'));
        
        if (todosLosPartidos.length === 0) {
            todosLosPartidos = appData.partidos.filter(p => p.torneo === currentTorneo && p.calendario_nombre === 'Torneo Principal' && (p.fase === 'liga' || p.fase === 'grupos'));
            
            if (todosLosPartidos.length === 0) {
                let anyLeagueMatches = appData.partidos.filter(p => p.torneo === currentTorneo && (p.fase === 'liga' || p.fase === 'grupos'));
                if (anyLeagueMatches.length > 0) {
                    const firstFoundName = anyLeagueMatches[0].calendario_nombre;
                    todosLosPartidos = anyLeagueMatches.filter(p => p.calendario_nombre === firstFoundName);
                }
            }
        }

        if (todosLosPartidos.length === 0) return [];
        
        const groupMapping = {};
        todosLosPartidos.forEach(p => {
            if (p.equipo1Id !== 'vacante') groupMapping[p.equipo1Id] = p.grupo;
            if (p.equipo2Id !== 'vacante') groupMapping[p.equipo2Id] = p.grupo;
        });

        const partidosJugados = todosLosPartidos.filter(p => p.goles1 !== null && p.goles2 !== null && p.equipo1Id !== 'vacante' && p.equipo2Id !== 'vacante');

        let stats = {};
        appData.equipos.forEach(eq => {
            if (groupMapping[eq.id]) {
                stats[eq.id] = {
                    id: eq.id,
                    equipo: eq,
                    grupo: groupMapping[eq.id],
                    pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0, dif: 0
                };
            }
        });

        partidosJugados.forEach(p => {
            const stat1 = stats[p.equipo1Id];
            const stat2 = stats[p.equipo2Id];

            if (stat1 && stat2) {
                stat1.pj++; stat2.pj++;
                stat1.gf += p.goles1; stat1.gc += p.goles2;
                stat2.gf += p.goles2; stat2.gc += p.goles1;

                if (p.goles1 > p.goles2) { stat1.pg++; stat1.pts += 3; stat2.pp++; } 
                else if (p.goles1 < p.goles2) { stat2.pg++; stat2.pts += 3; stat1.pp++; } 
                else { stat1.pe++; stat1.pts += 1; stat2.pe++; stat2.pts += 1; }
            }
        });

        const arr = Object.values(stats);
        arr.forEach(s => s.dif = s.gf - s.gc);
        
        // Sort by Points, Goal Difference, Goals For
        arr.sort((a, b) => b.pts - a.pts || b.dif - a.dif || b.gf - a.gf);
        return arr;
    }

    function renderTablaPosiciones() {
        const container = document.getElementById("posiciones-container");
        if (!container) return;

        const todosLosPartidos = appData.partidos.filter(p => p.torneo === currentTorneo && p.calendario_nombre === window.currentCalendarioNombre && (p.fase === 'liga' || p.fase === 'grupos'));

        if (todosLosPartidos.length === 0) {
            container.innerHTML = '<p style="text-align:center; color: var(--text-muted); font-size: 14px;">Genera los partidos para ver la tabla de posiciones.</p>';
            return;
        }

        // Mapear qué equipo pertenece a qué grupo
        const groupMapping = {};
        const groupNames = new Set();
        todosLosPartidos.forEach(p => {
            groupNames.add(p.grupo);
            if (p.equipo1Id !== 'vacante') groupMapping[p.equipo1Id] = p.grupo;
            if (p.equipo2Id !== 'vacante') groupMapping[p.equipo2Id] = p.grupo;
        });

        // Filtrar solo los partidos ya jugados
        const partidosJugados = todosLosPartidos.filter(p => p.goles1 !== null && p.goles2 !== null && p.equipo1Id !== 'vacante' && p.equipo2Id !== 'vacante');

        // Inicializar stats solo para los equipos que están en la fase
        let stats = {};
        appData.equipos.forEach(eq => {
            if (groupMapping[eq.id]) {
                stats[eq.id] = {
                    equipo: eq,
                    grupo: groupMapping[eq.id],
                    pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0
                };
            }
        });

        partidosJugados.forEach(p => {
            const stat1 = stats[p.equipo1Id];
            const stat2 = stats[p.equipo2Id];

            if (stat1 && stat2) {
                stat1.pj++;
                stat2.pj++;

                stat1.gf += p.goles1;
                stat1.gc += p.goles2;
                stat2.gf += p.goles2;
                stat2.gc += p.goles1;

                if (p.goles1 > p.goles2) {
                    stat1.pg++; stat1.pts += 3;
                    stat2.pp++;
                } else if (p.goles1 < p.goles2) {
                    stat2.pg++; stat2.pts += 3;
                    stat1.pp++;
                } else {
                    stat1.pe++; stat1.pts += 1;
                    stat2.pe++; stat2.pts += 1;
                }
            }
        });

        const sortedGroups = Array.from(groupNames).sort();
        let finalHtml = "";

        sortedGroups.forEach(gName => {
            const tablaGrupo = Object.values(stats).filter(s => s.grupo === gName);

            // Calcular diferencia de goles
            tablaGrupo.forEach(s => s.dif = s.gf - s.gc);

            // Ordenar tabla
            tablaGrupo.sort((a, b) => {
                if (b.pts !== a.pts) return b.pts - a.pts; // Puntos
                if (b.dif !== a.dif) return b.dif - a.dif; // Diferencia
                return b.gf - a.gf; // Goles a favor
            });

            if (gName !== 'unico') {
                finalHtml += `<h4 style="margin: 20px 0 10px 0; color: var(--accent-primary); border-bottom: 1px solid var(--border-color); padding-bottom: 5px;">${gName}</h4>`;
            }

            finalHtml += `
                <table class="data-table fade-in" style="margin-bottom: 20px;">
                    <thead>
                        <tr>
                            <th style="width:50px; text-align:center;">Pos</th>
                            <th>Equipo</th>
                            <th title="Partidos Jugados" style="text-align:center;">PJ</th>
                            <th title="Partidos Ganados" style="text-align:center;">PG</th>
                            <th title="Partidos Empatados" style="text-align:center;">PE</th>
                            <th title="Partidos Perdidos" style="text-align:center;">PP</th>
                            <th title="Goles a Favor" style="text-align:center;">GF</th>
                            <th title="Goles en Contra" style="text-align:center;">GC</th>
                            <th title="Diferencia de Goles" style="text-align:center;">DIF</th>
                            <th title="Puntos" style="text-align:center;">PTS</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            tablaGrupo.forEach((t, index) => {
                let posClass = "";
                // Si es un torneo largo (unico), marcamos a los 3 primeros. Si son grupos, marcamos al 1ro y 2do
                if (index === 0) posClass = "pos-1";
                else if (index === 1) posClass = "pos-2";
                else if (index === 2 && gName === 'unico') posClass = "pos-3";

                finalHtml += `
                    <tr>
                        <td style="text-align:center;"><span class="pos-badge ${posClass}">${index + 1}</span></td>
                        <td class="player-cell">
                            ${t.equipo.logo ? `<img src="${t.equipo.logo}" style="width:30px; height:30px; border-radius:50%; object-fit:cover; border:1px solid var(--border-color);">` : `<div class="player-avatar"><i class="fa-solid fa-shield"></i></div>`}
                            <span>${t.equipo.nombre}</span>
                        </td>
                        <td style="text-align:center; color: var(--text-secondary);">${t.pj}</td>
                        <td style="text-align:center; color: #10B981;">${t.pg}</td>
                        <td style="text-align:center; color: #FCD34D;">${t.pe}</td>
                        <td style="text-align:center; color: #EF4444;">${t.pp}</td>
                        <td style="text-align:center;">${t.gf}</td>
                        <td style="text-align:center;">${t.gc}</td>
                        <td style="text-align:center; font-weight:600; color: ${t.dif > 0 ? '#10B981' : (t.dif < 0 ? '#EF4444' : 'var(--text-primary)')};">${t.dif > 0 ? '+' : ''}${t.dif}</td>
                        <td class="stat-highlight" style="text-align:center; font-size: 18px;">${t.pts}</td>
                    </tr>
                `;
            });

            finalHtml += `</tbody></table>`;
        });

        container.innerHTML = finalHtml;
    }

    // --- INLINE ACTIONS ---

    // Inline Edit
    formInlineEdit.addEventListener("submit", (e) => {
        e.preventDefault();
        const id = document.getElementById("edit-player-id").value;
        const player = appData.jugadores.find(p => p.id == id);
        if (player) {
            player.name = document.getElementById("edit-player-name").value;
            player.dorsal = document.getElementById("edit-player-dorsal").value || null;
            player.isNovato = document.getElementById("edit-player-novato").checked;
            player.isPortero = document.getElementById("edit-player-portero").checked;
            
            const preview = document.getElementById("edit-player-photo-preview");
            if (preview.src && preview.src.startsWith('data:')) {
                player.foto = preview.src;
            }

            saveData();
            inlineEditModal.classList.remove("active");
            if (currentTeamId) showTeamDetail(appData.equipos.find(t => t.id === currentTeamId));
            updateSelects();
        }
    });

    // Inline Transfer
    formInlineTransfer.addEventListener("submit", (e) => {
        e.preventDefault();
        const playerId = document.getElementById("transfer-player-id").value;
        const newTeamId = document.getElementById("inline-select-team-transfer").value;
        handleTransfer(playerId, newTeamId);
        inlineTransferModal.classList.remove("active");
    });

    // Handlers
    async function handleTransfer(playerId, newTeamId) {
        const player = appData.jugadores.find(p => p.id == playerId);
        if (!player) return;

        if (player.equipoId == newTeamId) return alert("El jugador ya está en este equipo.");
        if (player.transferencias >= 1) {
            return alert("❌ LÍMITE ALCANZADO: Por reglas de la liga, un jugador no puede ser traspasado más de una vez (máximo 2 equipos en la temporada).");
        }

        const currentPlayersCount = appData.jugadores.filter(p => p.equipoId == newTeamId && p.status === 'activo').length;
        if (currentPlayersCount >= 22) {
            return alert("LÍMITE ALCANZADO: El equipo destino ya tiene 22 jugadores inscritos. Se debe dar de baja a un jugador de su plantilla para poder recibir a este nuevo jugador.");
        }

        appData.movimientos.push({
            id: Date.now(),
            fecha: new Date().toISOString(),
            jugadorId: playerId,
            tipo: 'traspaso',
            equipoOrigenId: player.equipoId,
            equipoDestinoId: newTeamId
        });

        player.equipoId = newTeamId;
        player.transferencias += 1;
        showLoader("Efectuando traspaso...");
        await saveData();
        hideLoader();
        updateSelects();
        alert("Traspaso completado.");

        if (currentTeamId) showTeamDetail(appData.equipos.find(t => t.id === currentTeamId));
        if (document.getElementById("view-mercado").classList.contains("active")) renderMercado();
    }

    async function handleBaja(playerId) {
        const player = appData.jugadores.find(p => p.id == playerId);
        if (!player) return;
        if (confirm(`¿Seguro que deseas dar de baja a ${player.name}?`)) {
            player.status = 'baja';
            appData.movimientos.push({
                id: Date.now(),
                fecha: new Date().toISOString(),
                jugadorId: playerId,
                tipo: 'baja',
                equipoOrigenId: player.equipoId
            });
            showLoader("Dando de baja al jugador...");
            await saveData();
            hideLoader();
            updateSelects();
            alert("Jugador dado de baja.");
            if (currentTeamId) showTeamDetail(appData.equipos.find(t => t.id == currentTeamId));
            if (document.getElementById("view-mercado").classList.contains("active")) renderMercado();
        }
    }


    // --- RENDER FUNCTIONS ---

    window.openInlineEdit = function (id) {
        const player = appData.jugadores.find(p => p.id.toString() === id.toString());
        if (player) {
            document.getElementById("edit-player-id").value = id;
            document.getElementById("edit-player-name").value = player.name || player.nombre || 'Jugador Desconocido';
            document.getElementById("edit-player-dorsal").value = player.dorsal || '';
            document.getElementById("edit-player-novato").checked = player.isNovato;
            document.getElementById("edit-player-portero").checked = player.isPortero;
            
            const preview = document.getElementById("edit-player-photo-preview");
            const fallback = document.getElementById("edit-player-photo-fallback");
            if (player.foto) {
                preview.src = player.foto;
                preview.style.display = 'block';
                fallback.style.display = 'none';
            } else {
                preview.src = '';
                preview.style.display = 'none';
                fallback.style.display = 'flex';
            }

            inlineEditModal.classList.add("active");
        }
    };

    window.openInlineTransfer = function (id) {
        const player = appData.jugadores.find(p => p.id.toString() === id.toString());
        if (player) {
            if (player.transferencias >= 1) {
                return alert("❌ LÍMITE ALCANZADO: Este jugador ya fue traspasado una vez en esta temporada y no puede volver a cambiar de equipo.");
            }
            document.getElementById("transfer-player-id").value = id;
            document.getElementById("transfer-player-name").textContent = player.name || player.nombre || 'Jugador Desconocido';

            // Populate select, excluding current team
            const select = document.getElementById("inline-select-team-transfer");
            select.innerHTML = '<option value="">-- Selecciona Nuevo Equipo --</option>';
            appData.equipos.filter(t => t.id.toString() !== player.equipoId.toString()).forEach(t => {
                const teamName = t.nombre || t.name || 'Desconocido';
                select.innerHTML += `<option value="${t.id}">${teamName}</option>`;
            });

            inlineTransferModal.classList.add("active");
        }
    };

    window.confirmDeleteTeam = async function() {
        if (!currentTeamId) return;
        const team = appData.equipos.find(t => t.id === currentTeamId);
        if (!team) return;
        if (!confirm(`¿Estás seguro de que deseas eliminar permanentemente el equipo "${team.nombre}"?\n\n¡ATENCIÓN! Esto también eliminará a todos sus jugadores y todos los partidos en los que esté programado. Esta acción no se puede deshacer.`)) return;

        showLoader("Eliminando equipo...");
        try {
            await supabase.from('equipos').delete().eq('id', team.id);
            await supabase.from('jugadores').delete().eq('equipo_id', team.id);
            await supabase.from('partidos').delete().or(`equipo1_id.eq.${team.id},equipo2_id.eq.${team.id}`);
        } catch(e) { console.error("Error eliminando en Supabase:", e); }

        appData.jugadores = appData.jugadores.filter(p => p.equipoId !== team.id);
        appData.partidos = appData.partidos.filter(p => p.equipo1Id !== team.id && p.equipo2Id !== team.id);
        appData.equipos = appData.equipos.filter(t => t.id !== team.id);
        
        await saveData();
        updateSelects();
        renderTeams();
        if(typeof renderPartidosGenerados === 'function') renderPartidosGenerados();
        
        viewEquipoDetalle.classList.remove("active");
        viewEquipos.classList.add("active");
        hideLoader();
    };

    window.triggerBaja = function (id) {
        handleBaja(id);
    };

    window.deleteMovimiento = async function (id) {
        if (!confirm("¿Estás seguro de que deseas eliminar este movimiento y revertir la acción?")) return;

        showLoader("Eliminando movimiento...");
        const movIndex = appData.movimientos.findIndex(m => m.id == id);
        if (movIndex === -1) {
            hideLoader();
            return;
        }
        const mov = appData.movimientos[movIndex];

        const player = appData.jugadores.find(p => p.id === mov.jugadorId);

        if (player) {
            if (mov.tipo === 'traspaso') {
                player.equipoId = mov.equipoOrigenId;
                player.transferencias = Math.max(0, player.transferencias - 1);
            } else if (mov.tipo === 'baja') {
                player.status = 'activo';
            }
        }

        try {
            await supabase.from('movimientos').delete().eq('id', mov.id);
        } catch(e) {}

        appData.movimientos.splice(movIndex, 1);
        await saveData();
        updateSelects();
        renderMercado();
        if (currentTeamId) showTeamDetail(appData.equipos.find(t => t.id === currentTeamId));
        hideLoader();
        alert("Acción eliminada correctamente.");
    };

    window.deletePlayerComplete = async function (id) {
        const player = appData.jugadores.find(p => p.id === id);
        if (!player) return;
        if (confirm(`¿Estás completamente seguro de ELIMINAR a ${player.name} de la base de datos?\n\nEsta acción borrará todas sus estadísticas e historial. Úsalo solo si te equivocaste al crearlo.`)) {
            showLoader("Eliminando jugador...");
            try {
                await supabase.from('jugadores').delete().eq('id', id);
                await supabase.from('movimientos').delete().eq('jugador_id', id);
            } catch(e) {}
            
            appData.jugadores = appData.jugadores.filter(p => p.id !== id);
            appData.movimientos = appData.movimientos.filter(m => m.jugadorId !== id);
            await saveData();
            updateSelects();
            hideLoader();
            alert("Jugador eliminado permanentemente de la base de datos.");
            if (currentTeamId) showTeamDetail(appData.equipos.find(t => t.id === currentTeamId));
            if (document.getElementById("view-mercado").classList.contains("active")) renderMercado();
        }
    };

    function renderTeams() {
        teamsContainer.innerHTML = '';
        if (appData.equipos.length === 0) {
            teamsContainer.innerHTML = '<p style="color:var(--text-muted); grid-column: 1/-1;">No hay equipos registrados.</p>';
            return;
        }

        appData.equipos.forEach(team => {
            const playersCount = appData.jugadores.filter(p => p.equipoId === team.id && p.status === 'activo').length;

            const card = document.createElement("div");
            card.className = "team-card";
            card.innerHTML = `
                <div class="team-logo-container">
                    ${team.logo ? `<img src="${team.logo}" alt="${team.nombre}">` : `<i class="fa-solid fa-shield"></i>`}
                </div>
                <h3>${team.nombre}</h3>
                <p>${playersCount} jugadores</p>
            `;

            card.addEventListener("click", () => showTeamDetail(team));
            teamsContainer.appendChild(card);
        });
    }

    function showTeamDetail(team) {
        currentTeamId = team.id;
        viewEquipos.classList.remove("active");
        viewEquipoDetalle.classList.add("active");

        detailTeamName.textContent = team.nombre;
        const detailTeamLogoFallback = document.getElementById("detail-team-logo-fallback");
        
        if (team.logo) {
            detailTeamLogo.src = team.logo;
            detailTeamLogo.style.display = 'block';
            if (detailTeamLogoFallback) detailTeamLogoFallback.style.display = 'none';
        } else {
            detailTeamLogo.style.display = 'none';
            if (detailTeamLogoFallback) detailTeamLogoFallback.style.display = 'flex';
        }
        
        const detailTeamBanner = document.getElementById("detail-team-banner");
        if (detailTeamBanner) {
            if (team.portada) {
                detailTeamBanner.style.backgroundImage = `url(${team.portada})`;
            } else {
                detailTeamBanner.style.backgroundImage = `repeating-linear-gradient(45deg, rgba(16,185,129,0.1) 0px, rgba(16,185,129,0.1) 20px, rgba(16,185,129,0.05) 20px, rgba(16,185,129,0.05) 40px), linear-gradient(135deg, var(--bg-primary), var(--bg-secondary))`;
            }
        }

        const config = appData.config;
        const isLocked = currentTorneo === 'apertura' ? config.estadoApertura === 'finalizado' : config.estadoClausura === 'finalizado';

        const btnInlineAdd = document.getElementById("btn-inline-add-player");
        if (isLocked) {
            btnInlineAdd.style.display = 'none';
        } else {
            btnInlineAdd.style.display = 'inline-block';
        }

        rosterBody.innerHTML = '';
        const roster = appData.jugadores.filter(p => p.equipoId === team.id && p.status === 'activo');

        currentTabTitle.textContent = `Plantilla del Equipo (${roster.length} Jugadores)`;

        if (roster.length === 0) {
            rosterBody.innerHTML = `<tr><td colspan="4" style="text-align:center;">No hay jugadores activos.</td></tr>`;
            return;
        }

        roster.forEach((p, index) => {
            let roles = [];
            if (p.isPortero) roles.push("Portero");
            if (p.isNovato) roles.push("Novato");
            if (roles.length === 0) roles.push("Jugador");

            // Lógica de Suspensión
            const amarillasTotal = p.stats[currentTorneo].amarillas;
            const ciclo = amarillasTotal % 5;

            let rowClass = "";
            let alertBadge = "";

            if (amarillasTotal > 0 && ciclo === 0) {
                rowClass = "row-suspended";
                alertBadge = `<span class="badge-suspended">Suspendido (5)</span>`;
            } else if (ciclo === 4) {
                rowClass = "row-warning";
                alertBadge = `<span class="badge-warning">Riesgo (4)</span>`;
            }

            const config = appData.config;
            const isLocked = currentTorneo === 'apertura' ? config.estadoApertura === 'finalizado' : config.estadoClausura === 'finalizado';
            let actionButtonsHTML = '';

            if (!isLocked) {
                actionButtonsHTML = `
                    <div class="action-buttons">
                        <button class="btn-action btn-edit" onclick="openStatsModal('${p.id}')" title="Editar Estadísticas Extra" style="background:var(--accent-primary); color:var(--bg-primary);"><i class="fa-solid fa-chart-simple"></i></button>
                        <button class="btn-action btn-edit" onclick="openInlineEdit('${p.id}')" title="Editar"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn-action btn-transfer" onclick="openInlineTransfer('${p.id}')" title="Traspasar"><i class="fa-solid fa-right-left"></i></button>
                        <button class="btn-action btn-delete" onclick="triggerBaja('${p.id}')" title="Dar de Baja (Mercado)"><i class="fa-solid fa-user-minus"></i></button>
                        <button class="btn-action btn-delete" onclick="deletePlayerComplete('${p.id}')" title="Eliminar por error" style="background:#ef4444; color:white; border:none; padding:5px 8px; border-radius:4px; cursor:pointer; margin-left:4px;"><i class="fa-solid fa-trash"></i></button>
                    </div>
                `;
            }

            const tr = document.createElement("tr");
            if (rowClass) tr.className = rowClass;

            tr.innerHTML = `
                <td>
                    <div class="player-cell">
                        <span style="color:var(--text-secondary); margin-right:12px; font-weight:600; font-size:14px; min-width:20px;">${index + 1}.</span>
                        <div class="player-avatar">
                            ${p.foto ? `<img src="${p.foto}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` : `<i class="fa-solid fa-user"></i>`}
                        </div>
                        <span>${p.dorsal ? `<b style="color:var(--accent-primary); margin-right:5px;">#${p.dorsal}</b> ` : ''}${p.name} ${alertBadge}</span>
                    </div>
                </td>
                <td><span style="color:var(--text-secondary); font-size:13px;">${roles.join(", ")}</span></td>
                <td><span class="status-badge status-active">Activo</span></td>
                <td>${actionButtonsHTML}</td>
            `;
            rosterBody.appendChild(tr);
        });

        // Renderizar Historial del Club
        const teamAltasBody = document.getElementById("team-altas-body");
        const teamBajasBody = document.getElementById("team-bajas-body");
        teamAltasBody.innerHTML = '';
        teamBajasBody.innerHTML = '';

        const clubAltas = appData.movimientos.filter(m => m.equipoDestinoId === team.id && (m.tipo === 'traspaso' || m.tipo === 'alta')).sort((a, b) => b.id - a.id);
        const clubBajas = appData.movimientos.filter(m => m.equipoOrigenId === team.id && (m.tipo === 'traspaso' || m.tipo === 'baja')).sort((a, b) => b.id - a.id);

        if (clubAltas.length === 0) teamAltasBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No hay fichajes recientes</td></tr>';
        if (clubBajas.length === 0) teamBajasBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No hay bajas recientes</td></tr>';

        clubAltas.forEach(m => {
            const player = appData.jugadores.find(p => p.id === m.jugadorId);
            const teamOrig = m.equipoOrigenId ? appData.equipos.find(t => t.id === m.equipoOrigenId) : null;
            if (!player) return;

            const config = appData.config;
            const isLocked = currentTorneo === 'apertura' ? config.estadoApertura === 'finalizado' : config.estadoClausura === 'finalizado';
            const actionBtn = isLocked ? '' : `<button class="btn-action btn-delete" onclick="deleteMovimiento('${m.id}')" title="Deshacer Fichaje"><i class="fa-solid fa-trash"></i></button>`;

            let descHTML = m.tipo === 'alta' ?
                '<span style="color:var(--accent-primary)">Alta Libre Oficial</span>' :
                `Fichado desde <span class="team-badge">${teamOrig ? teamOrig.nombre : '?'}</span>`;

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td style="color:var(--text-secondary); font-size:12px;">${formatDate(m.fecha)}</td>
                <td style="font-weight:600;">${player.name}</td>
                <td style="font-size:13px;">${descHTML}</td>
                <td>${actionBtn}</td>
            `;
            teamAltasBody.appendChild(tr);
        });

        clubBajas.forEach(m => {
            const player = appData.jugadores.find(p => p.id === m.jugadorId);
            const teamDest = m.equipoDestinoId ? appData.equipos.find(t => t.id === m.equipoDestinoId) : null;
            if (!player) return;

            const config = appData.config;
            const isLocked = currentTorneo === 'apertura' ? config.estadoApertura === 'finalizado' : config.estadoClausura === 'finalizado';
            const actionBtn = isLocked ? '' : `<button class="btn-action btn-delete" onclick="deleteMovimiento('${m.id}')" title="Deshacer Baja"><i class="fa-solid fa-trash"></i></button>`;

            let desc = m.tipo === 'baja' ? '<span style="color:#F87171">Expulsado del club</span>' : `Traspasado a <span class="stat-highlight">${teamDest ? teamDest.nombre : '?'}</span>`;

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td style="color:var(--text-secondary); font-size:12px;">${formatDate(m.fecha)}</td>
                <td style="font-weight:600;">${player.name}</td>
                <td style="font-size:13px;">${desc}</td>
                <td>${actionBtn}</td>
            `;
            teamBajasBody.appendChild(tr);
        });
    }

    function renderMercado() {
        altasBody.innerHTML = '';
        bajasBody.innerHTML = '';

        const config = appData.config;
        if (config.estadoClausura === 'finalizado') {
            altasBody.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-secondary);"><i class="fa-solid fa-broom" style="font-size:24px; margin-bottom:10px; opacity:0.5;"></i><br>El mercado ha sido limpiado para la próxima temporada.</div>';
            bajasBody.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-secondary);"><i class="fa-solid fa-broom" style="font-size:24px; margin-bottom:10px; opacity:0.5;"></i><br>El mercado ha sido limpiado para la próxima temporada.</div>';
            return;
        }

        const altas = appData.movimientos.filter(m => m.tipo === 'alta' || m.tipo === 'traspaso').sort((a, b) => b.id - a.id);
        const bajas = appData.movimientos.filter(m => m.tipo === 'baja').sort((a, b) => b.id - a.id);

        if (altas.length === 0) altasBody.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-secondary);"><i class="fa-solid fa-ghost" style="font-size:24px; margin-bottom:10px; opacity:0.5;"></i><br>No hay altas ni traspasos recientes</div>';
        if (bajas.length === 0) bajasBody.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-secondary);"><i class="fa-solid fa-ghost" style="font-size:24px; margin-bottom:10px; opacity:0.5;"></i><br>No hay bajas recientes</div>';

        altas.forEach(m => {
            const player = appData.jugadores.find(p => p.id == m.jugadorId);
            const teamDest = appData.equipos.find(t => t.id == m.equipoDestinoId);
            const teamOrig = m.equipoOrigenId ? appData.equipos.find(t => t.id == m.equipoOrigenId) : null;
            if (!player || !teamDest) return;

            const config = appData.config;
            const isLocked = currentTorneo === 'apertura' ? config.estadoApertura === 'finalizado' : config.estadoClausura === 'finalizado';
            const actionBtn = isLocked ? '' : `<button class="btn-action btn-delete" onclick="deleteMovimiento('${m.id}')" title="Eliminar Movimiento" style="background: rgba(239, 68, 68, 0.1); color: #ef4444;"><i class="fa-solid fa-trash"></i></button>`;

            const isTraspaso = m.tipo === 'traspaso';
            
            const card = document.createElement("div");
            card.style.cssText = `
                display: flex;
                align-items: center;
                justify-content: space-between;
                background: var(--bg-primary);
                border: 1px solid rgba(16, 185, 129, 0.1);
                border-left: 4px solid var(--accent-primary);
                padding: 15px;
                border-radius: 8px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                transition: transform 0.2s, box-shadow 0.2s;
            `;
            
            card.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:6px; flex:1;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <i class="fa-solid fa-user-check" style="color: var(--accent-primary); font-size: 12px;"></i>
                        <span style="font-weight: 700; color: var(--text-primary); font-size: 15px;">${player.name || player.nombre}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:10px; font-size:13px; color: var(--text-secondary);">
                        <span style="display:flex; align-items:center; gap:5px;"><i class="fa-regular fa-calendar" style="opacity:0.7;"></i> ${formatDate(m.fecha)}</span>
                        ${isTraspaso ? `<span style="background: rgba(24cd8c,0.1); color: var(--accent-primary); padding: 2px 6px; border-radius:4px; font-size:11px; font-weight:bold;">Traspaso</span>` : `<span style="background: rgba(16,185,129,0.1); color: var(--accent-primary); padding: 2px 6px; border-radius:4px; font-size:11px; font-weight:bold;">Agente Libre</span>`}
                    </div>
                    <div style="margin-top: 5px; font-size: 13px;">
                        ${isTraspaso ? 
                            `<span style="opacity:0.7;">De</span> <strong style="color:var(--text-primary);">${teamOrig ? (teamOrig.nombre || teamOrig.name) : '?'}</strong> <i class="fa-solid fa-arrow-right" style="color:var(--accent-primary); margin:0 5px;"></i> <span style="opacity:0.7;">A</span> <strong style="color:var(--accent-primary); font-size:14px;">${teamDest.nombre || teamDest.name}</strong>` 
                            : 
                            `<span style="opacity:0.7;">Llega a</span> <strong style="color:var(--accent-primary); font-size:14px;">${teamDest.nombre || teamDest.name}</strong>`
                        }
                    </div>
                </div>
                <div>${actionBtn}</div>
            `;
            
            // Hover effect
            card.addEventListener('mouseenter', () => {
                card.style.transform = 'translateY(-2px)';
                card.style.boxShadow = '0 6px 12px rgba(0,0,0,0.2)';
            });
            card.addEventListener('mouseleave', () => {
                card.style.transform = 'none';
                card.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
            });

            altasBody.appendChild(card);
        });

        bajas.forEach(m => {
            const player = appData.jugadores.find(p => p.id == m.jugadorId);
            const teamOrig = appData.equipos.find(t => t.id == m.equipoOrigenId);
            if (!player || !teamOrig) return;

            const config = appData.config;
            const isLocked = currentTorneo === 'apertura' ? config.estadoApertura === 'finalizado' : config.estadoClausura === 'finalizado';
            const actionBtn = isLocked ? '' : `<button class="btn-action btn-delete" onclick="deleteMovimiento('${m.id}')" title="Eliminar Movimiento" style="background: rgba(239, 68, 68, 0.1); color: #ef4444;"><i class="fa-solid fa-trash"></i></button>`;

            const card = document.createElement("div");
            card.style.cssText = `
                display: flex;
                align-items: center;
                justify-content: space-between;
                background: var(--bg-primary);
                border: 1px solid rgba(248, 113, 113, 0.1);
                border-left: 4px solid #F87171;
                padding: 15px;
                border-radius: 8px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                transition: transform 0.2s, box-shadow 0.2s;
            `;
            
            card.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:6px; flex:1;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <i class="fa-solid fa-user-minus" style="color: #F87171; font-size: 12px;"></i>
                        <span style="font-weight: 700; color: var(--text-primary); font-size: 15px;">${player.name || player.nombre}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:10px; font-size:13px; color: var(--text-secondary);">
                        <span style="display:flex; align-items:center; gap:5px;"><i class="fa-regular fa-calendar" style="opacity:0.7;"></i> ${formatDate(m.fecha)}</span>
                        <span style="background: rgba(248,113,113,0.1); color: #F87171; padding: 2px 6px; border-radius:4px; font-size:11px; font-weight:bold;">Baja Definitiva</span>
                    </div>
                    <div style="margin-top: 5px; font-size: 13px;">
                        <span style="opacity:0.7;">Abandonó el</span> <strong style="color:#F87171; font-size:14px;">${teamOrig.nombre || teamOrig.name}</strong>
                    </div>
                </div>
                <div>${actionBtn}</div>
            `;
            
            // Hover effect
            card.addEventListener('mouseenter', () => {
                card.style.transform = 'translateY(-2px)';
                card.style.boxShadow = '0 6px 12px rgba(0,0,0,0.2)';
            });
            card.addEventListener('mouseleave', () => {
                card.style.transform = 'none';
                card.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
            });

            bajasBody.appendChild(card);
        });
    }

    window.reincorporarJugador = function(playerId) {
        const player = appData.jugadores.find(p => p.id == playerId);
        if(!player) return;

        let options = appData.equipos.map(eq => `<option value="${eq.id}">${eq.nombre}</option>`).join('');
        
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center; z-index:9999;';
        
        const modal = document.createElement('div');
        modal.className = 'modal-content';
        modal.style.maxWidth = '400px';
        modal.innerHTML = `
            <div class="modal-header">
                <h2>Reincorporar Jugador</h2>
                <button class="btn-close"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div style="margin-bottom:15px; text-align:left;">
                <p style="margin-bottom:10px; color:var(--text-secondary);">Selecciona el equipo al que se unirá <strong>${player.name || player.nombre}</strong>:</p>
                <select id="reincorporar-team-select" class="form-input">
                    ${options}
                </select>
            </div>
            <button id="btn-confirm-reincorporar" class="btn-primary w-full"><i class="fa-solid fa-check"></i> Confirmar</button>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const close = () => document.body.removeChild(overlay);
        modal.querySelector('.btn-close').onclick = close;

        modal.querySelector('#btn-confirm-reincorporar').onclick = () => {
            const teamId = document.getElementById("reincorporar-team-select").value;
            player.equipoId = teamId;
            player.status = 'activo';
            
            appData.movimientos.push({
                id: Date.now(),
                fecha: new Date().toISOString(),
                jugadorId: player.id,
                tipo: 'traspaso',
                equipoOrigenId: 'libre',
                equipoDestinoId: teamId
            });
            saveData();
            updateSelects();
            renderInactivos();
            close();
            alert("Jugador reincorporado exitosamente.");
        };
    };

    window.renderInactivos = function() {
        const inactivosBody = document.getElementById("inactivos-table-body");
        const emptyMsg = document.getElementById("inactivos-empty-msg");
        const searchInput = (document.getElementById("search-inactivos").value || "").toLowerCase();

        if (!inactivosBody) return;
        inactivosBody.innerHTML = '';

        const inactivos = appData.jugadores.filter(p => p.status !== 'activo');
        const filtered = inactivos.filter(p => (p.name || p.nombre || '').toLowerCase().includes(searchInput));

        if (filtered.length === 0) {
            emptyMsg.style.display = 'block';
            inactivosBody.parentElement.style.display = 'none';
        } else {
            emptyMsg.style.display = 'none';
            inactivosBody.parentElement.style.display = 'table';
            
            filtered.forEach((p, index) => {
                const tr = document.createElement("tr");
                
                const lastMove = appData.movimientos.slice().reverse().find(m => m.jugadorId == p.id && m.tipo === 'baja');
                let lastTeam = 'Desconocido';
                if (lastMove) {
                    const t = appData.equipos.find(eq => eq.id == lastMove.equipoOrigenId);
                    if (t) lastTeam = t.nombre;
                } else {
                    const t = appData.equipos.find(eq => eq.id == p.equipoId);
                    if (t) lastTeam = t.nombre;
                }

                tr.innerHTML = `
                    <td style="color:var(--text-secondary); font-weight:600;">${index + 1}.</td>
                    <td>
                        <div style="display:flex; align-items:center; gap:12px;">
                            <div class="player-avatar" style="width:35px; height:35px; min-width:35px; background:var(--bg-secondary); border-radius:50%; display:flex; align-items:center; justify-content:center; overflow:hidden;">
                                ${p.foto ? `<img src="${p.foto}" style="width:100%; height:100%; object-fit:cover;">` : `<i class="fa-solid fa-user" style="color:var(--text-secondary);"></i>`}
                            </div>
                            <span style="font-weight:600; color:var(--text-primary); font-size:15px;">${p.name || p.nombre}</span>
                        </div>
                    </td>
                    <td style="color:var(--text-secondary); font-size:14px;"><i class="fa-solid fa-clock-rotate-left" style="opacity:0.6; margin-right:5px;"></i> ${lastTeam}</td>
                    <td style="text-align:center;">
                        <button onclick="reincorporarJugador('${p.id}')" class="btn-primary" style="padding: 6px 12px; font-size: 13px; background: rgba(16,185,129,0.1); color: var(--accent-primary); border: 1px solid var(--accent-primary);"><i class="fa-solid fa-rotate-left"></i> Reincorporar</button>
                    </td>
                `;
                inactivosBody.appendChild(tr);
            });
        }
    };
    
    document.getElementById("search-inactivos")?.addEventListener("input", renderInactivos);

    function renderStats(tab) {
        const config = tabTitles[tab];
        currentTabTitle.textContent = config.title;
        
        tableBody.innerHTML = "";
        theadTr.innerHTML = "";

        // Remover descripción previa si existe
        const oldDesc = document.getElementById("stats-logic-desc");
        if (oldDesc) oldDesc.remove();

        if (tab === 'novatos') {
            const descriptionHTML = `<div id="stats-logic-desc" style="display: flex; justify-content: space-between; align-items: center; background: rgba(16, 185, 129, 0.1); border-left: 4px solid var(--accent-primary); padding: 15px; margin-bottom: 20px; border-radius: 4px; font-size: 0.9rem; color: var(--text-secondary);">
                <div>
                    <strong style="color: var(--accent-primary);">¿Cómo se calcula el rendimiento del Novato?</strong><br>
                    Se utiliza un <strong>Sistema de Puntos Directos</strong>: Cada gol suma 50 puntos, cada minuto jugado suma 0.5 puntos, cada tarjeta amarilla resta 15 puntos y cada roja resta 30 puntos. <br>
                    <em>Nota: Los datos que agregues en el panel de edición se <strong>sumarán</strong> automáticamente a los datos históricos que ya tenía el jugador, así no tienes que recalcular todo desde la jornada 1.</em>
                </div>
                <button id="btn-download-social-novatos" style="background: #10b981; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: bold; display: flex; align-items: center; gap: 8px; font-size: 1rem; transition: 0.2s;"><i class="fa-solid fa-camera"></i> Guardar Imagen</button>
            </div>`;
            tableContainer.insertAdjacentHTML('beforebegin', descriptionHTML);

            const btnDownloadNovatos = document.getElementById('btn-download-social-novatos');
            if(btnDownloadNovatos) {
                btnDownloadNovatos.addEventListener('click', () => {
                    if (window.downloadNovatosImage) window.downloadNovatosImage();
                });
            }

            theadTr.innerHTML = `
                <th>Pos</th>
                <th>Jugador</th>
                <th>Equipo</th>
                <th>Goles</th>
                <th>Minutos</th>
                <th>Amarillas</th>
                <th>Rendimiento</th>
            `;

            let realNovatos = appData.jugadores.filter(p => p.isNovato);
            
            let novatosData = realNovatos.map(realPlayer => {
                const teamObj = appData.equipos.find(t => t.id === realPlayer.equipoId);
                const stats = realPlayer.stats[currentTorneo] || {};
                return {
                    player: realPlayer.name,
                    team: teamObj ? teamObj.nombre : 'Sin Equipo',
                    goles: stats.goles || 0,
                    minutos: stats.minutos || 0,
                    amarillas: stats.amarillas || 0,
                    rojas: stats.rojas || 0,
                    isInactivo: realPlayer.status !== 'activo'
                };
            });

            // Aplicar matemática a la lista final
            novatosData = novatosData.map(d => {
                let rendimientoNum = 0;
                if (d.minutos > 0) {
                    let puntos = (d.goles * 50) + (d.minutos * 0.5) - (d.amarillas * 15) - (d.rojas * 30);
                    rendimientoNum = puntos > 0 ? puntos : 0;
                }
                return {
                    ...d,
                    rendimientoNum: rendimientoNum,
                    rendimiento: rendimientoNum === 0 ? "0 pts" : rendimientoNum.toFixed(0) + " pts"
                };
            });

            novatosData.sort((a, b) => {
                if(b.rendimientoNum !== a.rendimientoNum) return b.rendimientoNum - a.rendimientoNum;
                if((b.goles || 0) !== (a.goles || 0)) return (b.goles || 0) - (a.goles || 0);
                return a.minutos - b.minutos;
            });

            novatosData.forEach((d, idx) => d.pos = idx + 1);

            if (novatosData.length > 0) {
                topPlayerName.textContent = novatosData[0].player;
                topPlayerStat.textContent = `${novatosData[0].minutos} Minutos`;
            }

            novatosData.forEach((d) => {
                const posClass = d.pos === 1 ? "pos-1" : d.pos === 2 ? "pos-2" : d.pos === 3 ? "pos-3" : "";
                const tr = document.createElement("tr");
                const colorRendimiento = d.rendimiento.includes("-") ? "#f87171" : d.rendimiento !== "0%" ? "#86efac" : "var(--text-muted)";
                
                let badgeInactivo = d.isInactivo ? `<span style="background: rgba(239, 68, 68, 0.2); color: #f87171; padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; margin-left: 8px; border: 1px solid rgba(239, 68, 68, 0.5); font-weight: bold;">INACTIVO</span>` : "";

                tr.innerHTML = `
                    <td><span class="pos-badge ${posClass}">${d.pos}</span></td>
                    <td>
                        <div class="player-cell">
                            <span class="player-name" style="font-size: 0.95rem; display: flex; align-items: center;">${d.player} ${badgeInactivo}</span>
                        </div>
                    </td>
                    <td><span class="team-badge" style="background: rgba(255,255,255,0.05);">${d.team}</span></td>
                    <td><span class="stat-highlight" style="color: var(--text-primary); font-size: 1rem;">${d.goles > 0 ? d.goles : '-'}</span></td>
                    <td><span class="stat-highlight" style="color: var(--accent-primary); font-size: 1rem;">${d.minutos}</span></td>
                    <td><span class="stat-highlight" style="color: #FCD34D; font-size: 1rem;">${d.amarillas > 0 ? d.amarillas : '-'}</span></td>
                    <td><span class="stat-highlight" style="color: ${colorRendimiento}; font-size: 1rem;">${d.rendimiento}</span></td>
                `;
                tableBody.appendChild(tr);
            });
            return;
        } else if (tab === 'porteros') {
            const descriptionHTML = `<div id="stats-logic-desc" style="background: rgba(59, 130, 246, 0.1); border-left: 4px solid #3B82F6; padding: 15px; margin-bottom: 20px; border-radius: 4px; font-size: 0.9rem; color: var(--text-secondary); display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong style="color: #3B82F6;">¿Cómo se calcula el rendimiento del Portero?</strong><br>
                    Se utiliza un <strong>Sistema de Puntos Directos</strong> que premia la constancia: Cada minuto jugado suma 1 punto, y cada gol recibido resta 10 puntos.<br>
                    <em>Nota: Los datos que agregues en el panel de edición se <strong>sumarán</strong> automáticamente al registro histórico del jugador.</em>
                </div>
                <button id="btn-download-social" style="background: #10b981; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: bold; display: flex; align-items: center; gap: 8px; font-size: 1rem; transition: 0.2s;"><i class="fa-solid fa-camera"></i> Guardar Imagen</button>
            </div>`;
            tableContainer.insertAdjacentHTML('beforebegin', descriptionHTML);

            document.getElementById('btn-download-social').addEventListener('click', () => {
                if (window.downloadPorterosImage) window.downloadPorterosImage();
            });

            theadTr.innerHTML = `
                <th>Pos</th>
                <th>Jugador</th>
                <th>Equipo</th>
                <th>Goles Rec.</th>
                <th>Minutos</th>
                <th>Puntos</th>
            `;

            let realPorteros = appData.jugadores.filter(p => p.isPortero);
            
            let porterosData = realPorteros.map(realPlayer => {
                const teamObj = appData.equipos.find(t => t.id === realPlayer.equipoId);
                const stats = realPlayer.stats[currentTorneo] || {};
                return {
                    player: realPlayer.name,
                    team: teamObj ? teamObj.nombre : 'Sin Equipo',
                    goles: stats.golesRecibidos || 0,
                    minutos: stats.minutos || 0,
                    isInactivo: realPlayer.status !== 'activo'
                };
            });

            // Aplicar matemática a la lista final
            porterosData = porterosData.map(d => {
                let rendimientoNum = 0;
                if (d.minutos > 0) {
                    // Sistema de puntos directos: 1 por minuto, -10 por gol recibido
                    let puntos = d.minutos - (d.goles * 10);
                    rendimientoNum = puntos > 0 ? puntos : 0;
                }
                return {
                    ...d,
                    rendimientoNum: rendimientoNum,
                    rendimiento: rendimientoNum === 0 ? "0 pts" : rendimientoNum.toFixed(0) + " pts"
                };
            });

            porterosData.sort((a, b) => {
                if(b.rendimientoNum !== a.rendimientoNum) return b.rendimientoNum - a.rendimientoNum;
                if((a.goles || 0) !== (b.goles || 0)) return (a.goles || 0) - (b.goles || 0); // Menos goles es mejor en empate
                return b.minutos - a.minutos; // Más minutos es mejor
            });

            porterosData.forEach((d, idx) => d.pos = idx + 1);

            if (porterosData.length > 0) {
                topPlayerName.textContent = porterosData[0].player;
                topPlayerStat.textContent = `${porterosData[0].rendimientoNum} Puntos`;
            }

            porterosData.forEach((d) => {
                const posClass = d.pos === 1 ? "pos-1" : d.pos === 2 ? "pos-2" : d.pos === 3 ? "pos-3" : "";
                const tr = document.createElement("tr");
                const colorRendimiento = d.rendimiento.includes("-") ? "#f87171" : d.rendimiento !== "0 pts" ? "#86efac" : "var(--text-muted)";
                
                let badgeInactivo = d.isInactivo ? `<span style="background: rgba(239, 68, 68, 0.2); color: #f87171; padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; margin-left: 8px; border: 1px solid rgba(239, 68, 68, 0.5); font-weight: bold;">INACTIVO</span>` : "";

                tr.innerHTML = `
                    <td><span class="pos-badge ${posClass}">${d.pos}</span></td>
                    <td>
                        <div class="player-cell">
                            <span class="player-name" style="font-size: 0.95rem; display: flex; align-items: center;">${d.player} ${badgeInactivo}</span>
                        </div>
                    </td>
                    <td><span class="team-badge" style="background: rgba(255,255,255,0.05);">${d.team}</span></td>
                    <td><span class="stat-highlight" style="color: #f87171; font-size: 1rem;">${d.goles > 0 ? d.goles : '-'}</span></td>
                    <td><span class="stat-highlight" style="color: var(--accent-primary); font-size: 1rem;">${d.minutos}</span></td>
                    <td><span class="stat-highlight" style="color: ${colorRendimiento}; font-size: 1rem; font-weight:bold;">${d.rendimiento}</span></td>
                `;
                tableBody.appendChild(tr);
            });
            return;
        } else {
            theadTr.innerHTML = `
                <th>Pos</th>
                <th>Jugador</th>
                <th>Equipo</th>
                <th id="stat-column-header">${config.statName}</th>
            `;
            // Removed assignment to constant variable
        }

        let activePlayers = appData.jugadores;

        if (tab === 'porteros') activePlayers = activePlayers.filter(p => p.isPortero);

        let statData = activePlayers.map(p => {
            const team = appData.equipos.find(t => t.id === p.equipoId);
            let val = 0;
            const torneoStats = p.stats[currentTorneo] || {};

            if (tab === 'goleadores') val = torneoStats.goles || 0;
            else if (tab === 'amarillas') val = torneoStats.amarillas || 0;
            else if (tab === 'rojas') val = torneoStats.rojas || 0;
            else if (tab === 'porteros') val = torneoStats.golesRecibidos || 0;

            let lastTeamName = team ? team.nombre : 'Sin Equipo';
            if (p.status !== 'activo') {
                const lastMove = appData.movimientos.slice().reverse().find(m => m.jugadorId == p.id && m.tipo === 'baja');
                if (lastMove) {
                    const t = appData.equipos.find(eq => eq.id == lastMove.equipoOrigenId);
                    if (t) lastTeamName = t.nombre;
                }
            }

            return { player: p, team: lastTeamName, stat: val, isInactivo: p.status !== 'activo' };
        });

        if (tab !== 'porteros') {
            statData = statData.filter(d => d.stat > 0);
        }

        if (statData.length > 0) {
            if (tab === 'porteros') statData.sort((a, b) => a.stat - b.stat);
            else statData.sort((a, b) => b.stat - a.stat);

            topPlayerName.textContent = statData[0].player.name;
            topPlayerStat.textContent = `${statData[0].stat} ${config.statName}`;

            statData.forEach((d, index) => {
                const pos = index + 1;
                let posClass = pos === 1 ? "pos-1" : pos === 2 ? "pos-2" : pos === 3 ? "pos-3" : "";

                let rowClass = "";
                let alertBadge = "";
                let badgeInactivo = d.isInactivo ? `<span style="background: rgba(239, 68, 68, 0.2); color: #f87171; padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; margin-left: 8px; border: 1px solid rgba(239, 68, 68, 0.5); font-weight: bold;">INACTIVO</span>` : "";

                if (tab === 'amarillas') {
                    const ciclo = d.stat % 5;
                    if (d.stat > 0 && ciclo === 0) {
                        rowClass = "row-suspended";
                        alertBadge = `<span class="badge-suspended">Suspendido (5)</span>`;
                    } else if (ciclo === 4) {
                        rowClass = "row-warning";
                        alertBadge = `<span class="badge-warning">Riesgo (4)</span>`;
                    }
                }

                const tr = document.createElement("tr");
                if (rowClass) tr.className = rowClass;

                tr.innerHTML = `
                    <td><span class="pos-badge ${posClass}">${pos}</span></td>
                    <td>
                        <div class="player-cell">
                            <div class="player-avatar"><i class="fa-solid fa-user"></i></div>
                            <span>${d.player.name} ${alertBadge} ${badgeInactivo}</span>
                        </div>
                    </td>
                    <td><span class="team-badge">${d.team}</span></td>
                    <td><span class="stat-highlight" style="${tab === 'amarillas' ? 'color:#fbbf24' : tab === 'rojas' ? 'color:#ef4444' : ''}">${d.stat}</span></td>
                `;

                // Edit on click
                if (tab === 'amarillas' || tab === 'rojas') {
                    tr.style.cursor = "pointer";
                    tr.title = "Clic para ver historial y editar";
                    tr.onclick = () => {
                        openReporteModal(tab, d.player, d.stat, () => renderStats(tab));
                    };
                }

                tableBody.appendChild(tr);
            });
            
            // Logica del boton Top 10 Imagen y Add Tarjeta
            const btnExportTop10 = document.getElementById("btn-export-top10");
            const btnAddTarjeta = document.getElementById("btn-add-tarjeta");
            
            if (btnExportTop10 && btnAddTarjeta) {
                if (tab === 'amarillas' || tab === 'rojas') {
                    btnExportTop10.style.display = "inline-block";
                    btnExportTop10.onclick = () => exportTop10Image(tab, statData.slice(0, 10));
                    
                    btnAddTarjeta.style.display = "inline-block";
                    btnAddTarjeta.onclick = () => openAddTarjetaModal(tab, () => renderStats(tab));
                } else {
                    btnExportTop10.style.display = "none";
                    btnAddTarjeta.style.display = "none";
                }
            }
        } else {
            topPlayerName.textContent = "N/A";
            topPlayerStat.textContent = "0";
            tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center;">No hay datos en el Torneo ${currentTorneo.toUpperCase()}.</td></tr>`;
        }

        // Re-aplicar el filtro de búsqueda si hay texto
        const searchInput = document.getElementById('stats-search-input');
        if (searchInput && searchInput.value) {
            searchInput.dispatchEvent(new Event('input'));
        }
    }

    // --- INICIO VIEW RENDER LOGIC ---
    function renderInicio() {
        if (!appData.config || !appData.config.ligaInfo) return;
        const info = appData.config.ligaInfo;

        document.getElementById("inicio-title").textContent = (info.nombre || "FEDERACIÓN MUNICIPAL DE FÚTBOL").toUpperCase();

        const sloganEl = document.querySelector(".inicio-slogan");
        if (sloganEl) {
            sloganEl.textContent = info.eslogan ? `"${info.eslogan}"` : "";
        }

        const dedicatoriaEl = document.getElementById("inicio-dedicatoria-text");
        if (dedicatoriaEl) {
            dedicatoriaEl.textContent = info.dedicatoria ? `DEDICADO A: ${info.dedicatoria}` : "";
        }

        if (info.logo) {
            document.getElementById("inicio-logo-img").src = info.logo;
            document.getElementById("inicio-logo-img").style.display = 'block';
        }
        if (info.portada) {
            document.getElementById("inicio-cover-img").style.backgroundImage = `url(${info.portada})`;
        }

        // Update Contact Card
        document.getElementById("inicio-phone1").textContent = info.celular || "---";

        const emailEl = document.getElementById("inicio-email");
        if (emailEl) emailEl.textContent = info.correo || "No disponible";

        const webEl = document.getElementById("inicio-web");
        if (webEl) webEl.textContent = info.sitio_web || "No disponible";

        // Dates Card
        const dateStartEl = document.getElementById("inicio-date-start");
        const dateEndEl = document.getElementById("inicio-date-end");
        if (dateStartEl && dateEndEl) {
            dateStartEl.textContent = info.fecha_inicio ? formatDate(info.fecha_inicio) : "Por definir";
            dateEndEl.textContent = info.fecha_fin ? formatDate(info.fecha_fin) : "Por definir";
        }

        // Podium Logic (Mocking for now as per design)
        let activePlayers = appData.jugadores.filter(p => p.status === 'activo');
        // Let's just find top 3 teams based on goals for the demo, or mock if none
        const stand = appData.equipos.map(t => {
            const players = activePlayers.filter(p => p.equipoId === t.id);
            const goals = players.reduce((sum, p) => sum + (p.stats[currentTorneo] ? p.stats[currentTorneo].goles : 0), 0);
            return { name: t.nombre, logo: t.logo, score: goals };
        }).sort((a, b) => b.score - a.score);

        if (stand.length >= 1) {
            document.getElementById("podium-name-1").textContent = stand[0].name;
            document.getElementById("premio-campeon").textContent = stand[0].name;
            if (stand[0].logo) {
                document.getElementById("podium-icon-1").style.display = "none";
                document.getElementById("podium-img-1").style.display = "block";
                document.getElementById("podium-img-1").src = stand[0].logo;
            }
        }
        if (stand.length >= 2) {
            document.getElementById("podium-name-2").textContent = stand[1].name;
            document.getElementById("premio-subcampeon").textContent = stand[1].name;
        }
        if (stand.length >= 3) {
            document.getElementById("podium-name-3").textContent = stand[2].name;
            document.getElementById("premio-tercero").textContent = stand[2].name;
        }
    }

    function updateSelects() {
        const selectsEquipos = [document.getElementById("select-team-transfer")];
        const selectsJugadores = [document.getElementById("select-player-stat"), document.getElementById("select-player-transfer"), document.getElementById("select-player-baja")];

        const optsEquipos = '<option value="">-- Selecciona --</option>' +
            appData.equipos.map(t => `<option value="${t.id}">${t.nombre || t.name}</option>`).join('');

        selectsEquipos.forEach(s => { if (s) s.innerHTML = optsEquipos; });

        const activePlayers = appData.jugadores.filter(p => p.status === 'activo');
        const optsJugadores = '<option value="">-- Selecciona Jugador --</option>' +
            activePlayers.sort((a, b) => {
                const nameA = a.name || a.nombre || '';
                const nameB = b.name || b.nombre || '';
                return nameA.localeCompare(nameB);
            }).map(p => {
                const t = appData.equipos.find(eq => eq.id === p.equipoId);
                const pName = p.name || p.nombre || 'Desconocido';
                const tName = t ? (t.nombre || t.name || '?') : '?';
                return `<option value="${p.id}">${pName} (${tName})</option>`;
            }).join('');

        selectsJugadores.forEach(s => { if (s) s.innerHTML = optsJugadores; });
    }

    // =====================================================================
    // EXPORT FUNCTIONS
    // =====================================================================
    window.exportarCSV = function () {
        const partidos = appData.partidos.filter(p => p.torneo === currentTorneo);
        if (partidos.length === 0) {
            alert("No hay partidos para exportar.");
            return;
        }

        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Fase,Jornada,Equipo Local,Goles Local,Goles Visitante,Equipo Visitante\n";

        partidos.forEach(p => {
            const local = p.equipo1Id === "vacante" ? "Descansa" : (appData.equipos.find(e => e.id === p.equipo1Id)?.nombre || "Desconocido");
            const visitante = p.equipo2Id === "vacante" ? "Descansa" : (appData.equipos.find(e => e.id === p.equipo2Id)?.nombre || "Desconocido");
            const g1 = p.goles1 !== null ? p.goles1 : "-";
            const g2 = p.goles2 !== null ? p.goles2 : "-";

            const fase = p.fase;
            const jornadaName = p.fase === "liga" ? `Jornada ${p.jornada}` : p.jornada === 1 ? "Ida" : "Vuelta";

            csvContent += `${fase},${jornadaName},${local},${g1},${g2},${visitante}\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Calendario_${currentTorneo}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    window.exportarImagen = function () {
        const container = document.querySelector("#sorteo-resultados-container .jornada-matches");
        if (!container || !window.html2canvas) {
            alert("Asegúrate de estar viendo los partidos para generar la imagen. (Ve a Sorteos y asegúrate de que haya partidos)");
            return;
        }

        // Agregar un título temporal atractivo
        const wrapper = document.createElement("div");
        wrapper.style.padding = "20px";
        wrapper.style.background = "#0f172a";
        wrapper.style.color = "#fff";
        wrapper.style.fontFamily = "var(--font-family)";
        wrapper.style.width = "600px";

        const title = document.createElement("h2");
        title.innerText = `Resultados - ${currentTorneo.toUpperCase()}`;
        title.style.textAlign = "center";
        title.style.marginBottom = "20px";
        title.style.color = "#fff";
        wrapper.appendChild(title);

        const subtitle = document.createElement("h3");
        subtitle.innerText = document.querySelector(".btn-jornada-tab.active")?.innerText || "Jornada";
        subtitle.style.textAlign = "center";
        subtitle.style.marginBottom = "20px";
        subtitle.style.color = "#10b981";
        wrapper.appendChild(subtitle);

        // Clonar la lista de partidos
        const clone = container.cloneNode(true);
        // Limpiar inputs para display estático
        clone.querySelectorAll("input").forEach(inp => {
            const val = inp.value || "-";
            const span = document.createElement("span");
            span.innerText = val;
            span.style.fontSize = "1.2rem";
            span.style.fontWeight = "bold";
            inp.parentNode.replaceChild(span, inp);
        });
        clone.querySelectorAll("button").forEach(btn => btn.remove());

        wrapper.appendChild(clone);
        document.body.appendChild(wrapper);

        // Capturar
        window.html2canvas(wrapper, {
            backgroundColor: "#0f172a",
            scale: 2
        }).then(canvas => {
            const link = document.createElement("a");
            link.download = `Jornada_${currentTorneo}.png`;
            link.href = canvas.toDataURL("image/png");
            link.click();
            document.body.removeChild(wrapper);
        }).catch(err => {
            console.error("Error al generar imagen:", err);
            document.body.removeChild(wrapper);
            alert("Hubo un error al generar la imagen.");
        });
    }

    window.exportarPDF = function () {
        if (!window.html2pdf) {
            alert("Librería PDF no cargada aún. Espera un momento y vuelve a intentarlo.");
            return;
        }
        const partidos = appData.partidos.filter(p => p.torneo === currentTorneo);
        if (partidos.length === 0) {
            alert("No hay partidos para exportar.");
            return;
        }

        const wrapper = document.createElement("div");
        wrapper.style.padding = "20px";
        wrapper.style.fontFamily = "Helvetica, Arial, sans-serif";
        wrapper.style.color = "#000";
        wrapper.style.backgroundColor = "#fff";

        // Header
        const header = document.createElement("div");
        header.style.textAlign = "center";
        header.style.marginBottom = "30px";
        header.style.borderBottom = "2px solid #333";
        header.style.paddingBottom = "10px";

        // Tomar info de la liga actual (mocked or from appData.ligaInfo)
        const nombreLiga = appData.ligaInfo?.nombre_liga || "LIGA VIRTUAL";
        const federacion = appData.ligaInfo?.federacion || "";

        header.innerHTML = `
            <p style="margin:0; font-size: 12px; color: #777;">${federacion}</p>
            <h1 style="margin:5px 0; font-size: 24px; color: #1e293b;">${nombreLiga.toUpperCase()}</h1>
            <h2 style="margin:5px 0; color: #10b981;">CALENDARIO OFICIAL - ${currentTorneo.toUpperCase()}</h2>
        `;
        wrapper.appendChild(header);

        // Agrupar por jornada
        const partidosPorJornada = {};
        partidos.forEach(p => {
            let key;
            if (p.fase === 'eliminatorias') {
                key = p.jornada === 1 ? 'Ida' : 'Vuelta';
            } else {
                key = `Jornada ${p.jornada}`;
            }
            if (!partidosPorJornada[key]) partidosPorJornada[key] = [];
            partidosPorJornada[key].push(p);
        });

        const keys = Object.keys(partidosPorJornada).sort((a, b) => {
            const numA = parseInt(a.replace(/[^\d]/g, "")) || 0;
            const numB = parseInt(b.replace(/[^\d]/g, "")) || 0;
            return numA - numB;
        });

        // En lugar de iterar por todas las jornadas, tomamos solo la activa
        const jornadaName = window.currentJornadaTab || keys[0];
        if (!jornadaName || !partidosPorJornada[jornadaName]) {
            alert("No hay partidos para exportar en esta jornada.");
            return;
        }

        const jTitle = document.createElement("h3");
        jTitle.innerText = jornadaName.replace(/Jornada\s(\d+)/, "$1º Fecha");
        jTitle.style.backgroundColor = "#f1f5f9";
        jTitle.style.padding = "8px";
        jTitle.style.marginTop = "20px";
        jTitle.style.borderLeft = "4px solid #10b981";
        jTitle.style.fontSize = "16px";
        wrapper.appendChild(jTitle);

        const table = document.createElement("table");
        table.style.width = "100%";
        table.style.borderCollapse = "collapse";
        table.style.marginBottom = "15px";
        table.style.fontSize = "14px";

        partidosPorJornada[jornadaName].forEach(p => {
            const local = p.equipo1Id === "vacante" ? "Descansa" : (appData.equipos.find(e => e.id === p.equipo1Id)?.nombre || "Equipo Desconocido");
            const visitante = p.equipo2Id === "vacante" ? "Descansa" : (appData.equipos.find(e => e.id === p.equipo2Id)?.nombre || "Equipo Desconocido");
            const g1 = p.goles1 !== null ? p.goles1 : "-";
            const g2 = p.goles2 !== null ? p.goles2 : "-";

            const tr = document.createElement("tr");
            tr.innerHTML = `
                    <td style="width:40%; text-align:right; padding:8px; border-bottom:1px solid #e2e8f0;">${local}</td>
                    <td style="width:20%; text-align:center; padding:8px; border-bottom:1px solid #e2e8f0; font-weight:bold; background:#f8fafc; color:#334155;">${g1} - ${g2}</td>
                    <td style="width:40%; text-align:left; padding:8px; border-bottom:1px solid #e2e8f0;">${visitante}</td>
                `;
            table.appendChild(tr);
        });
        wrapper.appendChild(table);

        const opt = {
            margin: 10,
            filename: `Calendario_${currentTorneo}.pdf`,
            image: { type: "jpeg", quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
        };

        window.html2pdf().set(opt).from(wrapper).save();
    }
    
    } catch (initErr) {
        console.error("Error en inicializacion UI:", initErr);
        alert("Error al cargar la interfaz: " + initErr.message + "\nLinea: " + initErr.lineNumber);
    }
});

/* =========================================================
   LIVE MATCH TRACKER LOGIC
   ========================================================= */
let currentLiveMatchId = null;
let liveMatchInterval = null;

// Helper para guardar inmediatamente los detalles en memoria y Supabase
function saveLiveMatchState(match) {
    savePartidosToSupabase();
}

function openMatchDashboard(matchId) {
    currentLiveMatchId = matchId;
    const match = appData.partidos.find(p => p.id === matchId);
    if (!match) return;

    if (!match.detalles) {
        match.detalles = {};
    }
    const d = match.detalles;

    // Inicializar estado si no existe
    if (!d.estado) d.estado = 'programado'; // programado, en_vivo, finalizado
    if (!d.eventos) d.eventos = [];
    if (!d.alineacionLocal) d.alineacionLocal = { formacion: '4-4-2', titulares: [], suplentes: [] };
    if (!d.alineacionVis) d.alineacionVis = { formacion: '4-4-2', titulares: [], suplentes: [] };

    const local = appData.equipos.find(e => e.id === match.equipo1Id);
    const vis = appData.equipos.find(e => e.id === match.equipo2Id);

    // Header info
    document.getElementById("match-logo-local").src = local ? local.logo : '';
    document.getElementById("match-name-local").innerText = local ? local.nombre : '';
    document.getElementById("match-logo-vis").src = vis ? vis.logo : '';
    document.getElementById("match-name-vis").innerText = vis ? vis.nombre : '';

    // Programación
    document.getElementById("match-datetime-input").value = d.fechaProgramada || '';
    document.getElementById("match-location-input").value = d.lugar || '';

    // Score
    document.getElementById("score-val-local").innerText = match.goles1 || '0';
    document.getElementById("score-val-vis").innerText = match.goles2 || '0';

    updateDashboardUIForState(match, d);
    renderDashboardFeed(match);

    document.getElementById("modal-match-dashboard").classList.add("active");
}

function updateDashboardUIForState(match, d) {
    const badge = document.getElementById("match-live-badge");
    const timerDisplay = document.getElementById("match-timer-display");
    const liveScore = document.getElementById("match-live-score");
    const vsText = document.getElementById("match-vs-text");
    const btnStart = document.getElementById("btn-start-match");
    const btnEnd = document.getElementById("btn-end-match");

    clearInterval(liveMatchInterval);

    if (d.estado === 'programado') {
        badge.className = "badge-status programado";
        badge.innerText = "Programado";
        timerDisplay.style.display = "none";
        liveScore.style.display = "none";
        vsText.style.display = "block";
        btnStart.style.display = "block";
        btnEnd.style.display = "none";
    } else if (d.estado === 'en_vivo') {
        badge.className = "badge-status envivo";
        badge.innerText = "EN VIVO";
        timerDisplay.style.display = "flex";
        liveScore.style.display = "flex";
        vsText.style.display = "none";
        btnStart.style.display = "none";
        btnEnd.style.display = "block";
        
        // Start timer
        startLiveTimer(match, d);
    } else if (d.estado === 'finalizado') {
        badge.className = "badge-status finalizado";
        badge.innerText = "Finalizado";
        timerDisplay.style.display = "none";
        liveScore.style.display = "flex";
        vsText.style.display = "none";
        btnStart.style.display = "none";
        btnEnd.style.display = "none";
    }
}

function startLiveTimer(match, d) {
    const timerSpan = document.getElementById("timer-val");
    if (!d.tiempoInicio) d.tiempoInicio = Date.now();
    
    function updateClock() {
        const now = Date.now();
        const diff = Math.floor((now - d.tiempoInicio) / 1000);
        const m = Math.floor(diff / 60).toString().padStart(2, '0');
        const s = (diff % 60).toString().padStart(2, '0');
        timerSpan.innerText = `${m}:${s}`;
    }
    updateClock();
    liveMatchInterval = setInterval(updateClock, 1000);
}

// Event Listeners for Dashboard UI
document.getElementById("btn-close-match-dashboard")?.addEventListener("click", () => {
    clearInterval(liveMatchInterval);
    document.getElementById("modal-match-dashboard").classList.remove("active");
});

document.querySelectorAll(".dash-tab").forEach(tab => {
    tab.addEventListener("click", (e) => {
        document.querySelectorAll(".dash-tab").forEach(t => t.classList.remove("active"));
        document.querySelectorAll(".dash-tab-content").forEach(c => c.classList.remove("active"));
        
        const target = e.target.getAttribute("data-tab");
        e.target.classList.add("active");
        document.getElementById(`tab-${target}`).classList.add("active");
    });
});

document.getElementById("btn-save-match-info")?.addEventListener("click", () => {
    const match = appData.partidos.find(p => p.id === currentLiveMatchId);
    if (!match) return;
    match.detalles.fechaProgramada = document.getElementById("match-datetime-input").value;
    match.detalles.lugar = document.getElementById("match-location-input").value;
    saveLiveMatchState(match);
    alert("Programación guardada.");
});

document.getElementById("btn-start-match")?.addEventListener("click", () => {
    const match = appData.partidos.find(p => p.id === currentLiveMatchId);
    if (!match) return;
    
    match.detalles.estado = 'en_vivo';
    match.detalles.tiempoInicio = Date.now();
    match.goles1 = 0;
    match.goles2 = 0;
    
    addMatchEvent(match, 'inicio', null, null, "Partido iniciado");
    
    updateDashboardUIForState(match, match.detalles);
    renderDashboardFeed(match);
    saveLiveMatchState(match);
});

document.getElementById("btn-end-match")?.addEventListener("click", () => {
    if (!confirm("¿Seguro que quieres finalizar el partido? El resultado será oficial.")) return;
    const match = appData.partidos.find(p => p.id === currentLiveMatchId);
    if (!match) return;
    
    match.detalles.estado = 'finalizado';
    addMatchEvent(match, 'fin', null, null, "Partido finalizado oficialmente");
    
    updateDashboardUIForState(match, match.detalles);
    renderDashboardFeed(match);
    saveLiveMatchState(match);
    renderPartidosGenerados(); // Update main UI
});

document.getElementById("btn-forfeit-match")?.addEventListener("click", () => {
    if (!confirm("¿Declarar W.O. (3-0)?")) return;
    const match = appData.partidos.find(p => p.id === currentLiveMatchId);
    if (!match) return;
    
    const local = appData.equipos.find(e => e.id === match.equipo1Id);
    const vis = appData.equipos.find(e => e.id === match.equipo2Id);
    
    const winner = prompt(`¿Quién gana el W.O.? Escribe "local" (${local?.nombre}) o "visitante" (${vis?.nombre})`).toLowerCase().trim();
    if (winner === 'local') {
        match.goles1 = 3; match.goles2 = 0;
    } else if (winner === 'visitante') {
        match.goles1 = 0; match.goles2 = 3;
    } else {
        alert("Operación cancelada."); return;
    }
    
    match.detalles.estado = 'finalizado';
    addMatchEvent(match, 'wo', null, null, `Victoria por W.O. para el ${winner}`);
    
    updateDashboardUIForState(match, match.detalles);
    renderDashboardFeed(match);
    saveLiveMatchState(match);
    renderPartidosGenerados();
});

// Quick Actions
function addMatchEvent(match, tipo, equipo, jugadorId, extraDetalle = "") {
    let minuto = 0;
    if (match.detalles.tiempoInicio) {
        minuto = Math.floor((Date.now() - match.detalles.tiempoInicio) / 60000);
    }
    
    match.detalles.eventos.unshift({
        tipo: tipo,
        equipo: equipo,
        jugadorId: jugadorId,
        minuto: minuto,
        detalle: extraDetalle
    });
}

function renderDashboardFeed(match) {
    const feedContainer = document.getElementById("match-live-feed");
    const eventos = match.detalles.eventos || [];
    
    if (eventos.length === 0) {
        feedContainer.innerHTML = `<div class="feed-empty">No hay eventos aún.</div>`;
        return;
    }
    
    let html = "";
    eventos.forEach(ev => {
        let alignClass = ev.equipo === 'local' ? 'local' : (ev.equipo === 'visitante' ? 'visitante' : 'neutral');
        let iconHtml = '';
        if(ev.tipo === 'gol') iconHtml = `<i class="fa-solid fa-trophy feed-icon gol"></i>`;
        if(ev.tipo === 'amarilla') iconHtml = `<i class="fa-solid fa-square feed-icon amarilla"></i>`;
        if(ev.tipo === 'roja') iconHtml = `<i class="fa-solid fa-square feed-icon roja"></i>`;
        if(ev.tipo === 'cambio') iconHtml = `<i class="fa-solid fa-right-left feed-icon cambio"></i>`;
        if(ev.tipo === 'minutos') iconHtml = `<i class="fa-regular fa-clock feed-icon minutos"></i>`;
        if(ev.tipo === 'inicio' || ev.tipo === 'fin' || ev.tipo === 'wo') iconHtml = `<i class="fa-solid fa-whistle feed-icon"></i>`;
        
        let playerName = "";
        if (ev.jugadorId) {
            const jug = appData.jugadores.find(j => j.id === ev.jugadorId);
            if (jug) playerName = jug.nombre;
        }
        
        html += `
        <div class="feed-item ${alignClass}">
            <div class="feed-time">${ev.minuto}'</div>
            ${iconHtml}
            <div class="feed-content">
                ${playerName ? `<span class="feed-player">${playerName}</span>` : ''}
                <span class="feed-detail">${ev.detalle}</span>
            </div>
        </div>
        `;
    });
    
    feedContainer.innerHTML = html;
}

// Logic for opening player selection for actions
let currentActionType = null;
let currentActionMatch = null;

function openPlayerSelectionForAction(actionType, isFastResult = false) {
    const targetMatchId = isFastResult ? currentFastResultMatchId : currentLiveMatchId;
    currentActionMatch = appData.partidos.find(p => p.id === targetMatchId);
    
    if (!currentActionMatch) {
        return;
    }
    
    if (!currentActionMatch.detalles) {
        currentActionMatch.detalles = { eventos: [], estado: 'programado' };
    }
    if (!currentActionMatch.detalles.eventos) {
        currentActionMatch.detalles.eventos = [];
    }
    
    currentActionType = actionType;
    const titleMap = {
        'gol': 'Registrar Gol',
        'amarilla': 'Tarjeta Amarilla',
        'roja': 'Tarjeta Roja',
        'cambio': 'Registrar Cambio',
        'minutos': 'Ficha de Estadísticas (Portero/Novato)'
    };
    document.getElementById("select-player-title").innerText = titleMap[actionType];
    
    document.getElementById("minutos-input-container").style.display = 'none';
    document.getElementById("cambio-input-container").style.display = actionType === 'cambio' ? 'block' : 'none';
    
    const btnConfirm = document.getElementById("btn-confirm-action");
    if (btnConfirm) {
        btnConfirm.innerText = actionType === 'minutos' ? "Abrir Ficha de Estadísticas" : "Confirmar Acción";
    }
    
    document.getElementById("modal-select-player").classList.add("active");
    
    // Default to local
    document.getElementById("tab-sel-local").click();
}

['gol', 'amarilla', 'roja', 'cambio', 'minutos'].forEach(act => {
    document.getElementById(`btn-action-${act}`)?.addEventListener("click", () => openPlayerSelectionForAction(act, false));
});

// Listener for Fast Result Modal Actions
document.querySelectorAll(".btn-fast-action").forEach(btn => {
    btn.addEventListener("click", (e) => {
        const action = e.currentTarget.getAttribute("data-action");
        openPlayerSelectionForAction(action, true);
    });
});

document.getElementById("btn-close-select-player")?.addEventListener("click", () => {
    document.getElementById("modal-select-player").classList.remove("active");
});

document.querySelectorAll(".team-sel-tab").forEach(tab => {
    tab.addEventListener("click", (e) => {
        document.querySelectorAll(".team-sel-tab").forEach(t => t.classList.remove("active"));
        e.target.classList.add("active");
        
        const isLocal = e.target.id === "tab-sel-local";
        const teamId = isLocal ? currentActionMatch.equipo1Id : currentActionMatch.equipo2Id;
        
        let teamPlayers = appData.jugadores.filter(j => j.equipoId === teamId);
        
        if (currentActionType === 'minutos') {
            teamPlayers = teamPlayers.filter(j => j.isNovato || j.isPortero);
        }
        
        const listContainer = document.getElementById("player-selection-list");
        
        if (teamPlayers.length === 0) {
            listContainer.innerHTML = `<div style="padding:15px;color:var(--text-muted);text-align:center;">No hay jugadores registrados en este equipo.</div>`;
            return;
        }
        
        let html = "";
        teamPlayers.forEach(j => {
            const badgePortero = j.isPortero ? `<span style="background: rgba(16, 185, 129, 0.2); color: #10b981; font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; margin-left: 5px;">Portero</span>` : "";
            const badgeNovato = j.isNovato ? `<span style="background: rgba(59, 130, 246, 0.2); color: #3b82f6; font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; margin-left: 5px;">Novato</span>` : "";
            
            html += `<div class="player-sel-item" data-jug-id="${j.id}" data-team="${isLocal ? 'local' : 'visitante'}" style="display: flex; justify-content: space-between; align-items: center;">
                <div><i class="fa-solid fa-user"></i> ${j.nombre}</div>
                <div>${badgePortero}${badgeNovato}</div>
            </div>`;
        });
        listContainer.innerHTML = html;
        
        listContainer.querySelectorAll(".player-sel-item").forEach(item => {
            item.addEventListener("click", (ev) => {
                listContainer.querySelectorAll(".player-sel-item").forEach(i => i.classList.remove("selected"));
                ev.currentTarget.classList.add("selected");
            });
        });
    });
});

document.getElementById("btn-confirm-action")?.addEventListener("click", () => {
    const selectedItem = document.querySelector(".player-sel-item.selected");
    if (!selectedItem) {
        alert("Debes seleccionar un jugador primero.");
        return;
    }
    
    const jugId = selectedItem.getAttribute("data-jug-id");
    const teamSide = selectedItem.getAttribute("data-team"); // 'local' o 'visitante'
    
    let extraStr = "";
    
    if (currentActionType === 'gol') {
        if (teamSide === 'local') currentActionMatch.goles1++;
        if (teamSide === 'visitante') currentActionMatch.goles2++;
        
        // Update Live Tracker UI
        const scoreLocal = document.getElementById("score-val-local");
        if(scoreLocal) scoreLocal.innerText = currentActionMatch.goles1;
        const scoreVis = document.getElementById("score-val-vis");
        if(scoreVis) scoreVis.innerText = currentActionMatch.goles2;
        
        // Update Fast Result UI
        const fastScoreLocal = document.getElementById("res-rapido-goles-local");
        if(fastScoreLocal) fastScoreLocal.value = currentActionMatch.goles1;
        const fastScoreVis = document.getElementById("res-rapido-goles-vis");
        if(fastScoreVis) fastScoreVis.value = currentActionMatch.goles2;
        
        extraStr = "Gol anotado";
        
        const player = appData.jugadores.find(j => j.id == jugId);
        if (player && player.stats && player.stats[currentTorneo]) {
            player.stats[currentTorneo].goles = (player.stats[currentTorneo].goles || 0) + 1;
        }
    } 
    else if (currentActionType === 'amarilla') {
        extraStr = "Tarjeta Amarilla";
        const player = appData.jugadores.find(j => j.id == jugId);
        if (player && player.stats && player.stats[currentTorneo]) {
            player.stats[currentTorneo].amarillas = (player.stats[currentTorneo].amarillas || 0) + 1;
        }
    }
    else if (currentActionType === 'roja') {
        extraStr = "Tarjeta Roja";
        const player = appData.jugadores.find(j => j.id == jugId);
        if (player && player.stats && player.stats[currentTorneo]) {
            player.stats[currentTorneo].rojas = (player.stats[currentTorneo].rojas || 0) + 1;
        }
    }
    else if (currentActionType === 'cambio') {
        extraStr = "Cambio realizado";
    }
    else if (currentActionType === 'minutos') {
        document.getElementById("btn-close-select-player").click();
        window.openStatsModal(jugId);
        return;
    }
    
    addMatchEvent(currentActionMatch, currentActionType, teamSide, jugId, extraStr);
    
    saveData(); // Save the new global stats to Supabase
    renderDashboardFeed(currentActionMatch);
    saveLiveMatchState(currentActionMatch);
    document.getElementById("btn-close-select-player").click();
});

// ==========================================
// ALINEACIONES Y CONVOCATORIA LOGIC
// ==========================================
let currentConvocatoriaTeam = null;

document.querySelectorAll(".btn-edit-alineacion").forEach(btn => {
    btn.addEventListener("click", (e) => {
        const teamSide = e.target.getAttribute("data-team");
        currentConvocatoriaTeam = teamSide;
        
        const match = appData.partidos.find(p => p.id === currentLiveMatchId);
        const teamId = teamSide === 'local' ? match.equipo1Id : match.equipo2Id;
        const teamPlayers = appData.jugadores.filter(j => j.equipoId === teamId);
        
        const alineacionData = teamSide === 'local' ? match.detalles.alineacionLocal : match.detalles.alineacionVis;
        const selectedIds = [...alineacionData.titulares, ...alineacionData.suplentes];
        
        const listContainer = document.getElementById("convocatoria-list");
        if (teamPlayers.length === 0) {
            listContainer.innerHTML = `<div style="padding:15px;color:var(--text-muted);text-align:center;">No hay jugadores registrados en este equipo.</div>`;
        } else {
            let html = "";
            teamPlayers.forEach(j => {
                const isChecked = selectedIds.includes(j.id) ? "checked" : "";
                const isTitular = alineacionData.titulares.includes(j.id) ? "is-titular" : "";
                html += `
                <div class="conv-item ${isTitular}" data-jug-id="${j.id}">
                    <input type="checkbox" class="chk-convocar" ${isChecked}>
                    <div style="display:flex; flex-direction:column;">
                        <span style="color:white; font-weight:600; font-size:0.9rem;">${j.nombre}</span>
                        <span style="color:var(--text-muted); font-size:0.75rem;">${j.isPortero ? 'Portero' : ''} ${j.isNovato ? 'Novato' : ''}</span>
                    </div>
                    <span class="titular-badge">11 Inicial</span>
                </div>
                `;
            });
            listContainer.innerHTML = html;
        }
        
        document.getElementById("modal-edit-convocatoria").classList.add("active");
    });
});

document.getElementById("btn-close-convocatoria")?.addEventListener("click", () => {
    document.getElementById("modal-edit-convocatoria").classList.remove("active");
});

document.getElementById("btn-save-convocatoria")?.addEventListener("click", () => {
    const match = appData.partidos.find(p => p.id === currentLiveMatchId);
    if (!match) return;
    
    const listContainer = document.getElementById("convocatoria-list");
    const selectedCheckboxes = listContainer.querySelectorAll(".chk-convocar:checked");
    
    let titulares = [];
    let suplentes = [];
    
    selectedCheckboxes.forEach((chk, index) => {
        const itemId = chk.closest(".conv-item").getAttribute("data-jug-id");
        if (index < 11) {
            titulares.push(itemId);
        } else {
            suplentes.push(itemId);
        }
    });
    
    if (currentConvocatoriaTeam === 'local') {
        match.detalles.alineacionLocal.titulares = titulares;
        match.detalles.alineacionLocal.suplentes = suplentes;
    } else {
        match.detalles.alineacionVis.titulares = titulares;
        match.detalles.alineacionVis.suplentes = suplentes;
    }
    
    saveLiveMatchState(match);
    renderAlineaciones(match);
    document.getElementById("btn-close-convocatoria").click();
});

function renderAlineaciones(match) {
    if(!match || !match.detalles) return;
    
    const renderList = (ids, containerId) => {
        const container = document.getElementById(containerId);
        if (!ids || ids.length === 0) {
            container.innerHTML = `<div style="color:var(--text-muted); font-size:0.8rem; font-style:italic;">No definidos</div>`;
            return;
        }
        
        let html = "";
        ids.forEach((id, idx) => {
            const jug = appData.jugadores.find(j => j.id === id);
            if (jug) {
                html += `
                <div class="alineacion-player">
                    <div>
                        <span class="dorsal">${idx + 1}</span>
                        <span style="color:white;">${jug.nombre}</span>
                    </div>
                    <span style="color:var(--text-muted); font-size:0.75rem;">${jug.isPortero ? 'POR' : ''}</span>
                </div>
                `;
            }
        });
        container.innerHTML = html;
    };
    
    renderList(match.detalles.alineacionLocal?.titulares, "alineacion-titulares-local");
    renderList(match.detalles.alineacionLocal?.suplentes, "alineacion-suplentes-local");
    
    renderList(match.detalles.alineacionVis?.titulares, "alineacion-titulares-vis");
    renderList(match.detalles.alineacionVis?.suplentes, "alineacion-suplentes-vis");
}

// Actualizar renderizaciones al abrir el modal
const originalOpenDashboard = openMatchDashboard;
openMatchDashboard = function(matchId) {
    originalOpenDashboard(matchId);
    const match = appData.partidos.find(p => p.id === matchId);
    if(match) renderAlineaciones(match);
};

// ==========================================
// RESULTADO RÁPIDO LOGIC
// ==========================================
let currentFastResultMatchId = null;

    window.openAddMatchManualModal = function(isNewJornada = false) {
        const modal = document.getElementById("modal-agregar-partido-manual");
        if (!modal) return;
        
        const localSel = document.getElementById("partido-manual-local");
        const visSel = document.getElementById("partido-manual-visitante");
        
        let eqOptions = appData.equipos.map(e => `<option value="${e.id}">${e.nombre}</option>`).join('');
        eqOptions += `<option value="vacante">VACANTE (Descansa)</option>`;
        
        localSel.innerHTML = eqOptions;
        visSel.innerHTML = eqOptions;
        
        // Auto-fill next jornada if requested
        if (isNewJornada === true) {
            const matchesInCurrent = appData.partidos.filter(p => p.torneo === currentTorneo && p.calendario_nombre === window.currentCalendarioNombre);
            let maxJ = 0;
            matchesInCurrent.forEach(p => {
                if (p.jornada && !isNaN(p.jornada) && p.jornada > maxJ) maxJ = p.jornada;
            });
            document.getElementById("partido-manual-jornada").value = maxJ + 1;
        }

        document.getElementById("modal-opciones-fecha").classList.remove('active');
        modal.classList.add('active');
    };

    window.openAddJornadaModal = function() {
        window.openAddMatchManualModal(true);
    };

    const formAddMatchManual = document.getElementById("form-agregar-partido-manual");
    if (formAddMatchManual) {
        formAddMatchManual.addEventListener("submit", (e) => {
            e.preventDefault();
            const id1 = document.getElementById("partido-manual-local").value;
            const id2 = document.getElementById("partido-manual-visitante").value;
            const jornada = document.getElementById("partido-manual-jornada").value;
            const fase = document.getElementById("partido-manual-fase").value;
            const fechaStr = document.getElementById("partido-manual-fecha").value;
            const horaStr = document.getElementById("partido-manual-hora").value;

            if (id1 === id2 && id1 !== 'vacante') {
                return alert("No puedes seleccionar el mismo equipo como local y visitante.");
            }

            const newId = Date.now().toString() + Math.floor(Math.random()*1000);
            const p = {
                id: newId,
                torneo: currentTorneo,
                fase: fase,
                jornada: parseInt(jornada),
                grupo: null,
                equipo1Id: id1,
                equipo2Id: id2,
                goles1: null,
                goles2: null,
                calendario_nombre: window.currentCalendarioNombre,
                detalles: {
                    estado: 'pendiente'
                }
            };
            
            if (fechaStr) {
                p.detalles.fechaText = fechaStr;
            }
            if (horaStr) {
                p.detalles.horaText = horaStr;
            }

            appData.partidos.push(p);
            savePartidosToSupabase();
            document.getElementById("modal-agregar-partido-manual").classList.remove('active');
            
            window.currentJornadaTab = `Jornada ${jornada}`;
            updateCalendarioUI();
        });
    }

    const btnClosePartidoManual = document.getElementById("btn-close-partido-manual");
    if (btnClosePartidoManual) {
        btnClosePartidoManual.addEventListener("click", () => {
            document.getElementById("modal-agregar-partido-manual").classList.remove('active');
        });
    }

function openFastResultModal(matchId) {
    currentFastResultMatchId = matchId;
    const match = appData.partidos.find(p => p.id === matchId);
    if (!match) return;

    const local = appData.equipos.find(e => e.id === match.equipo1Id);
    const vis = appData.equipos.find(e => e.id === match.equipo2Id);

    document.getElementById("res-rapido-img-local").src = local ? local.logo : '';
    document.getElementById("res-rapido-name-local").innerText = local ? local.nombre : '';
    document.getElementById("res-rapido-img-vis").src = vis ? vis.logo : '';
    document.getElementById("res-rapido-name-vis").innerText = vis ? vis.nombre : '';

    document.getElementById("res-rapido-goles-local").value = match.goles1 !== null ? match.goles1 : 0;
    document.getElementById("res-rapido-goles-vis").value = match.goles2 !== null ? match.goles2 : 0;

    // Poblar fecha y hora si existen
    document.getElementById("res-rapido-fecha").value = (match.detalles && match.detalles.fecha) ? match.detalles.fecha : '';
    document.getElementById("res-rapido-hora").value = (match.detalles && match.detalles.hora) ? match.detalles.hora : '';

    document.getElementById("modal-resultado-rapido").classList.add("active");
}

document.getElementById("btn-close-resultado-rapido")?.addEventListener("click", () => {
    document.getElementById("modal-resultado-rapido").classList.remove("active");
});

// Logic for Form Inscripcion Dropdown
const inscripcionToggle = document.getElementById('nav-inscripcion-toggle');
if (inscripcionToggle) {
    inscripcionToggle.addEventListener('click', () => {
        const submenu = document.getElementById('nav-inscripcion-submenu');
        const icon = inscripcionToggle.querySelector('.fa-chevron-down');
        if (submenu.style.display === 'none') {
            submenu.style.display = 'flex';
            icon.style.transform = 'rotate(180deg)';
        } else {
            submenu.style.display = 'none';
            icon.style.transform = 'rotate(0deg)';
        }
    });
}

const btnCopiar = document.getElementById('btn-copiar-enlace');
if (btnCopiar) {
    btnCopiar.addEventListener('click', (e) => {
        e.preventDefault();
        let url = window.location.href;
        url = url.substring(0, url.lastIndexOf('/')) + '/inscripcion.html';
        const currentActiveId = localStorage.getItem('femfutpal_active_id');
        if (currentActiveId) {
            url += '?torneo=' + currentActiveId;
        }
        navigator.clipboard.writeText(url).then(() => {
            alert("¡Enlace copiado! Ya puedes pegarlo en WhatsApp.");
        }).catch(() => {
            alert("Error al copiar. Tu enlace es: " + url);
        });
    });
}
function checkBracketAdvancement(match) {
    if (!match.fase || !match.fase.startsWith('eliminatoria')) return;
    if (!match.grupo) return;
    
    const bracketMatches = appData.partidos.filter(p => p.torneo === match.torneo && p.calendario_nombre === match.calendario_nombre && p.fase === match.fase && p.grupo === match.grupo);
    const allFinished = bracketMatches.every(m => m.detalles && m.detalles.estado === 'finalizado');
    if (!allFinished) return;
    
    let globalEq1 = 0;
    let globalEq2 = 0;
    let eq1Id = bracketMatches[0].equipo1Id;
    let eq2Id = bracketMatches[0].equipo2Id;

    bracketMatches.forEach(m => {
        if (m.equipo1Id === eq1Id) {
            globalEq1 += (m.goles1 || 0);
            globalEq2 += (m.goles2 || 0);
        } else {
            globalEq1 += (m.goles2 || 0);
            globalEq2 += (m.goles1 || 0);
        }
    });

    let winnerId = null;
    if (globalEq1 > globalEq2) winnerId = eq1Id;
    else if (globalEq2 > globalEq1) winnerId = eq2Id;
    else winnerId = eq1Id; // Default to eq1 if tie for now

    let nextGrupo = null;
    let isEquipo1InNext = true;

    const grupoMatch = match.grupo.match(/(Llave|Semifinal)\s(\d+)/);
    if (!grupoMatch) return;

    const type = grupoMatch[1];
    const num = parseInt(grupoMatch[2]);

    if (type === 'Llave') {
        const semiNum = Math.ceil(num / 2);
        nextGrupo = `Semifinal ${semiNum}`;
        isEquipo1InNext = (num % 2 !== 0);
    } else if (type === 'Semifinal') {
        nextGrupo = `Final`;
        isEquipo1InNext = (num === 1);
    } else {
        return;
    }

    const isIdaYVuelta = bracketMatches.some(m => m.jornada === 2);
    let nextMatches = appData.partidos.filter(p => p.torneo === match.torneo && p.calendario_nombre === match.calendario_nombre && p.fase === match.fase && p.grupo === nextGrupo);
    
    if (nextMatches.length === 0) {
        let newIda = {
            id: Date.now().toString() + Math.floor(Math.random()*1000),
            torneo: match.torneo,
            calendario_nombre: match.calendario_nombre,
            fase: match.fase,
            jornada: 1,
            equipo1Id: isEquipo1InNext ? winnerId : 'vacante',
            equipo2Id: !isEquipo1InNext ? winnerId : 'vacante',
            goles1: null,
            goles2: null,
            grupo: nextGrupo
        };
        appData.partidos.push(newIda);

        if (isIdaYVuelta) {
            let newVuelta = {
                id: (Date.now() + 1).toString() + Math.floor(Math.random()*1000),
                torneo: match.torneo,
                calendario_nombre: match.calendario_nombre,
                fase: match.fase,
                jornada: 2,
                equipo1Id: !isEquipo1InNext ? winnerId : 'vacante',
                equipo2Id: isEquipo1InNext ? winnerId : 'vacante',
                goles1: null,
                goles2: null,
                grupo: nextGrupo
            };
            appData.partidos.push(newVuelta);
        }
    } else {
        nextMatches.forEach(nm => {
            const isThisIda = nm.jornada === 1;
            const shouldBeLocal = isThisIda ? isEquipo1InNext : !isEquipo1InNext;
            if (shouldBeLocal) {
                nm.equipo1Id = winnerId;
            } else {
                nm.equipo2Id = winnerId;
            }
        });
    }
}

// ============================================
// LOGICA DE EXPORTACION TOP 10 CREATIVA
// ============================================
async function exportTop10Image(tab, players) {
    if (players.length === 0) {
        alert("No hay jugadores suficientes para exportar.");
        return;
    }

    const isAmarilla = tab === 'amarillas';
    const bgColor = isAmarilla ? 'linear-gradient(135deg, #1e293b, #0f172a)' : 'linear-gradient(135deg, #2c1010, #0f172a)';
    const accentColor = isAmarilla ? '#fbbf24' : '#ef4444';
    const titleText = isAmarilla ? 'TOP 10 TARJETAS AMARILLAS' : 'TOP 10 TARJETAS ROJAS';
    
    // Create the container
    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.left = "-9999px";
    container.style.top = "-9999px";
    container.style.width = "800px";
    container.style.background = bgColor;
    container.style.color = "#ffffff";
    container.style.fontFamily = "'Inter', sans-serif";
    container.style.padding = "40px";
    container.style.borderRadius = "20px";
    container.style.boxSizing = "border-box";
    
    // Header
    let html = `
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid ${accentColor}; padding-bottom: 20px;">
            <h1 style="margin: 0; font-size: 36px; text-transform: uppercase; font-weight: 900; letter-spacing: 2px; text-shadow: 0 0 10px ${accentColor};">${titleText}</h1>
            <h3 style="margin: 5px 0 0 0; font-size: 18px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">Torneo ${currentTorneo}</h3>
        </div>
        <div style="display: flex; flex-direction: column; gap: 12px;">
    `;

    // Rows
    players.forEach((pData, index) => {
        const pos = index + 1;
        const alertBadge = isAmarilla && pData.stat >= 4 
            ? `<span style="background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid #fbbf24; font-size: 11px; padding: 2px 6px; border-radius: 4px; margin-left: 10px; font-weight: bold;">RIESGO (${pData.stat})</span>` 
            : "";
            
        html += `
            <div style="display: flex; align-items: center; background: rgba(255, 255, 255, 0.05); border-left: 4px solid ${accentColor}; border-radius: 8px; padding: 12px 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">
                <div style="width: 40px; font-size: 24px; font-weight: 900; color: ${accentColor}; opacity: 0.8;">#${pos}</div>
                <div style="flex: 1; margin-left: 15px;">
                    <div style="font-size: 20px; font-weight: 700; letter-spacing: 0.5px;">${pData.player.name} ${alertBadge}</div>
                    <div style="font-size: 14px; color: #cbd5e1; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px;"><i class="fa-solid fa-shield-halved" style="margin-right: 5px;"></i>${pData.team}</div>
                </div>
                <div style="width: 60px; height: 60px; background: rgba(0,0,0,0.5); border-radius: 12px; display: flex; justify-content: center; align-items: center; border: 2px solid ${accentColor};">
                    <span style="font-size: 32px; font-weight: 900; color: ${accentColor}; line-height: 1; margin-top: 2px;">${pData.stat}</span>
                </div>
            </div>
        `;
    });

    html += `
        </div>
        <div style="margin-top: 30px; text-align: center; font-size: 12px; color: #64748b; font-weight: 600; letter-spacing: 1px; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 20px;">
            SISTEMA DE ESTADÍSTICAS &bull; CREADO AUTOMÁTICAMENTE
        </div>
    `;

    container.innerHTML = html;
    document.body.appendChild(container);

    showLoader("Generando imagen Top 10...");

    try {
        const canvas = await html2canvas(container, {
            scale: 2, // High resolution
            backgroundColor: null,
            logging: false
        });
        
        const link = document.createElement("a");
        link.download = `Top10_${tab}_${currentTorneo}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
    } catch (e) {
        console.error("Error generating image:", e);
        alert("Ocurrió un error al generar la imagen. Asegúrate de tener conexión a internet para descargar las fuentes e iconos.");
    } finally {
        hideLoader();
        document.body.removeChild(container);
    }
}

// ============================================
// MODAL DE REPORTE DE TARJETAS
// ============================================
function openReporteModal(tab, playerObj, currentTotal, onSaveCallback) {
    const isAmarilla = tab === 'amarillas';
    const playerEvents = [];
    
    // Buscar en los partidos del torneo actual
    appData.partidos.forEach(p => {
        if (p.detalles && p.detalles.eventos) {
            p.detalles.eventos.forEach(ev => {
                const tipoTarget = isAmarilla ? 'amarilla' : 'roja';
                if (ev.jugadorId === playerObj.id && ev.tipo === tipoTarget) {
                    const team1 = appData.equipos.find(e => e.id === p.equipo1Id);
                    const team2 = appData.equipos.find(e => e.id === p.equipo2Id);
                    
                    let fechaStr = "N/A";
                    if (p.detalles.fechaProgramada) {
                        fechaStr = p.detalles.fechaProgramada;
                    } else if (p.detalles.tiempoInicio) {
                        const d = new Date(p.detalles.tiempoInicio);
                        const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
                        fechaStr = `${d.getDate()} de ${meses[d.getMonth()]} ${d.getFullYear()}`;
                    }
                    
                    playerEvents.push({
                        fecha: fechaStr,
                        jornada: p.jornada || "N/A",
                        partido: `${team1 ? team1.nombre : 'Local'} vs ${team2 ? team2.nombre : 'Visitante'}`,
                        minuto: ev.minuto
                    });
                }
            });
        }
    });

    // Ya no usamos manualEvents porque ahora se guardan en appData.partidos con fase 'manual'
    // Ordenar por fecha si es posible
    playerEvents.sort((a, b) => {
        const da = new Date(a.fecha);
        const db = new Date(b.fecha);
        if (!isNaN(da) && !isNaN(db)) return db - da; // Descendente
        return 0;
    });

    const modalOverlay = document.createElement('div');
    modalOverlay.style.position = 'fixed';
    modalOverlay.style.top = '0';
    modalOverlay.style.left = '0';
    modalOverlay.style.width = '100vw';
    modalOverlay.style.height = '100vh';
    modalOverlay.style.backgroundColor = 'rgba(0,0,0,0.6)';
    modalOverlay.style.display = 'flex';
    modalOverlay.style.justifyContent = 'center';
    modalOverlay.style.alignItems = 'center';
    modalOverlay.style.zIndex = '10000';
    modalOverlay.style.backdropFilter = 'blur(4px)';

    let eventsHtml = '';
    if (playerEvents.length === 0) {
        eventsHtml = `<div style="text-align:center; color:#94a3b8; padding: 30px 20px; font-style:italic;">No hay registros de partidos en este torneo.<br><br><span style="font-size:12px;">(Las tarjetas actuales provienen del torneo anterior o de edición manual).</span></div>`;
    } else {
        playerEvents.forEach(ev => {
            eventsHtml += `
                <div style="border-bottom: 1px solid #e2e8f0; padding: 12px 0; font-size: 15px; color: #334155; font-family: 'Inter', sans-serif;">
                    <div style="display:flex; justify-content:space-between; margin-bottom: 8px;">
                        <strong style="color:#1e293b;">Fecha:</strong> <span>${ev.fecha}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; margin-bottom: 8px;">
                        <strong style="color:#1e293b;">Jornada:</strong> <span>${ev.jornada}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between;">
                        <strong style="color:#1e293b;">Partido:</strong> <span style="text-align:right;">${ev.partido} ${ev.minuto ? `<br><small style="color:#64748b;">(Min ${ev.minuto})</small>` : ''}</span>
                    </div>
                </div>
            `;
        });
    }

    const titleColor = isAmarilla ? '#10b981' : '#ef4444'; 

    modalOverlay.innerHTML = `
        <div style="background: white; width: 90%; max-width: 500px; border-radius: 8px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); display: flex; flex-direction: column; max-height: 85vh; font-family: 'Inter', sans-serif;">
            <div style="padding: 20px; text-align: center; border-bottom: 1px solid #f1f5f9;">
                <h2 style="margin:0; color: ${titleColor}; font-size: 22px; font-weight: 600;">Reporte ${tab.charAt(0).toUpperCase() + tab.slice(1)}</h2>
                <h3 style="margin:8px 0 0 0; color: #3b82f6; font-size: 16px; font-weight: normal;">${playerObj.name}</h3>
            </div>
            
            <div style="padding: 10px 20px; overflow-y: auto; flex: 1; background: #f8fafc;">
                ${eventsHtml}
            </div>
            
            <div style="padding: 15px 20px; background: white; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <label style="font-size: 14px; font-weight: 600; color: #475569;">Total Manual:</label>
                    <input type="number" id="manual-cards-input" value="${currentTotal}" min="0" style="width: 70px; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; text-align: center; font-size: 16px; font-weight: bold;" />
                </div>
                <div>
                    <button id="btn-close-report" style="padding: 10px 16px; background: #e2e8f0; color: #475569; border: none; border-radius: 6px; cursor: pointer; margin-right: 8px; font-weight: 600;">Cerrar</button>
                    <button id="btn-save-report" style="padding: 10px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">Guardar</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modalOverlay);

    document.getElementById("btn-close-report").onclick = () => {
        document.body.removeChild(modalOverlay);
    };

    document.getElementById("btn-save-report").onclick = () => {
        const newVal = parseInt(document.getElementById("manual-cards-input").value);
        if (!isNaN(newVal)) {
            const addedCards = newVal - currentTotal;
            if (addedCards > 0) {
                for (let i = 0; i < addedCards; i++) {
                    appData.partidos.push({
                        id: Date.now() + "_" + Math.floor(Math.random()*10000) + "_" + i,
                        torneo_id: activeId,
                        torneo: currentTorneo,
                        fase: 'manual',
                        jornada: 'Añadida en Reporte',
                        equipo1Id: playerObj.equipoId,
                        equipo2Id: 'vacante',
                        goles1: null,
                        goles2: null,
                        detalles: {
                            estado: 'manual',
                            fechaProgramada: new Date().toISOString().split('T')[0],
                            eventos: [
                                {
                                    tipo: isAmarilla ? 'amarilla' : 'roja',
                                    jugadorId: playerObj.id,
                                    minuto: null
                                }
                            ]
                        }
                    });
                }
            }
            
            playerObj.stats[currentTorneo][tab] = newVal;
            saveData();
            if (onSaveCallback) onSaveCallback();
        }
        document.body.removeChild(modalOverlay);
    };
}

// ============================================
// MODAL PARA AÑADIR TARJETA DIRECTA / CREAR JUGADOR
// ============================================
function openAddTarjetaModal(tab, onSaveCallback) {
    const isAmarilla = tab === 'amarillas';
    const titleColor = isAmarilla ? '#f59e0b' : '#ef4444';
    
    const modalOverlay = document.createElement('div');
    modalOverlay.style.position = 'fixed';
    modalOverlay.style.top = '0';
    modalOverlay.style.left = '0';
    modalOverlay.style.width = '100vw';
    modalOverlay.style.height = '100vh';
    modalOverlay.style.backgroundColor = 'rgba(0,0,0,0.6)';
    modalOverlay.style.display = 'flex';
    modalOverlay.style.justifyContent = 'center';
    modalOverlay.style.alignItems = 'center';
    modalOverlay.style.zIndex = '10000';
    modalOverlay.style.backdropFilter = 'blur(4px)';

    let equipoOptions = '<option value="">-- Selecciona un Equipo --</option>';
    appData.equipos.forEach(eq => {
        equipoOptions += `<option value="${eq.id}">${eq.nombre}</option>`;
    });

    modalOverlay.innerHTML = `
        <div style="background: white; width: 90%; max-width: 450px; border-radius: 8px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); font-family: 'Inter', sans-serif;">
            <div style="padding: 20px; text-align: center; border-bottom: 1px solid #f1f5f9; background: #f8fafc;">
                <h2 style="margin:0; color: ${titleColor}; font-size: 20px; font-weight: 600;">Añadir Tarjeta ${isAmarilla ? 'Amarilla' : 'Roja'}</h2>
                <p style="margin: 5px 0 0 0; font-size: 13px; color: #64748b;">Selecciona un jugador e ingresa los detalles del evento.</p>
            </div>
            
            <div style="padding: 20px; max-height: 50vh; overflow-y: auto;">
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-size: 14px; font-weight: 600; color: #334155;">1. Equipo</label>
                    <select id="add-card-equipo" style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 15px;">
                        ${equipoOptions}
                    </select>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-size: 14px; font-weight: 600; color: #334155;">2. Nombre del Jugador</label>
                    <input type="text" id="add-card-jugador-name" list="add-card-datalist" placeholder="Escribe o selecciona un nombre..." style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 15px; box-sizing: border-box;" disabled />
                    <datalist id="add-card-datalist"></datalist>
                </div>

                <div style="margin-bottom: 15px; display: flex; gap: 10px;">
                    <div style="flex: 1;">
                        <label style="display: block; margin-bottom: 5px; font-size: 14px; font-weight: 600; color: #334155;">Fecha</label>
                        <input type="date" id="add-card-fecha" value="${new Date().toISOString().split('T')[0]}" style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 15px; box-sizing: border-box;" />
                    </div>
                    <div style="flex: 1;">
                        <label style="display: block; margin-bottom: 5px; font-size: 14px; font-weight: 600; color: #334155;">Jornada <span style="font-weight:normal; color:#94a3b8;">(Opcional)</span></label>
                        <input type="text" id="add-card-jornada" placeholder="Ej. Jornada 5" style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 15px; box-sizing: border-box;" />
                    </div>
                </div>

                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-size: 14px; font-weight: 600; color: #334155;">Contra qué equipo <span style="font-weight:normal; color:#94a3b8;">(Opcional)</span></label>
                    <select id="add-card-rival" style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 15px;">
                        <option value="">-- Selecciona el Rival --</option>
                        ${equipoOptions.replace('<option value="">-- Selecciona un Equipo --</option>', '')}
                    </select>
                </div>

                <div style="margin-bottom: 5px;">
                    <label style="display: block; margin-bottom: 5px; font-size: 14px; font-weight: 600; color: #334155;">Cantidad de Tarjetas a sumar</label>
                    <input type="number" id="add-card-cantidad" value="1" min="1" style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 15px; box-sizing: border-box;" />
                </div>
            </div>
            
            <div style="padding: 15px 20px; background: #f1f5f9; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 10px;">
                <button id="btn-cancel-add-card" style="padding: 10px 16px; background: white; color: #475569; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer; font-weight: 600;">Cancelar</button>
                <button id="btn-save-add-card" style="padding: 10px 16px; background: ${titleColor}; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">Guardar Tarjeta</button>
            </div>
        </div>
    `;

    document.body.appendChild(modalOverlay);

    const selectEquipo = document.getElementById("add-card-equipo");
    const inputName = document.getElementById("add-card-jugador-name");
    const dataList = document.getElementById("add-card-datalist");
    const btnCancel = document.getElementById("btn-cancel-add-card");
    const btnSave = document.getElementById("btn-save-add-card");
    const inputCantidad = document.getElementById("add-card-cantidad");
    const inputFecha = document.getElementById("add-card-fecha");
    const inputJornada = document.getElementById("add-card-jornada");
    const selectRival = document.getElementById("add-card-rival");

    selectEquipo.addEventListener("change", () => {
        const eqId = selectEquipo.value;
        if (!eqId) {
            inputName.disabled = true;
            inputName.value = "";
            dataList.innerHTML = "";
            return;
        }
        
        inputName.disabled = false;
        const jugadoresEquipo = appData.jugadores.filter(j => j.equipoId === eqId && j.status === 'activo');
        dataList.innerHTML = "";
        jugadoresEquipo.forEach(j => {
            const option = document.createElement("option");
            option.value = j.name || j.nombre;
            dataList.appendChild(option);
        });
    });

    btnCancel.onclick = () => document.body.removeChild(modalOverlay);

    btnSave.onclick = () => {
        const eqId = selectEquipo.value;
        const jName = inputName.value.trim();
        const cant = parseInt(inputCantidad.value);

        if (!eqId || !jName || isNaN(cant) || cant <= 0) {
            alert("Por favor completa todos los campos correctamente.");
            return;
        }

        // Buscar si existe (case insensitive)
        let playerObj = appData.jugadores.find(j => j.equipoId === eqId && (j.name || j.nombre).toLowerCase() === jName.toLowerCase());

        if (!playerObj) {
            // Crear nuevo
            playerObj = {
                id: Date.now() + "" + Math.floor(Math.random()*1000),
                equipoId: eqId,
                nombre: jName,
                name: jName,
                isNovato: false,
                isPortero: false,
                status: 'activo',
                transferencias: 0,
                stats: {
                    apertura: { goles: 0, amarillas: 0, rojas: 0, golesRecibidos: 0, minutos: 0 },
                    clausura: { goles: 0, amarillas: 0, rojas: 0, golesRecibidos: 0, minutos: 0 }
                }
            };
            appData.jugadores.push(playerObj);
        }

        const rivalId = selectRival.value;
        const rivalObj = rivalId ? appData.equipos.find(e => e.id === rivalId) : null;
        
        for (let i = 0; i < cant; i++) {
            appData.partidos.push({
                id: Date.now() + "_" + Math.floor(Math.random()*10000) + "_" + i,
                torneo_id: activeId,
                torneo: currentTorneo,
                fase: 'manual', // esto evita que se muestre en el UI de jornadas
                jornada: inputJornada.value.trim() || 'Manual',
                equipo1Id: playerObj.equipoId,
                equipo2Id: rivalObj ? rivalObj.id : 'vacante',
                goles1: null,
                goles2: null,
                detalles: {
                    estado: 'manual', // evita que afecte tabla de posiciones
                    fechaProgramada: inputFecha.value || new Date().toISOString().split('T')[0],
                    eventos: [
                        {
                            tipo: isAmarilla ? 'amarilla' : 'roja',
                            jugadorId: playerObj.id,
                            minuto: null
                        }
                    ]
                }
            });
        }

        playerObj.stats[currentTorneo][tab] = (playerObj.stats[currentTorneo][tab] || 0) + cant;
        
        saveData();
        if (onSaveCallback) {
            onSaveCallback();
        }
        document.body.removeChild(modalOverlay);
    };
}

document.getElementById("btn-save-resultado-rapido")?.addEventListener("click", async () => {
    const match = appData.partidos.find(p => p.id === currentFastResultMatchId);
    if (!match) return;

    const btn = document.getElementById("btn-save-resultado-rapido");
    const originalText = btn.innerText;
    btn.innerText = "Guardando...";
    btn.disabled = true;

    try {
        const g1 = parseInt(document.getElementById("res-rapido-goles-local").value);
        const g2 = parseInt(document.getElementById("res-rapido-goles-vis").value);

        match.goles1 = isNaN(g1) ? 0 : g1;
        match.goles2 = isNaN(g2) ? 0 : g2;

        if (!match.detalles) match.detalles = {};
        match.detalles.estado = 'finalizado';
        
        // Guardar fecha y hora
        const f = document.getElementById("res-rapido-fecha").value;
        const h = document.getElementById("res-rapido-hora").value;
        if (f) match.detalles.fecha = f;
        if (h) match.detalles.hora = h;

        if (match.fase === 'eliminatoria' || match.fase.startsWith('eliminatorias')) {
            checkBracketAdvancement(match);
        }

        await savePartidosToSupabase();
        renderPartidosGenerados(); // Refresh UI
        document.getElementById("modal-resultado-rapido").classList.remove("active");
    } catch (err) {
        console.error("ERROR DETALLADO:", err);
        alert("Error al guardar el resultado: " + (err.message || JSON.stringify(err)));
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
});

// ====== MODAL ESTADISTICAS EXTRA ======
const modalStatsExtra = document.getElementById("modal-editar-stats-extra");
const btnCloseStatsExtra = document.getElementById("btn-close-stats-extra");
const btnSaveStatsExtra = document.getElementById("btn-save-stats-extra");

const inputStatsId = document.getElementById("edit-stats-player-id");
const labelStatsName = document.getElementById("edit-stats-player-name");
const inputStatsMinutos = document.getElementById("edit-stats-minutos");
const inputStatsGoles = document.getElementById("edit-stats-goles");
const inputStatsGolesRecibidos = document.getElementById("edit-stats-goles-recibidos");
const groupGolesRecibidos = document.getElementById("group-stats-goles-recibidos");
const inputStatsAmarillas = document.getElementById("edit-stats-amarillas");
const inputStatsRojas = document.getElementById("edit-stats-rojas");

window.openStatsModal = function(playerId) {
    const player = appData.jugadores.find(p => p.id === playerId);
    if(!player) return;

    inputStatsId.value = player.id;
    labelStatsName.textContent = player.name;

    const stats = player.stats[currentTorneo];
    inputStatsMinutos.value = stats.minutos || 0;
    inputStatsGoles.value = stats.goles || 0;
    inputStatsAmarillas.value = stats.amarillas || 0;
    inputStatsRojas.value = stats.rojas || 0;

    if (player.isPortero) {
        groupGolesRecibidos.style.display = 'block';
        inputStatsGolesRecibidos.value = stats.golesRecibidos || 0;
    } else {
        groupGolesRecibidos.style.display = 'none';
        inputStatsGolesRecibidos.value = 0;
    }

    if(modalStatsExtra) modalStatsExtra.classList.add("active");
};

if (btnCloseStatsExtra) {
    btnCloseStatsExtra.addEventListener("click", () => {
        modalStatsExtra.classList.remove("active");
    });
}

if (btnSaveStatsExtra) {
    btnSaveStatsExtra.addEventListener("click", async () => {
        const playerId = inputStatsId.value;
        const player = appData.jugadores.find(p => p.id === playerId);
        if(!player) return;

        player.stats[currentTorneo].minutos = parseInt(inputStatsMinutos.value) || 0;
        player.stats[currentTorneo].goles = parseInt(inputStatsGoles.value) || 0;
        player.stats[currentTorneo].amarillas = parseInt(inputStatsAmarillas.value) || 0;
        player.stats[currentTorneo].rojas = parseInt(inputStatsRojas.value) || 0;
        
        if(player.isPortero) {
            player.stats[currentTorneo].golesRecibidos = parseInt(inputStatsGolesRecibidos.value) || 0;
        }

        modalStatsExtra.classList.remove("active");
        
        showLoading("Guardando cambios...");
        await saveData();
        hideLoading();
        
        // Refrescar vistas
        showTeamDetail(appData.equipos.find(t => t.id === player.equipoId)); 
    });
}

// ==========================================
// DESCARGA DE IMAGEN PARA REDES SOCIALES
// ==========================================
window.downloadPorterosImage = function() {
    showLoader("Generando imagen de Porteros...");
    
    const titleHeader = document.querySelector('#export-social-container h2');
    if(titleHeader) titleHeader.innerHTML = 'TOP PORTEROS';

    const thead = document.getElementById('export-table-head');
    if(thead) {
        thead.innerHTML = `
            <tr>
                <th>Pos</th>
                <th>Jugador</th>
                <th>Equipo</th>
                <th style="text-align: center;">Goles Rec.</th>
                <th style="text-align: center;">Minutos</th>
                <th style="text-align: center;">Puntos</th>
            </tr>
        `;
    }

    setTimeout(() => {
        const container = document.getElementById('export-social-container');
        const tbody = document.getElementById('export-table-body');
        const ligaName = document.getElementById('export-liga-name');
        const logo = document.getElementById('export-logo');
        
        ligaName.textContent = appData.config.ligaInfo.nombre || 'FEMFUTPAL';
        if (appData.config.ligaInfo.logo) {
            logo.src = appData.config.ligaInfo.logo;
        }
        
        let realPorteros = appData.jugadores.filter(p => p.isPortero);
        let porterosData = realPorteros.map(realPlayer => {
            const teamObj = appData.equipos.find(t => t.id === realPlayer.equipoId);
            const stats = realPlayer.stats[typeof currentTorneo !== 'undefined' ? currentTorneo : 'apertura'] || {};
            return {
                player: realPlayer.name,
                team: teamObj ? teamObj.nombre : 'Sin Equipo',
                goles: stats.golesRecibidos || 0,
                minutos: stats.minutos || 0
            };
        });

        porterosData = porterosData.map(d => {
            let rendimientoNum = 0;
            if (d.minutos > 0) {
                let puntos = d.minutos - (d.goles * 10);
                rendimientoNum = puntos > 0 ? puntos : 0;
            }
            return { ...d, rendimientoNum };
        });

        porterosData.sort((a, b) => {
            if(b.rendimientoNum !== a.rendimientoNum) return b.rendimientoNum - a.rendimientoNum;
            if((a.goles || 0) !== (b.goles || 0)) return (a.goles || 0) - (b.goles || 0);
            return b.minutos - a.minutos;
        });

        const top10 = porterosData.slice(0, 10);
        
        tbody.innerHTML = '';
        top10.forEach((d, idx) => {
            const posClass = idx === 0 ? "pos-gold" : idx === 1 ? "pos-silver" : idx === 2 ? "pos-bronze" : "";
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><div class="export-pos ${posClass}">${idx + 1}</div></td>
                <td style="color:white; font-weight:700;">${d.player}</td>
                <td style="color:#94a3b8;">${d.team}</td>
                <td style="color:#f87171; text-align:center; font-weight:600;">${d.goles > 0 ? d.goles : '-'}</td>
                <td style="color:#60a5fa; text-align:center; font-weight:600;">${d.minutos}</td>
                <td style="color:#10b981; font-weight:700; text-align:center;">${d.rendimientoNum} pts</td>
            `;
            tbody.appendChild(tr);
        });

        container.style.zIndex = '10000';
        container.style.top = '0';
        container.style.left = '0';
        
        html2canvas(container, {
            scale: 2,
            backgroundColor: '#0f172a',
            useCORS: true,
            logging: false
        }).then(canvas => {
            container.style.zIndex = '-100';
            container.style.top = '-9999px';
            container.style.left = '-9999px';
            
            const link = document.createElement('a');
            link.download = `Top_Porteros_${appData.config.ligaInfo.nombre || 'Torneo'}.png`;
            link.href = canvas.toDataURL("image/png");
            link.click();
            
            hideLoader();
        }).catch(err => {
            console.error(err);
            container.style.zIndex = '-100';
            container.style.top = '-9999px';
            container.style.left = '-9999px';
            hideLoader();
            alert("Hubo un error al generar la imagen.");
        });
    }, 500);
};

window.downloadNovatosImage = function() {
    showLoader("Generando imagen de Novatos...");
    
    const titleHeader = document.querySelector('#export-social-container h2');
    if(titleHeader) titleHeader.innerHTML = 'TOP NOVATOS';

    const thead = document.getElementById('export-table-head');
    if(thead) {
        thead.innerHTML = `
            <tr>
                <th>Pos</th>
                <th>Jugador</th>
                <th>Equipo</th>
                <th style="text-align: center;">Goles</th>
                <th style="text-align: center;">Minutos</th>
                <th style="text-align: center;">Amarillas</th>
                <th style="text-align: center;">Puntos</th>
            </tr>
        `;
    }

    setTimeout(() => {
        const container = document.getElementById('export-social-container');
        const tbody = document.getElementById('export-table-body');
        const ligaName = document.getElementById('export-liga-name');
        const logo = document.getElementById('export-logo');
        
        ligaName.textContent = appData.config.ligaInfo.nombre || 'FEMFUTPAL';
        if (appData.config.ligaInfo.logo) {
            logo.src = appData.config.ligaInfo.logo;
        }
        
        let realNovatos = appData.jugadores.filter(p => p.isNovato);
        let novatosData = realNovatos.map(realPlayer => {
            const teamObj = appData.equipos.find(t => t.id === realPlayer.equipoId);
            const stats = realPlayer.stats[typeof currentTorneo !== 'undefined' ? currentTorneo : 'apertura'] || {};
            return {
                player: realPlayer.name,
                team: teamObj ? teamObj.nombre : 'Sin Equipo',
                goles: stats.goles || 0,
                minutos: stats.minutos || 0,
                amarillas: stats.amarillas || 0,
                rojas: stats.rojas || 0
            };
        });

        novatosData = novatosData.map(d => {
            let rendimientoNum = 0;
            if (d.minutos > 0) {
                let puntos = (d.goles * 50) + (d.minutos * 0.5) - (d.amarillas * 15) - (d.rojas * 30);
                rendimientoNum = puntos > 0 ? puntos : 0;
            }
            return { ...d, rendimientoNum };
        });

        novatosData.sort((a, b) => {
            if(b.rendimientoNum !== a.rendimientoNum) return b.rendimientoNum - a.rendimientoNum;
            if((b.goles || 0) !== (a.goles || 0)) return (b.goles || 0) - (a.goles || 0);
            return a.minutos - b.minutos;
        });

        const top10 = novatosData.slice(0, 10);
        
        tbody.innerHTML = '';
        top10.forEach((d, idx) => {
            const posClass = idx === 0 ? "pos-gold" : idx === 1 ? "pos-silver" : idx === 2 ? "pos-bronze" : "";
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><div class="export-pos ${posClass}">${idx + 1}</div></td>
                <td style="color:white; font-weight:700;">${d.player}</td>
                <td style="color:#94a3b8;">${d.team}</td>
                <td style="color:#38bdf8; text-align:center; font-weight:600;">${d.goles > 0 ? d.goles : '-'}</td>
                <td style="color:#60a5fa; text-align:center; font-weight:600;">${d.minutos}</td>
                <td style="color:#fbbf24; text-align:center; font-weight:600;">${d.amarillas > 0 ? d.amarillas : '-'}</td>
                <td style="color:#10b981; font-weight:700; text-align:center;">${Number.isInteger(d.rendimientoNum) ? d.rendimientoNum : d.rendimientoNum.toFixed(1)} pts</td>
            `;
            tbody.appendChild(tr);
        });

        container.style.zIndex = '10000';
        container.style.top = '0';
        container.style.left = '0';
        
        html2canvas(container, {
            scale: 2,
            backgroundColor: '#0f172a',
            useCORS: true,
            logging: false
        }).then(canvas => {
            container.style.zIndex = '-100';
            container.style.top = '-9999px';
            container.style.left = '-9999px';
            
            const link = document.createElement('a');
            link.download = `Top_Novatos_${appData.config.ligaInfo.nombre || 'Torneo'}.png`;
            link.href = canvas.toDataURL("image/png");
            link.click();
            
            hideLoader();
        }).catch(err => {
            console.error(err);
            container.style.zIndex = '-100';
            container.style.top = '-9999px';
            container.style.left = '-9999px';
            hideLoader();
            alert("Hubo un error al generar la imagen.");
        });
    }, 500);
};

setTimeout(() => {
    if (!localStorage.getItem('cards_injected_batch4')) {
        console.log("Inyectando tarjetas (batch 4)...");
        const dataToInsert = [
            { nombre: "Walter Ivan García Olivas", amarillas: 4, equipo: "Pumas FC" },
            { nombre: "Bismar Antonio Matute Cruz", amarillas: 4, equipo: "FC Valle Del Atlético" },
            { nombre: "Geovanny Ali Valle Joya", amarillas: 4, equipo: "FC Valle Del Atlético" },
            { nombre: "Jahudiel Ernesto Olivas Lira", amarillas: 3, equipo: "Atlético Las Llantas" },
            { nombre: "Héctor Javier Centeno Calero", amarillas: 3, equipo: "Pumas FC" },
            { nombre: "Erick Samuel Garay Martinez", amarillas: 3, equipo: "Shalque 04" },
            { nombre: "Douglas Uriel Matute Reyes", amarillas: 3, equipo: "FC Valle Del Atlético" },
            { nombre: "Erick Nahum Gomez Dávila", amarillas: 3, equipo: "FC Los Halcones" },
            { nombre: "Andy Jassiel Acuña Avila", amarillas: 3, equipo: "FC Rosales" },
            { nombre: "Ervin Uriel Zeledon Carballo", amarillas: 3, equipo: "FC Valle Del Atlético" },
            { nombre: "Wilmer Alexander Rosales Olivas", amarillas: 3, equipo: "FC Rosales" },
            { nombre: "Anibal Alejandro Rivera Acuña", amarillas: 3, equipo: "Shalque 04" },
            { nombre: "Erick Alberto López Pérez", amarillas: 3, equipo: "FC La Unión" },
            { nombre: "Walter Antonio López Flores", amarillas: 3, equipo: "Shalque 04" }
        ];
        
        const removeAccents = (str) => {
            return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
        };

        let added = false;
        let notFound = [];
        dataToInsert.forEach(item => {
            const searchName = removeAccents(item.nombre);
            let jugador = appData.jugadores.find(j => {
                const jName = removeAccents(j.name || j.nombre || "");
                return jName === searchName;
            });
            
            if (!jugador) {
                // Crear jugador en INACTIVOS (Agente Libre)
                jugador = {
                    id: Date.now() + "" + Math.floor(Math.random()*1000),
                    equipoId: 'libre',
                    nombre: item.nombre,
                    name: item.nombre,
                    isNovato: false,
                    isPortero: false,
                    status: 'baja', // Inactivo
                    transferencias: 0,
                    stats: {
                        apertura: { goles: 0, amarillas: 0, rojas: 0, golesRecibidos: 0, minutos: 0 },
                        clausura: { goles: 0, amarillas: 0, rojas: 0, golesRecibidos: 0, minutos: 0 }
                    }
                };
                appData.jugadores.push(jugador);
                // No necesitamos meterlo a un equipo específico porque va directo a inactivos.
            }

            if (jugador) {
                jugador.stats.clausura.amarillas = item.amarillas; // Fija el valor para evitar sumar doble
                
                // Buscar si ya tiene eventos manuales de esta importacion
                const prevEvents = appData.partidos.filter(p => p.detalles && p.detalles.estado === 'manual' && p.jornada === 'Importación Masiva (4 Oct)' && p.detalles.eventos && p.detalles.eventos[0].jugadorId === jugador.id);
                
                const cardsToAdd = item.amarillas - prevEvents.length;
                
                for (let i=0; i<cardsToAdd; i++) {
                    appData.partidos.push({
                        id: Date.now() + "_" + Math.floor(Math.random()*100000) + "_" + jugador.id + "_" + i,
                        torneo_id: window.activeId || "da2f17be-512c-497f-94d3-1c0caab92a88",
                        torneo: 'clausura',
                        fase: 'manual',
                        jornada: 'Importación Masiva (4 Oct)',
                        equipo1Id: jugador.equipoId !== 'libre' ? jugador.equipoId : 'vacante',
                        equipo2Id: 'vacante',
                        goles1: null,
                        goles2: null,
                        detalles: {
                            estado: 'manual',
                            fechaProgramada: new Date().toISOString().split('T')[0],
                            eventos: [{ tipo: 'amarilla', jugadorId: jugador.id, minuto: null }]
                        }
                    });
                }
                added = true;
            }
        });

        if (added) {
            saveData();
            if (typeof renderStats === 'function') {
                const activeTab = document.querySelector('.tab-btn.active')?.dataset?.tab;
                if (activeTab === 'amarillas') renderStats('amarillas');
            }
            if (typeof renderInactivos === 'function' && document.getElementById("view-inactivos").classList.contains("active")) {
                renderInactivos();
            }
            console.log("Tarjetas importadas. Creados como inactivos los que no existían.");
        }
        localStorage.setItem('cards_injected_batch4', 'true');
    }

    if (!localStorage.getItem('cards_injected_batch5')) {
        console.log("Forzando inyección de tarjetas (batch 5)...");
        const dataToInsert = [
            { nombre: "Walter Ivan García Olivas", amarillas: 4, equipo: "Pumas FC" },
            { nombre: "Bismar Antonio Matute Cruz", amarillas: 4, equipo: "FC Valle Del Atlético" },
            { nombre: "Geovanny Ali Valle Joya", amarillas: 4, equipo: "FC Valle Del Atlético" },
            { nombre: "Jahudiel Ernesto Olivas Lira", amarillas: 3, equipo: "Atlético Las Llantas" },
            { nombre: "Héctor Javier Centeno Calero", amarillas: 3, equipo: "Pumas FC" },
            { nombre: "Erick Samuel Garay Martinez", amarillas: 3, equipo: "Shalque 04" },
            { nombre: "Douglas Uriel Matute Reyes", amarillas: 3, equipo: "FC Valle Del Atlético" },
            { nombre: "Erick Nahum Gomez Dávila", amarillas: 3, equipo: "FC Los Halcones" },
            { nombre: "Andy Jassiel Acuña Avila", amarillas: 3, equipo: "FC Rosales" },
            { nombre: "Ervin Uriel Zeledon Carballo", amarillas: 3, equipo: "FC Valle Del Atlético" },
            { nombre: "Wilmer Alexander Rosales Olivas", amarillas: 3, equipo: "FC Rosales" },
            { nombre: "Anibal Alejandro Rivera Acuña", amarillas: 3, equipo: "Shalque 04" },
            { nombre: "Erick Alberto López Pérez", amarillas: 3, equipo: "FC La Unión" },
            { nombre: "Walter Antonio López Flores", amarillas: 3, equipo: "Shalque 04" }
        ];

        const removeAccents = (str) => {
            return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
        };

        let added = false;
        dataToInsert.forEach(item => {
            const searchName = removeAccents(item.nombre);
            let jugador = appData.jugadores.find(j => {
                const jName = removeAccents(j.name || j.nombre || "");
                return jName === searchName;
            });
            
            if (!jugador) {
                jugador = {
                    id: Date.now() + "" + Math.floor(Math.random()*1000),
                    equipoId: 'libre',
                    nombre: item.nombre,
                    name: item.nombre,
                    isNovato: false,
                    isPortero: false,
                    status: 'baja',
                    transferencias: 0,
                    stats: {
                        apertura: { goles: 0, amarillas: 0, rojas: 0, golesRecibidos: 0, minutos: 0 },
                        clausura: { goles: 0, amarillas: 0, rojas: 0, golesRecibidos: 0, minutos: 0 }
                    }
                };
                appData.jugadores.push(jugador);
            }

            if (jugador) {
                if (!jugador.stats) {
                    jugador.stats = { apertura: {}, clausura: {} };
                }
                if (!jugador.stats.clausura) {
                    jugador.stats.clausura = {};
                }
                
                // Forzar el valor en Clausura
                jugador.stats.clausura.amarillas = item.amarillas;
                added = true;
            }
        });

        if (added) {
            saveData();
            if (typeof renderStats === 'function') {
                const activeTab = document.querySelector('.tab-btn.active')?.dataset?.tab;
                if (activeTab === 'amarillas') renderStats('amarillas');
            }
            if (typeof renderInactivos === 'function' && document.getElementById("view-inactivos").classList.contains("active")) {
                renderInactivos();
            }
            
            const playersWithCards = appData.jugadores.filter(j => j.stats?.clausura?.amarillas > 0);
            console.log("Jugadores con amarillas en Clausura:", playersWithCards.map(j => j.nombre + ' ' + j.stats.clausura.amarillas));
            
            alert(`¡Re-sincronización completada! Se encontraron ${playersWithCards.length} jugadores con tarjetas en memoria. Por favor verifica Clausura.`);
        }
        localStorage.setItem('cards_injected_batch5', 'true');
    }

    if (!localStorage.getItem('cards_injected_batch7')) {
        console.log("Forzando inyección definitiva (batch 7)...");
        const dataToInsert = [
            { nombre: "Walter Ivan García Olivas", amarillas: 4, equipo: "Pumas FC" },
            { nombre: "Bismar Antonio Matute Cruz", amarillas: 4, equipo: "FC Valle Del Atlético" },
            { nombre: "Geovanny Ali Valle Joya", amarillas: 4, equipo: "FC Valle Del Atlético" },
            { nombre: "Jahudiel Ernesto Olivas Lira", amarillas: 3, equipo: "Atlético Las Llantas" },
            { nombre: "Héctor Javier Centeno Calero", amarillas: 3, equipo: "Pumas FC" },
            { nombre: "Erick Samuel Garay Martinez", amarillas: 3, equipo: "Shalque 04" },
            { nombre: "Douglas Uriel Matute Reyes", amarillas: 3, equipo: "FC Valle Del Atlético" },
            { nombre: "Erick Nahum Gomez Dávila", amarillas: 3, equipo: "FC Los Halcones" },
            { nombre: "Andy Jassiel Acuña Avila", amarillas: 3, equipo: "FC Rosales" },
            { nombre: "Ervin Uriel Zeledon Carballo", amarillas: 3, equipo: "FC Valle Del Atlético" },
            { nombre: "Wilmer Alexander Rosales Olivas", amarillas: 3, equipo: "FC Rosales" },
            { nombre: "Anibal Alejandro Rivera Acuña", amarillas: 3, equipo: "Shalque 04" },
            { nombre: "Erick Alberto López Pérez", amarillas: 3, equipo: "FC La Unión" },
            { nombre: "Walter Antonio López Flores", amarillas: 3, equipo: "Shalque 04" }
        ];

        const removeAccents = (str) => {
            return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
        };

        let added = false;
        dataToInsert.forEach((item, idx) => {
            const searchName = removeAccents(item.nombre);
            let jugador = appData.jugadores.find(j => {
                const jName = removeAccents(j.name || j.nombre || "");
                return jName === searchName;
            });
            
            if (!jugador) {
                jugador = {
                    id: Date.now() + "_" + idx,
                    equipoId: 'libre',
                    nombre: item.nombre,
                    name: item.nombre,
                    isNovato: false,
                    isPortero: false,
                    status: 'baja',
                    transferencias: 0,
                    stats: {
                        apertura: { goles: 0, amarillas: 0, rojas: 0, golesRecibidos: 0, minutos: 0 },
                        clausura: { goles: 0, amarillas: 0, rojas: 0, golesRecibidos: 0, minutos: 0 }
                    }
                };
                appData.jugadores.push(jugador);
            }

            if (jugador) {
                if (!jugador.stats) {
                    jugador.stats = { apertura: {goles:0, amarillas:0, rojas:0, golesRecibidos:0, minutos:0}, clausura: {goles:0, amarillas:0, rojas:0, golesRecibidos:0, minutos:0} };
                }
                if (!jugador.stats.clausura) {
                    jugador.stats.clausura = {goles:0, amarillas:0, rojas:0, golesRecibidos:0, minutos:0};
                }
                
                jugador.stats.clausura.amarillas = item.amarillas;
                added = true;
            }
        });

        if (added) {
            saveData();
            if (typeof renderStats === 'function') {
                const activeTab = document.querySelector('.tab-btn.active')?.dataset?.tab;
                if (activeTab === 'amarillas') {
                    // Forzar trigger de click para garantizar que lea currentTorneo correctamente
                    document.querySelector('[data-torneo="clausura"]')?.click();
                    setTimeout(() => renderStats('amarillas'), 100);
                }
            }
            if (typeof renderInactivos === 'function' && document.getElementById("view-inactivos").classList.contains("active")) {
                renderInactivos();
            }
            const playersWithCards = appData.jugadores.filter(j => j.stats?.clausura?.amarillas > 0);
            console.log("¡Batch 7 finalizado! Jugadores con amarillas:", playersWithCards.map(j => j.nombre + ':' + j.stats.clausura.amarillas));
        }
        localStorage.setItem('cards_injected_batch7', 'true');
    }

    if (!localStorage.getItem('cards_injected_batch8')) {
        console.log("Forzando inyección (batch 8)...");
        const dataToInsert = [
            { nombre: "Walter Ivan García Olivas", amarillas: 4, equipo: "Pumas FC" },
            { nombre: "Bismar Antonio Matute Cruz", amarillas: 4, equipo: "FC Valle Del Atlético" },
            { nombre: "Geovanny Ali Valle Joya", amarillas: 4, equipo: "FC Valle Del Atlético" },
            { nombre: "Jahudiel Ernesto Olivas Lira", amarillas: 3, equipo: "Atlético Las Llantas" },
            { nombre: "Héctor Javier Centeno Calero", amarillas: 3, equipo: "Pumas FC" },
            { nombre: "Erick Samuel Garay Martinez", amarillas: 3, equipo: "Shalque 04" },
            { nombre: "Douglas Uriel Matute Reyes", amarillas: 3, equipo: "FC Valle Del Atlético" },
            { nombre: "Erick Nahum Gomez Dávila", amarillas: 3, equipo: "FC Los Halcones" },
            { nombre: "Andy Jassiel Acuña Avila", amarillas: 3, equipo: "FC Rosales" },
            { nombre: "Ervin Uriel Zeledon Carballo", amarillas: 3, equipo: "FC Valle Del Atlético" },
            { nombre: "Wilmer Alexander Rosales Olivas", amarillas: 3, equipo: "FC Rosales" },
            { nombre: "Anibal Alejandro Rivera Acuña", amarillas: 3, equipo: "Shalque 04" },
            { nombre: "Erick Alberto López Pérez", amarillas: 3, equipo: "FC La Unión" },
            { nombre: "Walter Antonio López Flores", amarillas: 3, equipo: "Shalque 04" },
            { nombre: "Abiel Jair Olivas Gradiz", amarillas: 2, equipo: "Atlético Las Llantas" },
            { nombre: "Héctor Enoc Olivas Blandon", amarillas: 2, equipo: "FC Valle Del Atlético" },
            { nombre: "Joni Antonio Gonzales H", amarillas: 2, equipo: "Diablos Rojos" },
            { nombre: "Eliuth José García Espinoza", amarillas: 2, equipo: "FC Calera" },
            { nombre: "Edgardo Josué Pastrana Vallecillo", amarillas: 2, equipo: "FC La Unión" },
            { nombre: "José Alexander Ávila Rosales", amarillas: 2, equipo: "FC Rosales" },
            { nombre: "Yerald Alcides Gomez Vallecillo", amarillas: 2, equipo: "La Sele-Saguasca" },
            { nombre: "Wilmer Noe Rivera Córdoba", amarillas: 2, equipo: "Diablos Rojos" },
            { nombre: "José Daniel Centeno Bustamante", amarillas: 2, equipo: "FC Los Arados" },
            { nombre: "Jaime Ramón Calero Rivas", amarillas: 2, equipo: "FC Calera" },
            { nombre: "Howard Jair Pineda Acuña", amarillas: 2, equipo: "Shalque 04" },
            { nombre: "Raul Antonio Córdoba Castillo", amarillas: 2, equipo: "FC Musuli" },
            { nombre: "Cerling Antonio Balladares Tercero", amarillas: 2, equipo: "Fénix FC" },
            { nombre: "Lester Saúl Córdoba Calderon", amarillas: 2, equipo: "Fénix FC" },
            { nombre: "Freddy Javier Joya López", amarillas: 2, equipo: "FC El Barrio" },
            { nombre: "Javier Saúl Pastrana Villareyna", amarillas: 2, equipo: "Diablos Rojos" }
        ];

        const removeAccents = (str) => {
            return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
        };

        let added = false;
        dataToInsert.forEach((item, idx) => {
            const searchName = removeAccents(item.nombre);
            let jugador = appData.jugadores.find(j => {
                const jName = removeAccents(j.name || j.nombre || "");
                return jName === searchName;
            });
            
            if (!jugador) {
                jugador = {
                    id: Date.now() + "_b8_" + idx,
                    equipoId: 'libre',
                    nombre: item.nombre,
                    name: item.nombre,
                    isNovato: false,
                    isPortero: false,
                    status: 'baja',
                    transferencias: 0,
                    stats: {
                        apertura: { goles: 0, amarillas: 0, rojas: 0, golesRecibidos: 0, minutos: 0 },
                        clausura: { goles: 0, amarillas: 0, rojas: 0, golesRecibidos: 0, minutos: 0 }
                    }
                };
                appData.jugadores.push(jugador);
            }

            if (jugador) {
                if (!jugador.stats) {
                    jugador.stats = { apertura: {goles:0, amarillas:0, rojas:0, golesRecibidos:0, minutos:0}, clausura: {goles:0, amarillas:0, rojas:0, golesRecibidos:0, minutos:0} };
                }
                if (!jugador.stats.clausura) {
                    jugador.stats.clausura = {goles:0, amarillas:0, rojas:0, golesRecibidos:0, minutos:0};
                }
                
                jugador.stats.clausura.amarillas = item.amarillas;
                added = true;
            }
        });

        if (added) {
            saveData();
            if (typeof renderStats === 'function') {
                const activeTab = document.querySelector('.tab-btn.active')?.dataset?.tab;
                if (activeTab === 'amarillas') {
                    document.querySelector('[data-torneo="clausura"]')?.click();
                    setTimeout(() => renderStats('amarillas'), 100);
                }
            }
            if (typeof renderInactivos === 'function' && document.getElementById("view-inactivos").classList.contains("active")) {
                renderInactivos();
            }
            alert("¡Tarjetas importadas con éxito! Los faltantes fueron puestos como Inactivos.");
        }
        localStorage.setItem('cards_injected_batch8', 'true');
    }

    if (!localStorage.getItem('cards_injected_batch9')) {
        console.log("Forzando inyección definitiva con IDs numéricos (batch 9)...");
        const dataToInsert = [
            { nombre: "Walter Ivan García Olivas", amarillas: 4, equipo: "Pumas FC" },
            { nombre: "Bismar Antonio Matute Cruz", amarillas: 4, equipo: "FC Valle Del Atlético" },
            { nombre: "Geovanny Ali Valle Joya", amarillas: 4, equipo: "FC Valle Del Atlético" },
            { nombre: "Jahudiel Ernesto Olivas Lira", amarillas: 3, equipo: "Atlético Las Llantas" },
            { nombre: "Héctor Javier Centeno Calero", amarillas: 3, equipo: "Pumas FC" },
            { nombre: "Erick Samuel Garay Martinez", amarillas: 3, equipo: "Shalque 04" },
            { nombre: "Douglas Uriel Matute Reyes", amarillas: 3, equipo: "FC Valle Del Atlético" },
            { nombre: "Erick Nahum Gomez Dávila", amarillas: 3, equipo: "FC Los Halcones" },
            { nombre: "Andy Jassiel Acuña Avila", amarillas: 3, equipo: "FC Rosales" },
            { nombre: "Ervin Uriel Zeledon Carballo", amarillas: 3, equipo: "FC Valle Del Atlético" },
            { nombre: "Wilmer Alexander Rosales Olivas", amarillas: 3, equipo: "FC Rosales" },
            { nombre: "Anibal Alejandro Rivera Acuña", amarillas: 3, equipo: "Shalque 04" },
            { nombre: "Erick Alberto López Pérez", amarillas: 3, equipo: "FC La Unión" },
            { nombre: "Walter Antonio López Flores", amarillas: 3, equipo: "Shalque 04" },
            { nombre: "Abiel Jair Olivas Gradiz", amarillas: 2, equipo: "Atlético Las Llantas" },
            { nombre: "Héctor Enoc Olivas Blandon", amarillas: 2, equipo: "FC Valle Del Atlético" },
            { nombre: "Joni Antonio Gonzales H", amarillas: 2, equipo: "Diablos Rojos" },
            { nombre: "Eliuth José García Espinoza", amarillas: 2, equipo: "FC Calera" },
            { nombre: "Edgardo Josué Pastrana Vallecillo", amarillas: 2, equipo: "FC La Unión" },
            { nombre: "José Alexander Ávila Rosales", amarillas: 2, equipo: "FC Rosales" },
            { nombre: "Yerald Alcides Gomez Vallecillo", amarillas: 2, equipo: "La Sele-Saguasca" },
            { nombre: "Wilmer Noe Rivera Córdoba", amarillas: 2, equipo: "Diablos Rojos" },
            { nombre: "José Daniel Centeno Bustamante", amarillas: 2, equipo: "FC Los Arados" },
            { nombre: "Jaime Ramón Calero Rivas", amarillas: 2, equipo: "FC Calera" },
            { nombre: "Howard Jair Pineda Acuña", amarillas: 2, equipo: "Shalque 04" },
            { nombre: "Raul Antonio Córdoba Castillo", amarillas: 2, equipo: "FC Musuli" },
            { nombre: "Cerling Antonio Balladares Tercero", amarillas: 2, equipo: "Fénix FC" },
            { nombre: "Lester Saúl Córdoba Calderon", amarillas: 2, equipo: "Fénix FC" },
            { nombre: "Freddy Javier Joya López", amarillas: 2, equipo: "FC El Barrio" },
            { nombre: "Javier Saúl Pastrana Villareyna", amarillas: 2, equipo: "Diablos Rojos" }
        ];

        const removeAccents = (str) => {
            return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
        };

        // Limpiar jugadores con IDs inválidos (Strings) que bloquean la subida
        appData.jugadores = appData.jugadores.filter(j => typeof j.id === 'number' || (typeof j.id === 'string' && !j.id.includes('_')));

        let added = false;
        dataToInsert.forEach((item, idx) => {
            const searchName = removeAccents(item.nombre);
            let jugador = appData.jugadores.find(j => {
                const jName = removeAccents(j.name || j.nombre || "");
                return jName === searchName;
            });
            
            if (!jugador) {
                // ¡ID Numérico indispensable! Si no Supabase da error 400
                jugador = {
                    id: Date.now() + (idx * 100), 
                    equipoId: 'libre',
                    nombre: item.nombre,
                    name: item.nombre,
                    isNovato: false,
                    isPortero: false,
                    status: 'baja',
                    transferencias: 0,
                    stats: {
                        apertura: { goles: 0, amarillas: 0, rojas: 0, golesRecibidos: 0, minutos: 0 },
                        clausura: { goles: 0, amarillas: 0, rojas: 0, golesRecibidos: 0, minutos: 0 }
                    }
                };
                appData.jugadores.push(jugador);
            }

            if (jugador) {
                if (!jugador.stats) {
                    jugador.stats = { apertura: {goles:0, amarillas:0, rojas:0, golesRecibidos:0, minutos:0}, clausura: {goles:0, amarillas:0, rojas:0, golesRecibidos:0, minutos:0} };
                }
                if (!jugador.stats.clausura) {
                    jugador.stats.clausura = {goles:0, amarillas:0, rojas:0, golesRecibidos:0, minutos:0};
                }
                
                jugador.stats.clausura.amarillas = item.amarillas;
                added = true;
            }
        });

        if (added) {
            saveData();
            if (typeof renderStats === 'function') {
                const activeTab = document.querySelector('.tab-btn.active')?.dataset?.tab;
                if (activeTab === 'amarillas') {
                    document.querySelector('[data-torneo="clausura"]')?.click();
                    setTimeout(() => renderStats('amarillas'), 100);
                }
            }
            if (typeof renderInactivos === 'function' && document.getElementById("view-inactivos").classList.contains("active")) {
                renderInactivos();
            }
            alert("¡Importación definitiva 100% completada! Puedes verificar la tabla Clausura.");
        }
        localStorage.setItem('cards_injected_batch9', 'true');
    }

}, 3000);

// Lógica para el buscador de estadísticas
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('stats-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            const searchTerm = e.target.value.toLowerCase().trim();
            const tableRows = document.querySelectorAll('.data-table tbody tr');
            
            tableRows.forEach(row => {
                // Si la fila es el mensaje de "No hay datos", no la ocultamos
                if (row.cells.length === 1 && row.cells[0].colSpan === 4) return;
                
                const text = row.textContent.toLowerCase();
                if (text.includes(searchTerm)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        });
    }
});


// INYECCIÓN DE CALENDARIO CLAUSURA
setTimeout(async () => {
    if (!localStorage.getItem('calendario_clausura_injected_final_2')) {
        const removeAccents = (str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
        const matchesData = [
  {
    "jornada": 1,
    "eq1": "1 PUMAS FC",
    "eq2": "FC VALLE DEL ATLÉTICO"
  },
  {
    "jornada": 1,
    "eq1": "2 SHALQUE 04",
    "eq2": "FC LA CONCHA"
  },
  {
    "jornada": 1,
    "eq1": "3 FC CALERA",
    "eq2": "ATLÉTICO LAS LLANTAS"
  },
  {
    "jornada": 1,
    "eq1": "4 FK BODØ/GLIMT",
    "eq2": "LA SELE-SAGUASCA"
  },
  {
    "jornada": 1,
    "eq1": "5 FC ROSALES",
    "eq2": "EL BARRIO"
  },
  {
    "jornada": 1,
    "eq1": "6 FC MUSULI",
    "eq2": "FC LA UNIÓN"
  },
  {
    "jornada": 1,
    "eq1": "7 PC GALAXY",
    "eq2": "FC ACADEMIA"
  },
  {
    "jornada": 1,
    "eq1": "8 FC LA ISLA",
    "eq2": "FC FENIX"
  },
  {
    "jornada": 1,
    "eq1": "LOS ALCONES FC",
    "eq2": "vacante"
  },
  {
    "jornada": 2,
    "eq1": "1 SHALQUE 04",
    "eq2": "ATLÉTICO LAS LLANTAS"
  },
  {
    "jornada": 2,
    "eq1": "2 FC FENIX",
    "eq2": "EL BARRIO"
  },
  {
    "jornada": 2,
    "eq1": "3 FC ROSALES",
    "eq2": "FC VALLE DEL ATLÉTICO"
  },
  {
    "jornada": 2,
    "eq1": "4 FC CALERA",
    "eq2": "LOS ALCONES FC"
  },
  {
    "jornada": 2,
    "eq1": "5 FK BODØ/GLIMT",
    "eq2": "FC LA CONCHA"
  },
  {
    "jornada": 2,
    "eq1": "6 FC LA ISLA",
    "eq2": "LA SELE-SAGUASCA"
  },
  {
    "jornada": 2,
    "eq1": "7 PUMAS FC",
    "eq2": "FC ACADEMIA"
  },
  {
    "jornada": 2,
    "eq1": "8 PC GALAXY",
    "eq2": "FC LA UNIÓN"
  },
  {
    "jornada": 2,
    "eq1": "FC MUSULI",
    "eq2": "vacante"
  },
  {
    "jornada": 3,
    "eq1": "1 FC LA ISLA",
    "eq2": "FC LA CONCHA"
  },
  {
    "jornada": 3,
    "eq1": "2 FC ROSALES",
    "eq2": "FC ACADEMIA"
  },
  {
    "jornada": 3,
    "eq1": "3 SHALQUE 04",
    "eq2": "LOS ALCONES FC"
  },
  {
    "jornada": 3,
    "eq1": "4 FC FENIX",
    "eq2": "FC VALLE DEL ATLÉTICO"
  },
  {
    "jornada": 3,
    "eq1": "5 PUMAS FC",
    "eq2": "FC LA UNIÓN"
  },
  {
    "jornada": 3,
    "eq1": "6 FK BODØ/GLIMT",
    "eq2": "ATLÉTICO LAS LLANTAS"
  },
  {
    "jornada": 3,
    "eq1": "7 EL BARRIO",
    "eq2": "LA SELE-SAGUASCA"
  },
  {
    "jornada": 3,
    "eq1": "8 PC GALAXY",
    "eq2": "FC MUSULI"
  },
  {
    "jornada": 3,
    "eq1": "FC CALERA",
    "eq2": "vacante"
  },
  {
    "jornada": 4,
    "eq1": "1 FK BODØ/GLIMT",
    "eq2": "LOS ALCONES FC"
  },
  {
    "jornada": 4,
    "eq1": "2 PUMAS FC",
    "eq2": "FC MUSULI"
  },
  {
    "jornada": 4,
    "eq1": "3 EL BARRIO",
    "eq2": "FC LA CONCHA"
  },
  {
    "jornada": 4,
    "eq1": "4 FC LA ISLA",
    "eq2": "ATLÉTICO LAS LLANTAS"
  },
  {
    "jornada": 4,
    "eq1": "5 SHALQUE 04",
    "eq2": "FC CALERA"
  },
  {
    "jornada": 4,
    "eq1": "6 FC FENIX",
    "eq2": "FC ACADEMIA"
  },
  {
    "jornada": 4,
    "eq1": "7 FC ROSALES",
    "eq2": "FC LA UNIÓN"
  },
  {
    "jornada": 4,
    "eq1": "8 LA SELE-SAGUASCA",
    "eq2": "FC VALLE DEL ATLÉTICO"
  },
  {
    "jornada": 4,
    "eq1": "PC GALAXY",
    "eq2": "vacante"
  },
  {
    "jornada": 5,
    "eq1": "1 FC FENIX",
    "eq2": "FC LA UNIÓN"
  },
  {
    "jornada": 5,
    "eq1": "2 FC LA ISLA",
    "eq2": "LOS ALCONES FC"
  },
  {
    "jornada": 5,
    "eq1": "3 LA SELE-SAGUASCA",
    "eq2": "FC ACADEMIA"
  },
  {
    "jornada": 5,
    "eq1": "4 PUMAS FC",
    "eq2": "PC GALAXY"
  },
  {
    "jornada": 5,
    "eq1": "5 FC VALLE DEL ATLÉTICO",
    "eq2": "FC LA CONCHA"
  },
  {
    "jornada": 5,
    "eq1": "6 EL BARRIO",
    "eq2": "ATLÉTICO LAS LLANTAS"
  },
  {
    "jornada": 5,
    "eq1": "7 FK BODØ/GLIMT",
    "eq2": "FC CALERA"
  },
  {
    "jornada": 5,
    "eq1": "8 FC ROSALES",
    "eq2": "FC MUSULI"
  },
  {
    "jornada": 5,
    "eq1": "SHALQUE 04",
    "eq2": "vacante"
  },
  {
    "jornada": 6,
    "eq1": "1 FC ROSALES",
    "eq2": "PC GALAXY"
  },
  {
    "jornada": 6,
    "eq1": "2 LA SELE-SAGUASCA",
    "eq2": "FC LA UNIÓN"
  },
  {
    "jornada": 6,
    "eq1": "3 FC FENIX",
    "eq2": "FC MUSULI"
  },
  {
    "jornada": 6,
    "eq1": "4 FC LA CONCHA",
    "eq2": "FC ACADEMIA"
  },
  {
    "jornada": 6,
    "eq1": "5 EL BARRIO",
    "eq2": "LOS ALCONES FC"
  },
  {
    "jornada": 6,
    "eq1": "6 FC LA ISLA",
    "eq2": "FC CALERA"
  },
  {
    "jornada": 6,
    "eq1": "7 FC VALLE DEL ATLÉTICO",
    "eq2": "ATLÉTICO LAS LLANTAS"
  },
  {
    "jornada": 6,
    "eq1": "8 FK BODØ/GLIMT",
    "eq2": "SHALQUE 04"
  },
  {
    "jornada": 6,
    "eq1": "PUMAS FC",
    "eq2": "vacante"
  },
  {
    "jornada": 7,
    "eq1": "1 EL BARRIO",
    "eq2": "FC CALERA"
  },
  {
    "jornada": 7,
    "eq1": "2 FC FENIX",
    "eq2": "PC GALAXY"
  },
  {
    "jornada": 7,
    "eq1": "3 FC ROSALES",
    "eq2": "PUMAS FC"
  },
  {
    "jornada": 7,
    "eq1": "4 FC LA ISLA",
    "eq2": "SHALQUE 04"
  },
  {
    "jornada": 7,
    "eq1": "5 LA SELE-SAGUASCA",
    "eq2": "FC MUSULI"
  },
  {
    "jornada": 7,
    "eq1": "6 FC VALLE DEL ATLÉTICO",
    "eq2": "LOS ALCONES FC"
  },
  {
    "jornada": 7,
    "eq1": "7 FC LA CONCHA",
    "eq2": "FC LA UNIÓN"
  },
  {
    "jornada": 7,
    "eq1": "8 FC ACADEMIA",
    "eq2": "ATLÉTICO LAS LLANTAS"
  },
  {
    "jornada": 7,
    "eq1": "FK BODØ/GLIMT",
    "eq2": "vacante"
  },
  {
    "jornada": 8,
    "eq1": "1 FC ACADEMIA",
    "eq2": "LOS ALCONES FC"
  },
  {
    "jornada": 8,
    "eq1": "2 FC VALLE DEL ATLÉTICO",
    "eq2": "FC CALERA"
  },
  {
    "jornada": 8,
    "eq1": "3 FC LA ISLA",
    "eq2": "FK BODØ/GLIMT"
  },
  {
    "jornada": 8,
    "eq1": "4 FC LA CONCHA",
    "eq2": "FC MUSULI"
  },
  {
    "jornada": 8,
    "eq1": "5 FC FENIX",
    "eq2": "PUMAS FC"
  },
  {
    "jornada": 8,
    "eq1": "6 EL BARRIO",
    "eq2": "SHALQUE 04"
  },
  {
    "jornada": 8,
    "eq1": "7 LA SELE-SAGUASCA",
    "eq2": "PC GALAXY"
  },
  {
    "jornada": 8,
    "eq1": "8 ATLÉTICO LAS LLANTAS",
    "eq2": "FC LA UNIÓN"
  },
  {
    "jornada": 8,
    "eq1": "FC ROSALES",
    "eq2": "vacante"
  },
  {
    "jornada": 9,
    "eq1": "1 ATLÉTICO LAS LLANTAS",
    "eq2": "FC MUSULI"
  },
  {
    "jornada": 9,
    "eq1": "2 EL BARRIO",
    "eq2": "FK BODØ/GLIMT"
  },
  {
    "jornada": 9,
    "eq1": "3 FC LA UNIÓN",
    "eq2": "LOS ALCONES FC"
  },
  {
    "jornada": 9,
    "eq1": "4 FC FENIX",
    "eq2": "FC ROSALES"
  },
  {
    "jornada": 9,
    "eq1": "5 FC ACADEMIA",
    "eq2": "FC CALERA"
  },
  {
    "jornada": 9,
    "eq1": "6 FC LA CONCHA",
    "eq2": "PC GALAXY"
  },
  {
    "jornada": 9,
    "eq1": "7 FC VALLE DEL ATLÉTICO",
    "eq2": "SHALQUE 04"
  },
  {
    "jornada": 9,
    "eq1": "8 LA SELE-SAGUASCA",
    "eq2": "PUMAS FC"
  },
  {
    "jornada": 9,
    "eq1": "FC LA ISLA",
    "eq2": "vacante"
  },
  {
    "jornada": 10,
    "eq1": "1 LA SELE-SAGUASCA",
    "eq2": "FC ROSALES"
  },
  {
    "jornada": 10,
    "eq1": "2 ATLÉTICO LAS LLANTAS",
    "eq2": "PC GALAXY"
  },
  {
    "jornada": 10,
    "eq1": "3 FC LA UNIÓN",
    "eq2": "FC CALERA"
  },
  {
    "jornada": 10,
    "eq1": "4 LOS ALCONES FC",
    "eq2": "FC MUSULI"
  },
  {
    "jornada": 10,
    "eq1": "5 FC ACADEMIA",
    "eq2": "SHALQUE 04"
  },
  {
    "jornada": 10,
    "eq1": "6 FC LA CONCHA",
    "eq2": "PUMAS FC"
  },
  {
    "jornada": 10,
    "eq1": "7 EL BARRIO",
    "eq2": "FC LA ISLA"
  },
  {
    "jornada": 10,
    "eq1": "8 FC VALLE DEL ATLÉTICO",
    "eq2": "FK BODØ/GLIMT"
  },
  {
    "jornada": 10,
    "eq1": "FC FENIX",
    "eq2": "vacante"
  },
  {
    "jornada": 11,
    "eq1": "1 FC VALLE DEL ATLÉTICO",
    "eq2": "FC LA ISLA"
  },
  {
    "jornada": 11,
    "eq1": "2 FC MUSULI",
    "eq2": "FC CALERA"
  },
  {
    "jornada": 11,
    "eq1": "3 LOS ALCONES FC",
    "eq2": "PC GALAXY"
  },
  {
    "jornada": 11,
    "eq1": "4 FC LA UNIÓN",
    "eq2": "SHALQUE 04"
  },
  {
    "jornada": 11,
    "eq1": "5 ATLÉTICO LAS LLANTAS",
    "eq2": "PUMAS FC"
  },
  {
    "jornada": 11,
    "eq1": "6 FC LA CONCHA",
    "eq2": "FC ROSALES"
  },
  {
    "jornada": 11,
    "eq1": "7 LA SELE-SAGUASCA",
    "eq2": "FC FENIX"
  },
  {
    "jornada": 11,
    "eq1": "8 FC ACADEMIA",
    "eq2": "FK BODØ/GLIMT"
  },
  {
    "jornada": 11,
    "eq1": "EL BARRIO",
    "eq2": "vacante"
  },
  {
    "jornada": 12,
    "eq1": "1 FC LA CONCHA",
    "eq2": "FC FENIX"
  },
  {
    "jornada": 12,
    "eq1": "2 ATLÉTICO LAS LLANTAS",
    "eq2": "FC ROSALES"
  },
  {
    "jornada": 12,
    "eq1": "3 FC VALLE DEL ATLÉTICO",
    "eq2": "EL BARRIO"
  },
  {
    "jornada": 12,
    "eq1": "4 FC CALERA",
    "eq2": "PC GALAXY"
  },
  {
    "jornada": 12,
    "eq1": "5 FC ACADEMIA",
    "eq2": "FC LA ISLA"
  },
  {
    "jornada": 12,
    "eq1": "6 FC LA UNIÓN",
    "eq2": "FK BODØ/GLIMT"
  },
  {
    "jornada": 12,
    "eq1": "7 LOS ALCONES FC",
    "eq2": "PUMAS FC"
  },
  {
    "jornada": 12,
    "eq1": "8 FC MUSULI",
    "eq2": "SHALQUE 04"
  },
  {
    "jornada": 12,
    "eq1": "LA SELE-SAGUASCA",
    "eq2": "vacante"
  },
  {
    "jornada": 13,
    "eq1": "1 FC ACADEMIA",
    "eq2": "EL BARRIO"
  },
  {
    "jornada": 13,
    "eq1": "2 FC LA CONCHA",
    "eq2": "LA SELE-SAGUASCA"
  },
  {
    "jornada": 13,
    "eq1": "3 ATLÉTICO LAS LLANTAS",
    "eq2": "FC FENIX"
  },
  {
    "jornada": 13,
    "eq1": "4 FC LA UNIÓN",
    "eq2": "FC LA ISLA"
  },
  {
    "jornada": 13,
    "eq1": "5 LOS ALCONES FC",
    "eq2": "FC ROSALES"
  },
  {
    "jornada": 13,
    "eq1": "6 PC GALAXY",
    "eq2": "SHALQUE 04"
  },
  {
    "jornada": 13,
    "eq1": "7 FC MUSULI",
    "eq2": "FK BODØ/GLIMT"
  },
  {
    "jornada": 13,
    "eq1": "8 FC CALERA",
    "eq2": "PUMAS FC"
  },
  {
    "jornada": 13,
    "eq1": "FC VALLE DEL ATLÉTICO",
    "eq2": "vacante"
  },
  {
    "jornada": 14,
    "eq1": "1 SHALQUE 04",
    "eq2": "PUMAS FC"
  },
  {
    "jornada": 14,
    "eq1": "2 FC ACADEMIA",
    "eq2": "FC VALLE DEL ATLÉTICO"
  },
  {
    "jornada": 14,
    "eq1": "3 FC MUSULI",
    "eq2": "FC LA ISLA"
  },
  {
    "jornada": 14,
    "eq1": "4 ATLÉTICO LAS LLANTAS",
    "eq2": "LA SELE-SAGUASCA"
  },
  {
    "jornada": 14,
    "eq1": "5 PC GALAXY",
    "eq2": "FK BODØ/GLIMT"
  },
  {
    "jornada": 14,
    "eq1": "6 FC CALERA",
    "eq2": "FC ROSALES"
  },
  {
    "jornada": 14,
    "eq1": "7 LOS ALCONES FC",
    "eq2": "FC FENIX"
  },
  {
    "jornada": 14,
    "eq1": "8 FC LA UNIÓN",
    "eq2": "EL BARRIO"
  },
  {
    "jornada": 14,
    "eq1": "FC LA CONCHA",
    "eq2": "vacante"
  },
  {
    "jornada": 15,
    "eq1": "1 FC LA UNIÓN",
    "eq2": "FC VALLE DEL ATLÉTICO"
  },
  {
    "jornada": 15,
    "eq1": "2 PUMAS FC",
    "eq2": "FK BODØ/GLIMT"
  },
  {
    "jornada": 15,
    "eq1": "3 ATLÉTICO LAS LLANTAS",
    "eq2": "FC LA CONCHA"
  },
  {
    "jornada": 15,
    "eq1": "4 FC MUSULI",
    "eq2": "EL BARRIO"
  },
  {
    "jornada": 15,
    "eq1": "5 PC GALAXY",
    "eq2": "FC LA ISLA"
  },
  {
    "jornada": 15,
    "eq1": "6 LOS ALCONES FC",
    "eq2": "LA SELE-SAGUASCA"
  },
  {
    "jornada": 15,
    "eq1": "7 SHALQUE 04",
    "eq2": "FC ROSALES"
  },
  {
    "jornada": 15,
    "eq1": "8 FC CALERA",
    "eq2": "FC FENIX"
  },
  {
    "jornada": 15,
    "eq1": "FC ACADEMIA",
    "eq2": "vacante"
  },
  {
    "jornada": 16,
    "eq1": "1 FC CALERA",
    "eq2": "LA SELE-SAGUASCA"
  },
  {
    "jornada": 16,
    "eq1": "2 FC LA UNIÓN",
    "eq2": "FC ACADEMIA"
  },
  {
    "jornada": 16,
    "eq1": "3 SHALQUE 04",
    "eq2": "FC FENIX"
  },
  {
    "jornada": 16,
    "eq1": "4 FK BODØ/GLIMT",
    "eq2": "FC ROSALES"
  },
  {
    "jornada": 16,
    "eq1": "5 FC MUSULI",
    "eq2": "FC VALLE DEL ATLÉTICO"
  },
  {
    "jornada": 16,
    "eq1": "6 PUMAS FC",
    "eq2": "FC LA ISLA"
  },
  {
    "jornada": 16,
    "eq1": "7 LOS ALCONES FC",
    "eq2": "FC LA CONCHA"
  },
  {
    "jornada": 16,
    "eq1": "8 PC GALAXY",
    "eq2": "EL BARRIO"
  },
  {
    "jornada": 16,
    "eq1": "ATLÉTICO LAS LLANTAS",
    "eq2": "vacante"
  },
  {
    "jornada": 17,
    "eq1": "1 FC MUSULI",
    "eq2": "FC ACADEMIA"
  },
  {
    "jornada": 17,
    "eq1": "2 LOS ALCONES FC",
    "eq2": "ATLÉTICO LAS LLANTAS"
  },
  {
    "jornada": 17,
    "eq1": "3 PUMAS FC",
    "eq2": "EL BARRIO"
  },
  {
    "jornada": 17,
    "eq1": "4 PC GALAXY",
    "eq2": "FC VALLE DEL ATLÉTICO"
  },
  {
    "jornada": 17,
    "eq1": "5 SHALQUE 04",
    "eq2": "LA SELE-SAGUASCA"
  },
  {
    "jornada": 17,
    "eq1": "6 FK BODØ/GLIMT",
    "eq2": "FC FENIX"
  },
  {
    "jornada": 17,
    "eq1": "7 FC CALERA",
    "eq2": "FC LA CONCHA"
  },
  {
    "jornada": 17,
    "eq1": "8 FC ROSALES",
    "eq2": "FC LA ISLA"
  },
  {
    "jornada": 17,
    "eq1": "FC LA UNIÓN",
    "eq2": "vacante"
  }
];
        let idCounter = Date.now();
        let added = false;
        
        // Limpiamos si hay algo viejo generado
        appData.partidos = appData.partidos.filter(p => !(p.torneo === 'clausura' && p.calendario_nombre === 'Torneo Principal' && p.fase === 'liga'));

        matchesData.forEach(item => {
            let eq1 = 'vacante';
            let eq2 = 'vacante';

            if (item.eq1 !== 'vacante') {
                const searchName1 = removeAccents(item.eq1).replace(/\d+\s*/, '');
                // Intento exacto
                let team1 = appData.equipos.find(e => removeAccents(e.nombre) === searchName1);
                // Intento parcial (ej: PC Galaxy vs P. Club Galaxy)
                if (!team1) team1 = appData.equipos.find(e => removeAccents(e.nombre).includes(searchName1) || searchName1.includes(removeAccents(e.nombre)));
                
                if (team1) eq1 = team1.id;
                else console.warn('Equipo no encontrado: ' + item.eq1);
            }

            if (item.eq2 !== 'vacante') {
                const searchName2 = removeAccents(item.eq2);
                let team2 = appData.equipos.find(e => removeAccents(e.nombre) === searchName2);
                if (!team2) team2 = appData.equipos.find(e => removeAccents(e.nombre).includes(searchName2) || searchName2.includes(removeAccents(e.nombre)));
                
                if (team2) eq2 = team2.id;
                else console.warn('Equipo no encontrado: ' + item.eq2);
            }

            appData.partidos.push({
                id: (idCounter++).toString(),
                torneo: 'clausura',
                calendario_nombre: 'Torneo Principal',
                fase: 'liga',
                jornada: item.jornada,
                equipo1Id: eq1,
                equipo2Id: eq2,
                goles1: null,
                goles2: null,
                grupo: 'unico'
            });
            added = true;
        });

        if (added) {
            await saveData();
            localStorage.setItem('calendario_clausura_injected_final_2', 'true');
            if (typeof renderSorteos === 'function') {
                const sorteosView = document.getElementById('view-sorteos');
                if(sorteosView && sorteosView.classList.contains('active')){
                    renderSorteos();
                }
            }
            alert('¡El calendario oficial del Clausura 2026 (17 Jornadas) ha sido importado con éxito!');
        }
    }
}, 4500);
