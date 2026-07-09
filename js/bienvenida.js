window.addEventListener('error', function (e) {
    alert("Error de Javascript: " + e.message + " en linea " + e.lineno);
});

window.addEventListener('unhandledrejection', function (e) {
    alert("Promesa rechazada: " + (e.reason ? e.reason.message || e.reason : "desconocido"));
});

document.addEventListener("DOMContentLoaded", async () => {

    // --- 1. LECTURA DE TORNEOS DESDE SUPABASE ---
    showLoader("Cargando torneos...");

    let masterList = [];
    try {
        const { data: torneosData, error } = await supabase
            .from('torneos')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Error al cargar torneos:", error);
            alert("Hubo un error al cargar los torneos. (Detalles en consola)");
        } else {
            masterList = torneosData || [];
        }
    } catch (e) {
        console.error("Fallo crítico de conexión:", e);
        alert("Error de conexión a la base de datos. Si estás abriendo el archivo directamente (file:///), por favor utiliza 'Live Server' en Visual Studio Code para evitar bloqueos de seguridad del navegador.");
    }

    hideLoader();

    // --- 2. RENDERIZADO DEL PASO 0 (LANZADOR) ---
    const step0 = document.getElementById("step-0");
    const step1 = document.getElementById("step-1");
    const step2 = document.getElementById("step-2");

    const tListContainer = document.getElementById("tournaments-list");
    const btnCreateNew = document.getElementById("btn-create-new");
    const limitMsg = document.getElementById("limit-msg");

    function renderTournaments() {
        tListContainer.innerHTML = '';

        if (masterList.length === 0) {
            tListContainer.innerHTML = '<p style="color:var(--text-muted); font-size:14px; margin-bottom:20px;">No tienes ningún torneo creado todavía.</p>';
        } else {
            masterList.forEach(t => {
                const card = document.createElement("div");
                card.style.background = 'var(--card-bg)';
                card.style.border = '1px solid var(--border-color)';
                card.style.borderRadius = 'var(--radius-lg)';
                card.style.padding = '20px';
                card.style.display = 'flex';
                card.style.justifyContent = 'space-between';
                card.style.alignItems = 'center';

                const logoSrc = t.logo ? t.logo : 'https://cdn-icons-png.flaticon.com/512/53/53283.png';
                const logoHtml = t.logo ? `<img src="${t.logo}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">` : `<i class="fa-solid fa-futbol" style="font-size:30px; color:var(--accent-primary);"></i>`;

                card.innerHTML = `
                    <div style="display:flex; align-items:center; gap:15px; text-align:left;">
                        ${logoHtml}
                        <div>
                            <h3 style="font-size:16px; margin:0; color:var(--text-primary);">${t.nombre}</h3>
                            <p style="font-size:12px; margin:0; color:var(--text-secondary);">${t.tipo_torneo === 'unico' ? 'Torneo Único' : 'Torneo Dual'} - Año ${t.anio_actual}</p>
                        </div>
                    </div>
                    <div style="display:flex; gap:10px;">
                        <button class="btn-start-t" data-id="${t.id}" style="background:var(--accent-primary); border:none; color:#fff; padding:8px 15px; border-radius:var(--radius-md); cursor:pointer; font-weight:600;"><i class="fa-solid fa-play"></i> Continuar</button>
                        <button class="btn-delete-t" data-id="${t.id}" style="background:transparent; border:1px solid #EF4444; color:#EF4444; padding:8px 15px; border-radius:var(--radius-md); cursor:pointer; font-weight:600;"><i class="fa-solid fa-trash"></i></button>
                    </div>
                `;
                tListContainer.appendChild(card);
            });
        }

        if (masterList.length >= 2) {
            btnCreateNew.style.display = 'none';
            limitMsg.style.display = 'block';
        } else {
            btnCreateNew.style.display = 'inline-block';
            limitMsg.style.display = 'none';
        }

        // Listeners Continuar y Eliminar
        document.querySelectorAll('.btn-start-t').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                localStorage.setItem('femfutpal_active_id', id);
                window.location.href = 'index.html';
            });
        });

        document.querySelectorAll('.btn-delete-t').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm("¿Estás seguro de que quieres eliminar este torneo? Esto borrará todos sus equipos y estadísticas para siempre en la nube.")) {
                    const id = e.currentTarget.getAttribute('data-id');

                    showLoader("Eliminando torneo...");
                    const { error } = await supabase
                        .from('torneos')
                        .delete()
                        .eq('id', id);
                    hideLoader();

                    if (error) {
                        alert("Error al eliminar: " + error.message);
                    } else {
                        masterList = masterList.filter(t => t.id != id);
                        renderTournaments();
                    }
                }
            });
        });
    }

    renderTournaments();

    // --- 3. LÓGICA DE CREAR NUEVO (PASOS 1 y 2) ---

    btnCreateNew.addEventListener("click", () => {
        alert("¡Botón Crear Nuevo Torneo clickeado!");
        step0.classList.remove("active");
        step1.classList.add("active");
    });

    const yearInput = document.getElementById("setup-year");
    const cards = document.querySelectorAll(".setup-card");
    const btnNext = document.getElementById("btn-next-step");
    const btnPrev = document.getElementById("btn-prev-step");
    const btnStart = document.getElementById("btn-start-setup");

    // Inputs paso 2
    const inputName = document.getElementById("setup-name");
    const inputLugar = document.getElementById("setup-lugar");
    const inputCampo = document.getElementById("setup-campo");
    const inputCelular = document.getElementById("setup-celular");
    const inputLogo = document.getElementById("setup-logo");
    const inputPortada = document.getElementById("setup-portada");

    const previewLogo = document.getElementById("preview-logo");
    const previewPortada = document.getElementById("preview-portada");

    let logoDataUrl = null;
    let portadaDataUrl = null;

    let selectedType = null;

    cards.forEach(card => {
        card.addEventListener("click", () => {
            cards.forEach(c => c.classList.remove("active"));
            card.classList.add("active");
            selectedType = card.getAttribute("data-type");
        });
    });

    // Leer imágenes
    function handleImageUpload(input, previewElement, callback) {
        input.addEventListener("change", function () {
            if (this.files && this.files[0]) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    previewElement.src = e.target.result;
                    previewElement.style.display = "block";
                    callback(e.target.result);
                };
                reader.readAsDataURL(this.files[0]);
            }
        });
    }

    handleImageUpload(inputLogo, previewLogo, (data) => logoDataUrl = data);
    handleImageUpload(inputPortada, previewPortada, (data) => portadaDataUrl = data);

    // Siguiente Paso
    btnNext.addEventListener("click", () => {
        if (!selectedType) {
            alert("Por favor, selecciona el tipo de torneo (Único o Dual) para continuar.");
            return;
        }

        const newYear = parseInt(yearInput.value);
        if (isNaN(newYear) || newYear < 2000 || newYear > 2100) {
            alert("Por favor ingresa un año válido.");
            return;
        }

        step1.classList.remove("active");
        step2.classList.add("active");
    });

    // Paso Anterior
    btnPrev.addEventListener("click", () => {
        step2.classList.remove("active");
        step1.classList.add("active");
    });

    // Iniciar Temporada
    btnStart.addEventListener("click", async () => {
        const nombreTorneo = inputName.value.trim();
        if (!nombreTorneo) {
            alert("El nombre del torneo es obligatorio.");
            return;
        }

        const newYear = parseInt(yearInput.value);
        const newId = Date.now();

        const nuevoTorneo = {
            id: newId,
            nombre: nombreTorneo,
            lugar: inputLugar.value.trim(),
            campo: inputCampo.value.trim(),
            celular: inputCelular.value.trim(),
            logo: logoDataUrl,
            portada: portadaDataUrl,
            anio_actual: newYear,
            tipo_torneo: selectedType,
            estado_apertura: 'activo',
            estado_clausura: selectedType === 'unico' ? 'finalizado' : 'pendiente'
        };

        showLoader("Creando torneo...");
        const { error } = await supabase
            .from('torneos')
            .insert([nuevoTorneo]);

        hideLoader();

        if (error) {
            console.error("Error al crear torneo:", error);
            alert("Hubo un error al crear el torneo en la base de datos.");
            return;
        }

        localStorage.setItem('femfutpal_active_id', newId.toString());
        window.location.href = 'index.html';
    });
});
