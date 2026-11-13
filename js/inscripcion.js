document.addEventListener('DOMContentLoaded', async () => {
    const inputEquipo = document.getElementById('input-equipo');
    const form = document.getElementById('form-inscripcion');

    // Util para capitalizar primera letra de cada palabra
    function toTitleCase(str) {
        if (!str) return "";
        return str.toLowerCase().replace(/(?:^|\s)\S/g, function(a) { return a.toUpperCase(); });
    }

    // Autocapitalizar nombre al escribir
    const inputNombres = document.getElementById('input-nombres');
    if (inputNombres) {
        inputNombres.addEventListener('input', function(e) {
            let start = this.selectionStart;
            let end = this.selectionEnd;
            this.value = toTitleCase(this.value);
            this.setSelectionRange(start, end);
        });
    }

    // Mapeo de meses
    const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    // Manejo de la Firma Escaneada
    const inputFirmaFile = document.getElementById('input-firma-file');
    const btnSelectFirma = document.getElementById('btn-select-firma');
    const btnRemoveFirma = document.getElementById('btn-remove-firma');
    const firmaPreviewBox = document.getElementById('firma-preview-box');
    const imgFirmaPreview = document.getElementById('img-firma-preview');
    let firmaDataUrl = "";

    if (btnSelectFirma && inputFirmaFile) {
        btnSelectFirma.addEventListener('click', () => inputFirmaFile.click());
    }

    if (inputFirmaFile) {
        inputFirmaFile.addEventListener('change', function () {
            const file = this.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    firmaDataUrl = e.target.result;
                    if (imgFirmaPreview) imgFirmaPreview.src = firmaDataUrl;
                    if (firmaPreviewBox) firmaPreviewBox.style.display = 'block';
                    if (btnRemoveFirma) btnRemoveFirma.style.display = 'block';
                    if (btnSelectFirma) btnSelectFirma.innerHTML = '<i class="fa-solid fa-check" style="color: #10b981;"></i> Firma Cargada (Cambiar)';
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (btnRemoveFirma) {
        btnRemoveFirma.addEventListener('click', () => {
            firmaDataUrl = "";
            inputFirmaFile.value = "";
            if (firmaPreviewBox) firmaPreviewBox.style.display = 'none';
            if (btnRemoveFirma) btnRemoveFirma.style.display = 'none';
            if (btnSelectFirma) btnSelectFirma.innerHTML = '<i class="fa-solid fa-camera"></i> Subir Foto de la Firma';
        });
    }

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
        const preselectedEquipoId = urlParams.get('equipo');
        
        if (equipos && equipos.length > 0) {
            inputEquipo.innerHTML = '<option value="">-- Seleccione su Equipo --</option>';
            equipos.forEach(eq => {
                const opt = document.createElement('option');
                opt.value = eq.id; 
                opt.dataset.nombre = eq.nombre;
                opt.textContent = eq.nombre;
                if (preselectedEquipoId && String(eq.id) === String(preselectedEquipoId)) {
                    opt.selected = true;
                }
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
        const btnSubmit = document.querySelector('.btn-submit');
        const oldBtnText = btnSubmit.innerHTML;
        try {
            btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
            btnSubmit.disabled = true;

            const jugadorId = Date.now();
            const { error } = await supabase.from('jugadores').insert([{
                id: jugadorId,
                torneo_id: activeTorneoId ? Number(activeTorneoId) : null,
                equipo_id: Number(equipoId),
                nombre: nombres,
                status: 'activo',
                transferencias: 0,
                is_novato: isNovato,
                is_portero: isPortero
            }]);

            if (error) {
                console.warn("Error Supabase con ID numérico, reintentando con ID string:", error);
                // Si la columna id espera bigint/text diferente
                const { error: errRetry } = await supabase.from('jugadores').insert([{
                    id: String(Date.now()),
                    torneo_id: activeTorneoId ? Number(activeTorneoId) : null,
                    equipo_id: Number(equipoId),
                    nombre: nombres,
                    status: 'activo',
                    transferencias: 0,
                    is_novato: isNovato,
                    is_portero: isPortero
                }]);
                if (errRetry) throw errRetry;
            }
        } catch (error) {
            console.error("Error al guardar el jugador:", error);
            alert("Aviso: Hubo un inconveniente al guardar el jugador en la base de datos (" + (error.message || "Error desconocido") + "). Se procederá a generar la carta de todas formas.");
        } finally {
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

        // Llenar firma escaneada del jugador si fue cargada
        const printFirmaJugador = document.getElementById('print-firma-jugador');
        if (printFirmaJugador) {
            if (firmaDataUrl) {
                printFirmaJugador.src = firmaDataUrl;
                printFirmaJugador.style.display = 'block';
            } else {
                printFirmaJugador.src = '';
                printFirmaJugador.style.display = 'none';
            }
        }

        btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando PDF...';
        btnSubmit.disabled = true;

        const printArea = document.getElementById('print-area');

        // Activamos modo de exportación PDF
        document.body.classList.add('pdf-mode');

        // Aseguramos que las imágenes de logo hayan cargado
        const images = printArea.querySelectorAll('img');
        await Promise.all(Array.from(images).map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise(resolve => {
                img.onload = resolve;
                img.onerror = resolve;
            });
        }));

        // Pequeño timeout para renderizado de fuentes y estilos
        await new Promise(r => setTimeout(r, 250));

        const fileName = `Inscripcion_${nombres.replace(/\s+/g, '_')}.pdf`;

        const opt = {
            margin:       [0.4, 0.4, 0.4, 0.4],
            filename:     fileName,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { 
                scale: 2, 
                useCORS: true, 
                backgroundColor: '#ffffff',
                logging: false,
                scrollX: 0,
                scrollY: 0
            },
            jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
        };

        try {
            window.scrollTo(0, 0);
            await html2pdf().set(opt).from(printArea).save();
        } catch (pdfErr) {
            console.error("Error al generar PDF:", pdfErr);
            alert("Hubo un error al generar el PDF: " + pdfErr.message);
        } finally {
            document.body.classList.remove('pdf-mode');
            btnSubmit.innerHTML = oldBtnText;
            btnSubmit.disabled = false;
        }
    });
});
