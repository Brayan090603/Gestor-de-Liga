document.addEventListener('DOMContentLoaded', async () => {
    const inputEquipo = document.getElementById('input-equipo');
    const form = document.getElementById('form-inscripcion');

    // Mapeo de meses
    const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    // 1. Cargar el torneo activo
    let activeId = localStorage.getItem('femfutpal_active_id');
    
    if (!activeId) {
        // Find it if not in localstorage (public link fallback)
        const { data: latestTorneo } = await supabase.from('torneos').select('id').order('created_at', { ascending: false }).limit(1).single();
        if (latestTorneo) {
            activeId = latestTorneo.id;
        }
    }

    let activeTorneoId = null;

    if (activeId) {
        // Fetch tournament details safely with select *
        const { data: torneoData } = await supabase.from('torneos').select('*').eq('id', activeId).single();
        if (torneoData) {
            activeTorneoId = torneoData.id;
            // Actualizar la vista de impresión con los datos reales del torneo
            document.getElementById('print-header-torneo').textContent = torneoData.nombre ? torneoData.nombre.toUpperCase() : "CAMPEONATO CATEGORIA LIBRE";
            
            const dedicatoria = torneoData.dedicatoria || "";
            document.getElementById('print-header-dedicatoria').textContent = dedicatoria ? `"${dedicatoria.toUpperCase()}"` : "";
            
            document.getElementById('print-header-year').textContent = torneoData.anio_actual || new Date().getFullYear();

            // Load logo
            if (torneoData.logo) {
                const logoImg = `<img src="${torneoData.logo}" style="max-width:100%; max-height:100%; object-fit:contain;">`;
                const logoLeft = document.getElementById('logo-left');
                const logoRight = document.getElementById('logo-right');
                if(logoLeft) { logoLeft.innerHTML = logoImg; logoLeft.style.border = 'none'; }
                if(logoRight) { logoRight.innerHTML = logoImg; logoRight.style.border = 'none'; }
            }
        }

        // Cargar equipos para el dropdown
        const { data: equipos } = await supabase.from('equipos').select('*').eq('torneo_id', activeId).order('nombre');
        
        if (equipos && equipos.length > 0) {
            inputEquipo.innerHTML = '<option value="">-- Seleccione su Equipo --</option>';
            equipos.forEach(eq => {
                const opt = document.createElement('option');
                opt.value = eq.id; 
                opt.dataset.nombre = eq.nombre;
                opt.textContent = eq.nombre;
                inputEquipo.appendChild(opt);
            });
        } else {
            inputEquipo.innerHTML = '<option value="">No hay equipos registrados</option>';
        }
    } else {
        inputEquipo.innerHTML = '<option value="">Error: No hay torneo activo</option>';
    }

    // 2. Manejar el envío del formulario
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Validar campos obligatorios HTML5
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        // Obtener valores
        const selectEquipo = document.getElementById('input-equipo');
        const equipoId = selectEquipo.value;
        const equipoNombre = selectEquipo.options[selectEquipo.selectedIndex].dataset.nombre;
        
        const nombres = document.getElementById('input-nombres').value;
        const cedula = document.getElementById('input-cedula').value;
        const municipio = document.getElementById('input-municipio').value;
        const direccion = document.getElementById('input-direccion').value;

        // Validar
        if (!equipoId) {
            alert('Por favor seleccione un equipo.');
            return;
        }

        // Guardar en la base de datos (Supabase)
        try {
            const btnSubmit = document.querySelector('.btn-submit');
            btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
            btnSubmit.disabled = true;

            const { error } = await supabase.from('jugadores').insert([{
                torneo_id: activeTorneoId,
                equipo_id: equipoId,
                nombre: nombres,
                status: 'activo',
                is_novato: false,
                is_portero: false
            }]);

            if (error) throw error;
            
            // Si tiene éxito, preparamos la impresión
            btnSubmit.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Generar Carta';
            btnSubmit.disabled = false;
        } catch (error) {
            console.error("Error al guardar el jugador:", error);
            alert("Hubo un error al guardar al jugador en la base de datos. Se generará la carta de todas formas.");
            const btnSubmit = document.querySelector('.btn-submit');
            btnSubmit.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Generar Carta';
            btnSubmit.disabled = false;
        }

        // Llenar datos de impresión
        document.getElementById('print-equipo').textContent = equipoNombre.toUpperCase();
        document.getElementById('print-nombres').textContent = nombres.toUpperCase();
        document.getElementById('print-cedula').textContent = cedula.toUpperCase();
        document.getElementById('print-municipio').textContent = municipio.toUpperCase();
        document.getElementById('print-direccion').textContent = direccion.toUpperCase();

        // Llenar fecha
        const hoy = new Date();
        document.getElementById('print-dia').textContent = hoy.getDate();
        document.getElementById('print-mes').textContent = meses[hoy.getMonth()];
        document.getElementById('print-anio').textContent = hoy.getFullYear().toString().substr(-2);

        // Lanzar diálogo de impresión
        window.print();
    });
});
