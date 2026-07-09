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
    window.location.href = 'bienvenida.html';
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
    const { data: torneosData } = await supabase.from('torneos').select('*').eq('id', activeId);
    if (!torneosData || torneosData.length === 0) {
        window.location.href = 'bienvenida.html';
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
                    golesRecibidos: j.stats_apertura_goles_recibidos
                },
                clausura: {
                    goles: j.stats_clausura_goles,
                    amarillas: j.stats_clausura_amarillas,
                    rojas: j.stats_clausura_rojas,
                    golesRecibidos: j.stats_clausura_goles_recibidos
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
        const rawPartidos = partData.map(p => ({
            id: p.id.toString(),
            torneo: p.torneo,
            fase: p.fase,
            jornada: p.jornada,
            grupo: p.grupo,
            equipo1Id: p.equipo1_id,
            equipo2Id: p.equipo2_id,
            goles1: p.goles1,
            goles2: p.goles2,
            detalles: p.detalles || {}
        }));

        // Eliminar duplicados generados por clicks múltiples en versiones anteriores
        // El ID de los partidos es un Date.now() secuencial.
        // Encontramos el ID máximo para saber cuándo se generó el último calendario.
        let maxId = 0;
        rawPartidos.forEach(p => {
            const idNum = parseInt(p.id);
            if (!isNaN(idNum) && idNum > maxId) {
                maxId = idNum;
            }
        });

        // Solo conservamos los partidos que se generaron en el mismo lote (hasta 60 segundos de diferencia del último)
        // Esto filtrará automáticamente todos los calendarios antiguos.
        const umbralTiempo = maxId - 60000;
        appData.partidos = rawPartidos.filter(p => {
            const idNum = parseInt(p.id);
            return !isNaN(idNum) && idNum >= umbralTiempo;
        });

        // Si eliminamos duplicados, guardamos la lista limpia en la base de datos automáticamente
        if (rawPartidos.length > appData.partidos.length) {
            console.log(`Se eliminaron ${rawPartidos.length - appData.partidos.length} partidos de calendarios antiguos.`);
            
            setTimeout(async () => {
                // Intentamos borrar (puede fallar por RLS)
                const { error } = await supabase.from('partidos').delete().eq('torneo_id', activeId);
                
                // Si falla el borrado, intentamos actualizar los viejos para ocultarlos (soft delete)
                if (error) {
                    const oldMatches = rawPartidos.filter(p => parseInt(p.id) < umbralTiempo);
                    if (oldMatches.length > 0) {
                        const updates = oldMatches.map(p => ({
                            id: p.id,
                            torneo_id: 'deleted_' + activeId
                        }));
                        await supabase.from('partidos').upsert(updates);
                    }
                }
                
                // Guardar los nuevos
                savePartidosToSupabase();
            }, 1000);
        }
    } else {
        const localPartidos = localStorage.getItem(`femfutpal_partidos_${activeId}`);
        if (localPartidos) {
            appData.partidos = JSON.parse(localPartidos);
            // Intentar subirlos de una vez
            if (appData.partidos.length > 0) {
                setTimeout(savePartidosToSupabase, 2000);
            }
        }
    }
    console.log("Partidos cargados en memoria:", appData.partidos.length);
    if (appData.partidos.length === 0) {
        alert("DIAGNOSTICO: No se encontraron partidos en la base de datos ni en la memoria local al recargar.");
    }


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
            stats_clausura_goles: j.stats.clausura.goles,
            stats_clausura_amarillas: j.stats.clausura.amarillas,
            stats_clausura_rojas: j.stats.clausura.rojas,
            stats_clausura_goles_recibidos: j.stats.clausura.golesRecibidos
        }));
        const { error } = await supabase.from('jugadores').upsert(jugData);
        if (error && (error.message.includes('foto') || error.message.includes('dorsal'))) {
            const jugDataSafe = appData.jugadores.map(j => ({
                id: j.id,
                torneo_id: activeId,
                equipo_id: j.equipoId,
                nombre: j.name || j.nombre,
                is_novato: j.isNovato,
                is_portero: j.isPortero,
                status: j.status,
                transferencias: j.transferencias,
                stats_apertura_goles: j.stats.apertura.goles,
                stats_apertura_amarillas: j.stats.apertura.amarillas,
                stats_apertura_rojas: j.stats.apertura.rojas,
                stats_apertura_goles_recibidos: j.stats.apertura.golesRecibidos,
                stats_clausura_goles: j.stats.clausura.goles,
                stats_clausura_amarillas: j.stats.clausura.amarillas,
                stats_clausura_rojas: j.stats.clausura.rojas,
                stats_clausura_goles_recibidos: j.stats.clausura.golesRecibidos
            }));
            await supabase.from('jugadores').upsert(jugDataSafe);
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
        alert("Error de conexión a la base de datos. Si estás abriendo el archivo directamente (file:///), por favor utiliza 'Live Server' en Visual Studio Code para evitar bloqueos de seguridad del navegador.");
        return;
    }

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

    // Elements - Mercado
    const altasBody = document.getElementById("altas-body");
    const bajasBody = document.getElementById("bajas-body");

    // Elements - Sorteos
    const formGenerarSorteo = document.getElementById("form-generar-sorteo");
    const sorteoResultadosContainer = document.getElementById("sorteo-resultados-container");
    const sorteoResultadosSection = document.getElementById("sorteo-resultados-section");

    // Elements - Stats
    const tableBody = document.getElementById("table-body");
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
    renderPartidosGenerados();
    renderTablaPosiciones();

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
                                    apertura: { goles: 0, amarillas: 0, rojas: 0, golesRecibidos: 0 },
                                    clausura: { goles: 0, amarillas: 0, rojas: 0, golesRecibidos: 0 }
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
                    saveData();
                    updateSeasonBtn();
                    updateFinishedBanner();
                    if (currentTeamId) showTeamDetail(appData.equipos.find(t => t.id === currentTeamId));
                    alert("Temporada Finalizada. Modo de solo lectura activado.");

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
                                    apertura: { goles: 0, amarillas: 0, rojas: 0, golesRecibidos: 0 },
                                    clausura: { goles: 0, amarillas: 0, rojas: 0, golesRecibidos: 0 }
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
            } else if (viewTarget === 'sorteos') {
                if (logoContainer) logoContainer.style.display = 'flex';
                document.getElementById("view-sorteos").classList.add("active");
                currentTabTitle.textContent = "Sorteos y Emparejamientos";
                renderPartidosGenerados();
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
                    apertura: { goles: 0, amarillas: 0, rojas: 0, golesRecibidos: 0 },
                    clausura: { goles: 0, amarillas: 0, rojas: 0, golesRecibidos: 0 }
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

    // 6. Generador de Sorteos / Partidos
    if (formGenerarSorteo) {
        const sorteoFaseSelect = document.getElementById("sorteo-fase");
        const grupoNumContainer = document.getElementById("grupo-num-container");

        sorteoFaseSelect.addEventListener("change", () => {
            if (sorteoFaseSelect.value === 'grupos') {
                grupoNumContainer.style.display = 'block';
            } else {
                grupoNumContainer.style.display = 'none';
            }
        });

        formGenerarSorteo.addEventListener("submit", async (e) => {
            e.preventDefault();

            const fase = document.getElementById("sorteo-fase").value; // grupos | eliminatorias
            const formato = document.getElementById("sorteo-formato").value; // ida | idayvuelta

            if (appData.equipos.length < 2) {
                return alert("Necesitas al menos 2 equipos registrados para generar un sorteo.");
            }

            // Confirm before overwrite
            if (appData.partidos.filter(p => p.torneo === currentTorneo).length > 0) {
                if (!confirm("Ya tienes partidos generados para este torneo en la memoria local. ¿Deseas borrarlos y generar un NUEVO sorteo/calendario? (Se perderán los resultados)")) return;
            }

            showLoader("Generando nuevo calendario...");

            // Borrar partidos actuales del torneo de Supabase para evitar duplicados
            const { error: deleteError } = await supabase.from('partidos').delete().eq('torneo_id', activeId);
            if (deleteError) {
                console.error("Error al borrar partidos antiguos:", deleteError);
                alert("Hubo un problema borrando los partidos antiguos en la base de datos. Verifica los permisos (RLS) en Supabase para la tabla 'partidos'. Error: " + deleteError.message);
            }

            // Vaciar partidos actuales del torneo en memoria
            appData.partidos = appData.partidos.filter(p => p.torneo !== currentTorneo);
            let equiposActivos = [...appData.equipos].sort(() => Math.random() - 0.5);

            let idCounter = Date.now();

            if (fase === 'liga') {
                // Liga Única (Todos contra Todos)
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
                // Fase de Grupos
                const numGrupos = parseInt(document.getElementById("sorteo-grupos-num").value) || 2;
                if (numGrupos < 2 || numGrupos > 8) return alert("El número de grupos debe estar entre 2 y 8.");

                // Dividir en grupos
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
                // Emparejamientos directos aleatorios
                let i = 0;
                let partidoCount = 1;
                while (i < equiposActivos.length) {
                    const local = equiposActivos[i];
                    const visitante = i + 1 < equiposActivos.length ? equiposActivos[i + 1] : { id: 'vacante', nombre: 'VACANTE (Descansa)', logo: '' };

                    appData.partidos.push({
                        id: (idCounter++).toString(),
                        torneo: currentTorneo,
                        fase: 'eliminatoria',
                        jornada: 1, // Jornada única de eliminatoria actual
                        equipo1Id: local.id,
                        equipo2Id: visitante.id,
                        goles1: null,
                        goles2: null,
                        grupo: `Partido ${partidoCount}`
                    });

                    if (formato === 'idayvuelta' && visitante.id !== 'vacante') {
                        appData.partidos.push({
                            id: (idCounter++).toString(),
                            torneo: currentTorneo,
                            fase: 'eliminatoria',
                            jornada: 2, // Vuelta
                            equipo1Id: visitante.id,
                            equipo2Id: local.id,
                            goles1: null,
                            goles2: null,
                            grupo: `Partido ${partidoCount}`
                        });
                    }
                    partidoCount++;
                    i += 2;
                }
            }
            hideLoader();
            savePartidosToSupabase();
            renderPartidosGenerados();
            renderTablaPosiciones();

            setTimeout(() => {
                sorteoResultadosSection.scrollIntoView({ behavior: 'smooth' });
            }, 100);
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

    function renderPartidosGenerados() {
        if (!sorteoResultadosContainer) return;

        const partidos = appData.partidos.filter(p => p.torneo === currentTorneo);
        if (partidos.length === 0) {
            sorteoResultadosContainer.innerHTML = `<p style="text-align:center; color: var(--text-muted); font-size: 14px;">No hay partidos generados en este torneo. ¡Utiliza el panel superior para generar tu liga!</p>`;
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

        partidosPorJornada[jornadaName].forEach(p => {
            const local = p.equipo1Id === 'vacante' ? { id: 'vacante', nombre: 'VACANTE (Descansa)', logo: '' } : appData.equipos.find(e => e.id === p.equipo1Id) || { nombre: 'Equipo Desconocido' };
            const visitante = p.equipo2Id === 'vacante' ? { id: 'vacante', nombre: 'VACANTE (Descansa)', logo: '' } : appData.equipos.find(e => e.id === p.equipo2Id) || { nombre: 'Equipo Desconocido' };

            const isVacante = local.id === 'vacante' || visitante.id === 'vacante';

            let inputArea = "";
            if (!isVacante) {
                const g1Val = p.goles1 !== null ? p.goles1 : "";
                const g2Val = p.goles2 !== null ? p.goles2 : "";

                let scoreDisplay = "";
                if ((p.detalles && p.detalles.estado === 'finalizado') || (p.goles1 !== null && p.goles2 !== null)) {
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

            html += `
            <div class="match-card fade-in">
                <div class="${localClasses}">
                    ${localImg}
                    <span>${local.nombre || local.name}</span>
                </div>

                <div style="display:flex; flex-direction:column; align-items:center;">
                    ${badgeHtml}
                    <div class="match-vs">VS</div>
                    ${inputArea}
                    ${(local.id !== 'vacante' && visitante.id !== 'vacante') ? `
                        <div style="display:flex; gap: 5px; margin-top:5px;">
                            <button class="btn-primary btn-fast-result" data-match-id="${p.id}" style="font-size:0.75rem; padding: 4px 10px; border-radius:15px; background: #3b82f6;"><i class="fa-solid fa-pen"></i> Resultado</button>
                            <button class="btn-primary btn-manage-match" data-match-id="${p.id}" style="font-size:0.75rem; padding: 4px 10px; border-radius:15px; background: #10b981;"><i class="fa-solid fa-gamepad"></i> En vivo</button>
                        </div>
                    ` : ''}
                </div>

                <div class="${visClasses}">
                    ${visImg}
                    <span>${visitante.nombre || visitante.name}</span>
                </div>
            </div>
            `;
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

        // Add event listeners for Live Tracker
        sorteoResultadosContainer.querySelectorAll(".btn-manage-match").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const matchId = e.target.closest("button").getAttribute("data-match-id");
                openMatchDashboard(matchId);
            });
        });
        
        // Add event listeners for Fast Result
        sorteoResultadosContainer.querySelectorAll(".btn-fast-result").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const matchId = e.target.closest("button").getAttribute("data-match-id");
                openFastResultModal(matchId);
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

    function renderTablaPosiciones() {
        const container = document.getElementById("posiciones-container");
        if (!container) return;

        // Obtener todos los partidos del torneo actual (liga o grupos)
        const todosLosPartidos = appData.partidos.filter(p => p.torneo === currentTorneo && (p.fase === 'liga' || p.fase === 'grupos'));

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
    function handleTransfer(playerId, newTeamId) {
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
        saveData();
        updateSelects();
        alert("Traspaso completado.");

        if (currentTeamId) showTeamDetail(appData.equipos.find(t => t.id === currentTeamId));
        if (document.getElementById("view-mercado").classList.contains("active")) renderMercado();
    }

    function handleBaja(playerId) {
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
            saveData();
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

    window.triggerBaja = function (id) {
        handleBaja(id);
    };

    window.deleteMovimiento = function (id) {
        if (!confirm("¿Estás seguro de que deseas eliminar este movimiento y revertir la acción?")) return;

        const movIndex = appData.movimientos.findIndex(m => m.id == id);
        if (movIndex === -1) return;
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

        appData.movimientos.splice(movIndex, 1);
        saveData();
        updateSelects();
        renderMercado();
        if (currentTeamId) showTeamDetail(appData.equipos.find(t => t.id === currentTeamId));
        alert("Acción eliminada correctamente.");
    };

    window.deletePlayerComplete = function (id) {
        const player = appData.jugadores.find(p => p.id === id);
        if (!player) return;
        if (confirm(`¿Estás completamente seguro de ELIMINAR a ${player.name} de la base de datos?\n\nEsta acción borrará todas sus estadísticas e historial. Úsalo solo si te equivocaste al crearlo.`)) {
            appData.jugadores = appData.jugadores.filter(p => p.id !== id);
            appData.movimientos = appData.movimientos.filter(m => m.jugadorId !== id);
            saveData();
            updateSelects();
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

    function renderStats(tab) {
        const config = tabTitles[tab];
        currentTabTitle.textContent = config.title;
        statColumnHeader.textContent = config.statName;
        tableBody.innerHTML = '';

        let activePlayers = appData.jugadores.filter(p => p.status === 'activo');

        if (tab === 'novatos') activePlayers = activePlayers.filter(p => p.isNovato);
        if (tab === 'porteros') activePlayers = activePlayers.filter(p => p.isPortero);

        let statData = activePlayers.map(p => {
            const team = appData.equipos.find(t => t.id === p.equipoId);
            let val = 0;
            // Get stats based on current tournament
            const torneoStats = p.stats[currentTorneo];

            if (tab === 'goleadores' || tab === 'novatos') val = torneoStats.goles;
            else if (tab === 'amarillas') val = torneoStats.amarillas;
            else if (tab === 'rojas') val = torneoStats.rojas;
            else if (tab === 'porteros') val = torneoStats.golesRecibidos;

            return { player: p, team: team ? team.nombre : 'Sin Equipo', stat: val };
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
                            <span>${d.player.name} ${alertBadge}</span>
                        </div>
                    </td>
                    <td><span class="team-badge">${d.team}</span></td>
                    <td><span class="stat-highlight">${d.stat}</span></td>
                `;
                tableBody.appendChild(tr);
            });
        } else {
            topPlayerName.textContent = "N/A";
            topPlayerStat.textContent = "0";
            tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center;">No hay datos en el Torneo ${currentTorneo.toUpperCase()}.</td></tr>`;
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
        'minutos': 'Registrar Minutos (Portero/Novato)'
    };
    document.getElementById("select-player-title").innerText = titleMap[actionType];
    
    document.getElementById("minutos-input-container").style.display = actionType === 'minutos' ? 'block' : 'none';
    document.getElementById("cambio-input-container").style.display = actionType === 'cambio' ? 'block' : 'none';
    
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
        
        const teamPlayers = appData.jugadores.filter(j => j.equipoId === teamId);
        const listContainer = document.getElementById("player-selection-list");
        
        if (teamPlayers.length === 0) {
            listContainer.innerHTML = `<div style="padding:15px;color:var(--text-muted);text-align:center;">No hay jugadores registrados en este equipo.</div>`;
            return;
        }
        
        let html = "";
        teamPlayers.forEach(j => {
            html += `<div class="player-sel-item" data-jug-id="${j.id}" data-team="${isLocal ? 'local' : 'visitante'}">
                <i class="fa-solid fa-user"></i> ${j.nombre}
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
        
        // Aquí podríamos sumar a stats_apertura_goles, pero es mejor que el usuario sincronice todo al final 
        // o sumar directamente si lo requiere. Por ahora lo guardamos en el partido.
    } 
    else if (currentActionType === 'minutos') {
        const mins = document.getElementById("input-minutos-jugados").value;
        if(!mins) { alert("Ingresa los minutos"); return; }
        extraStr = `Jugó ${mins} minutos`;
    }
    
    addMatchEvent(currentActionMatch, currentActionType, teamSide, jugId, extraStr);
    
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
        navigator.clipboard.writeText(url).then(() => {
            alert("¡Enlace copiado! Ya puedes pegarlo en WhatsApp.");
        }).catch(() => {
            alert("Error al copiar. Tu enlace es: " + url);
        });
    });
}
document.getElementById("btn-save-resultado-rapido")?.addEventListener("click", () => {
    const match = appData.partidos.find(p => p.id === currentFastResultMatchId);
    if (!match) return;

    const g1 = parseInt(document.getElementById("res-rapido-goles-local").value);
    const g2 = parseInt(document.getElementById("res-rapido-goles-vis").value);

    match.goles1 = isNaN(g1) ? 0 : g1;
    match.goles2 = isNaN(g2) ? 0 : g2;

    if (!match.detalles) match.detalles = {};
    match.detalles.estado = 'finalizado';

    savePartidosToSupabase();
    renderPartidosGenerados(); // Refresh UI
    document.getElementById("modal-resultado-rapido").classList.remove("active");
});
