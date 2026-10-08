document.addEventListener('DOMContentLoaded', async () => {
    const inputEquipo = document.getElementById('input-equipo');
    const form = document.getElementById('form-inscripcion');

    // Mapeo de meses
    const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    // 1. Cargar el torneo activo
    const urlParams = new URLSearchParams(window.location.search);
    let activeId = urlParams.get('torneo');
    
    if (!activeId) {
        activeId = localStorage.getItem('femfutpal_active_id');
    }
    
    if (!activeId) {
        // Find it if not in localstorage and no param (public link fallback)
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
        const isNovato = document.getElementById('input-is-novato').checked;
        const isPortero = document.getElementById('input-is-portero').checked;

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
                is_novato: isNovato,
                is_portero: isPortero
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

        const elementToPrint = document.getElementById('print-area');
        
        // Crear un contenedor clonado para forzar el ancho sin afectar la vista actual
        const cloneContainer = document.createElement('div');
        cloneContainer.style.width = '800px';
        cloneContainer.style.position = 'absolute';
        cloneContainer.style.top = '0';
        cloneContainer.style.left = '0';
        cloneContainer.style.background = 'white';
        cloneContainer.style.zIndex = '-9999';
        
        // Clonar el contenido
        const clone = elementToPrint.cloneNode(true);
        clone.style.display = 'block';
        clone.style.width = '100%';
        clone.style.padding = '40px';
        clone.style.boxSizing = 'border-box';
        
        // Ajustar estilos problemáticos en el clon
        const signatures = clone.querySelector('.signatures');
        if(signatures) {
            signatures.style.marginTop = '40px';
            signatures.style.pageBreakInside = 'avoid';
        }
        
        cloneContainer.appendChild(clone);
        document.body.appendChild(cloneContainer);

        const fileName = `Inscripcion_${nombres.replace(/\s+/g, '_')}.pdf`;

        const opt = {
            margin:       0.3,
            filename:     fileName,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, logging: false },
            jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
        };

        // Cambiamos el texto del boton mientras carga
        const btnSubmit = document.querySelector('.btn-submit');
        const oldText = btnSubmit.innerHTML;
        btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando PDF...';

        window.scrollTo(0, 0);

        html2pdf().set(opt).from(cloneContainer).save().then(() => {
            btnSubmit.innerHTML = oldText;
            document.body.removeChild(cloneContainer);
        });
    });
});
