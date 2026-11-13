// js/bienvenida.js - Gestión de Bienvenida, Autenticación y Filtrado por Propietario

window.addEventListener('error', function (e) {
    console.error("Error de Javascript: " + e.message + " en linea " + e.lineno);
});

window.addEventListener('unhandledrejection', function (e) {
    console.error("Promesa rechazada: " + (e.reason ? e.reason.message || e.reason : "desconocido"));
});

document.addEventListener("DOMContentLoaded", async () => {

    const stepAuth = document.getElementById("step-auth");
    const step0 = document.getElementById("step-0");
    const step1 = document.getElementById("step-1");
    const step2 = document.getElementById("step-2");

    const tListContainer = document.getElementById("tournaments-list");
    const btnCreateNew = document.getElementById("btn-create-new");
    const limitMsg = document.getElementById("limit-msg");

    const tabLogin = document.getElementById("tab-auth-login");
    const tabRegister = document.getElementById("tab-auth-register");
    const formAuthPortal = document.getElementById("form-auth-portal");
    const authTitle = document.getElementById("auth-title");
    const authDesc = document.getElementById("auth-desc");

    const inputEmail = document.getElementById("auth-email-input");
    const inputPass = document.getElementById("auth-pass-input");
    const inputConfirmPass = document.getElementById("auth-confirm-pass-input");
    const groupConfirmPass = document.getElementById("group-confirm-pass");
    const btnAuthText = document.getElementById("btn-auth-text");

    const btnToggleEyePass = document.getElementById("btn-toggle-eye-pass");
    const btnToggleEyeConfirm = document.getElementById("btn-toggle-eye-confirm");
    const btnAuthGoogle = document.getElementById("btn-auth-google");

    const btnForgotPassword = document.getElementById("btn-forgot-password");
    const modalForgotPassword = document.getElementById("modal-forgot-password");
    const btnCloseForgotModal = document.getElementById("btn-close-forgot-modal");
    const formSendResetCode = document.getElementById("form-send-reset-code");
    const formVerifyResetCode = document.getElementById("form-verify-reset-code");
    const forgotStepSend = document.getElementById("forgot-step-send");
    const forgotStepVerify = document.getElementById("forgot-step-verify");
    const resetEmailInput = document.getElementById("reset-email-input");
    const resetCodeNotice = document.getElementById("reset-code-notice");

    const btnLogout = document.getElementById("btn-logout-portal");
    const userLoggedName = document.getElementById("user-logged-name");

    const btnTogglePublicExplore = document.getElementById("btn-toggle-public-explore");
    const publicTournamentsList = document.getElementById("public-tournaments-list");

    const btnExplorePublicRoot = document.getElementById("btn-explore-public-root");
    const rootPublicTournaments = document.getElementById("root-public-tournaments");

    let isRegisterMode = false;
    let allDatabaseTorneos = [];
    let myTorneosList = [];
    let activeResetEmail = '';

    // Alternar visibilidad de contraseñas
    if (btnToggleEyePass) {
        btnToggleEyePass.addEventListener("click", () => {
            const isPassword = inputPass.type === "password";
            inputPass.type = isPassword ? "text" : "password";
            btnToggleEyePass.innerHTML = isPassword ? '<i class="fa-regular fa-eye-slash"></i>' : '<i class="fa-regular fa-eye"></i>';
        });
    }

    if (btnToggleEyeConfirm) {
        btnToggleEyeConfirm.addEventListener("click", () => {
            const isPassword = inputConfirmPass.type === "password";
            inputConfirmPass.type = isPassword ? "text" : "password";
            btnToggleEyeConfirm.innerHTML = isPassword ? '<i class="fa-regular fa-eye-slash"></i>' : '<i class="fa-regular fa-eye"></i>';
        });
    }

    // Alternar Tabs Login vs Registro
    function setAuthMode(register) {
        isRegisterMode = register;
        if (register) {
            tabRegister.classList.add("active");
            tabRegister.style.background = "var(--accent-primary)";
            tabRegister.style.color = "#fff";
            tabLogin.classList.remove("active");
            tabLogin.style.background = "transparent";
            tabLogin.style.color = "var(--text-secondary)";

            authTitle.textContent = "Crear Mi Cuenta";
            authDesc.textContent = "Regístrate con tu correo y contraseña para gestionar tus propias ligas.";
            groupConfirmPass.style.display = "block";
            inputConfirmPass.required = true;
            btnAuthText.innerHTML = '<i class="fa-solid fa-user-plus"></i> Registrar y Crear Cuenta';
        } else {
            tabLogin.classList.add("active");
            tabLogin.style.background = "var(--accent-primary)";
            tabLogin.style.color = "#fff";
            tabRegister.classList.remove("active");
            tabRegister.style.background = "transparent";
            tabRegister.style.color = "var(--text-secondary)";

            authTitle.textContent = "Bienvenido a LigaApp";
            authDesc.textContent = "Inicia sesión para gestionar tus torneos de forma privada.";
            groupConfirmPass.style.display = "none";
            inputConfirmPass.required = false;
            btnAuthText.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i> Iniciar Sesión';
        }
    }

    if (tabLogin) tabLogin.addEventListener("click", () => setAuthMode(false));
    if (tabRegister) tabRegister.addEventListener("click", () => setAuthMode(true));

    // Submit de Autenticación / Registro (Solo Correo y Contraseñas)
    if (formAuthPortal) {
        formAuthPortal.addEventListener("submit", async (e) => {
            e.preventDefault();
            const email = (inputEmail.value || '').trim();
            const pass = (inputPass.value || '').trim();
            const confirmPass = (inputConfirmPass.value || '').trim();

            showLoader(isRegisterMode ? "Registrando tu cuenta..." : "Iniciando sesión...");

            try {
                if (isRegisterMode) {
                    await window.LigaAuthService.registerUser(email, pass, confirmPass);
                    if (window.Swal) {
                        Swal.fire({
                            icon: 'success',
                            title: '¡Cuenta Registrada Exitosamente!',
                            text: `Bienvenido. Tu cuenta (${email}) ha sido creada y activada.`,
                            timer: 2000,
                            showConfirmButton: false
                        });
                    }
                } else {
                    await window.LigaAuthService.loginUser(email, pass);
                }

                hideLoader();
                checkAuthStateAndLoad();

            } catch (err) {
                hideLoader();
                alert(err.message || "Error al autenticar");
            }
        });
    }

    // Inicio de Sesión con Google
    if (btnAuthGoogle) {
        btnAuthGoogle.addEventListener("click", async () => {
            try {
                showLoader("Conectando con Google...");
                await window.LigaAuthService.signInWithGoogle();
            } catch (err) {
                hideLoader();
                alert("Error al conectar con Google: " + (err.message || err));
            }
        });
    }

    // Comprobar retorno de Google OAuth al cargar
    if (window.LigaAuthService) {
        window.LigaAuthService.checkGoogleAuthCallback().then(gUser => {
            if (gUser) checkAuthStateAndLoad();
        });
    }

    // ==========================================
    // MODAL DE RECUPERACIÓN DE CONTRASEÑA POR CÓDIGO
    // ==========================================
    if (btnForgotPassword) {
        btnForgotPassword.addEventListener("click", () => {
            modalForgotPassword.style.display = "flex";
            forgotStepSend.style.display = "block";
            forgotStepVerify.style.display = "none";
            if (resetEmailInput && inputEmail) {
                resetEmailInput.value = inputEmail.value.trim();
            }
        });
    }

    if (btnCloseForgotModal) {
        btnCloseForgotModal.addEventListener("click", () => {
            modalForgotPassword.style.display = "none";
        });
    }

    if (formSendResetCode) {
        formSendResetCode.addEventListener("submit", async (e) => {
            e.preventDefault();
            const email = resetEmailInput.value.trim();
            activeResetEmail = email;

            showLoader("Generando código de seguridad...");
            try {
                const res = await window.LigaAuthService.requestPasswordResetCode(email);
                hideLoader();

                forgotStepSend.style.display = "none";
                forgotStepVerify.style.display = "block";

                resetCodeNotice.innerHTML = `
                    <div style="display:flex; flex-direction:column; gap:4px;">
                        <span><i class="fa-solid fa-check-circle"></i> Código de recuperación enviado a <strong>${email}</strong></span>
                        <span style="font-size:11.5px; color:#cbd5e1;">Código de seguridad: <strong style="color:#10b981; font-size:14px; letter-spacing:2px;">${res.code}</strong></span>
                    </div>
                `;

                if (window.Swal) {
                    Swal.fire({
                        icon: 'info',
                        title: 'Código Generado',
                        html: `Ingresa el código <strong>${res.code}</strong> para definir tu nueva contraseña.`,
                        confirmButtonColor: '#10b981'
                    });
                }

            } catch (err) {
                hideLoader();
                alert(err.message || "Error al solicitar código");
            }
        });
    }

    if (formVerifyResetCode) {
        formVerifyResetCode.addEventListener("submit", async (e) => {
            e.preventDefault();
            const code = document.getElementById("reset-code-input").value.trim();
            const newPass = document.getElementById("reset-new-pass").value.trim();
            const confirmPass = document.getElementById("reset-confirm-pass").value.trim();

            showLoader("Restableciendo tu contraseña...");
            try {
                await window.LigaAuthService.verifyCodeAndResetPassword(activeResetEmail, code, newPass, confirmPass);
                hideLoader();
                modalForgotPassword.style.display = "none";

                if (window.Swal) {
                    await Swal.fire({
                        icon: 'success',
                        title: '¡Contraseña Actualizada!',
                        text: 'Tu contraseña ha sido cambiada correctamente. Ahora puedes iniciar sesión.',
                        confirmButtonColor: '#10b981'
                    });
                } else {
                    alert("¡Contraseña actualizada con éxito!");
                }

                // Autocompletar con la nueva contraseña
                if (inputEmail) inputEmail.value = activeResetEmail;
                if (inputPass) inputPass.value = newPass;
                setAuthMode(false);

            } catch (err) {
                hideLoader();
                alert(err.message || "Error al restablecer contraseña");
            }
        });
    }

    if (btnLogout) {
        btnLogout.addEventListener("click", () => {
            if (confirm("¿Deseas cerrar tu sesión?")) {
                window.LigaAuthService.logout();
            }
        });
    }

    // Cargar torneos filtrados
    async function loadTournamentsData() {
        showLoader("Sincronizando tus torneos...");
        try {
            const { data: torneosData, error } = await supabase
                .from('torneos')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error("Error al cargar torneos:", error);
            } else {
                allDatabaseTorneos = torneosData || [];
                const currentSession = window.LigaAuthService.getCurrentSession();
                
                if (currentSession && currentSession.role !== 'publico') {
                    // Filtrar SOLO los que pertenecen al usuario autenticado
                    myTorneosList = await window.LigaAuthService.filterTorneosForCurrentUser(allDatabaseTorneos);
                } else {
                    // Modo invitado público
                    myTorneosList = [];
                }
            }
        } catch (e) {
            console.error("Error de conexión:", e);
        } finally {
            hideLoader();
        }
    }

    // Renderizar lista privada de torneos del usuario
    function renderUserTournaments() {
        tListContainer.innerHTML = '';
        const currentSession = window.LigaAuthService.getCurrentSession();
        if (!currentSession) return;

        if (myTorneosList.length === 0) {
            tListContainer.innerHTML = `
                <div style="background:rgba(16,185,129,0.04); border:1px dashed rgba(16,185,129,0.3); border-radius:18px; padding:35px 20px; text-align:center;">
                    <div style="width:60px; height:60px; border-radius:50%; background:rgba(16,185,129,0.15); color:#10b981; font-size:26px; display:flex; align-items:center; justify-content:center; margin:0 auto 16px auto;">
                        <i class="fa-solid fa-trophy"></i>
                    </div>
                    <h3 style="color:#fff; font-size:18px; margin:0 0 8px 0;">¡Aún no has creado ninguna liga!</h3>
                    <p style="color:var(--text-secondary); font-size:13.5px; max-width:420px; margin:0 auto 20px auto; line-height:1.5;">
                        Crea tu primer campeonato con tabla de posiciones automática, fixture de partidos y estadísticas oficiales.
                    </p>
                    <button type="button" onclick="document.getElementById('btn-create-new').click()" class="btn-primary" style="padding:12px 24px; font-size:14px; font-weight:700; border-radius:12px; display:inline-flex; align-items:center; gap:8px;">
                        <i class="fa-solid fa-plus-circle"></i> Crear Mi Primera Liga
                    </button>
                </div>
            `;
        } else {
            myTorneosList.forEach(t => {
                const card = document.createElement("div");
                card.style.background = 'var(--card-bg)';
                card.style.border = '1px solid var(--border-color)';
                card.style.borderRadius = 'var(--radius-lg)';
                card.style.padding = '20px';
                card.style.display = 'flex';
                card.style.justifyContent = 'space-between';
                card.style.alignItems = 'center';
                card.style.flexWrap = 'wrap';
                card.style.gap = '15px';

                const logoHtml = t.logo ? `<img src="${t.logo}" style="width:44px;height:44px;border-radius:12px;object-fit:cover;flex-shrink:0;border:1px solid rgba(255,255,255,0.1);">` : `<i class="fa-solid fa-futbol" style="font-size:32px; color:var(--accent-primary);flex-shrink:0;"></i>`;

                card.innerHTML = `
                    <div style="display:flex; align-items:center; gap:15px; text-align:left; flex: 1 1 200px; overflow: hidden;">
                        ${logoHtml}
                        <div style="overflow: hidden;">
                            <div style="display:flex; align-items:center; gap:6px;">
                                <h3 style="font-size:15px; margin:0; color:var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${t.nombre}</h3>
                                <span style="font-size:9.5px; padding:2px 6px; border-radius:10px; background:rgba(16,185,129,0.2); color:#10b981; font-weight:700;">PROPIETARIO</span>
                            </div>
                            <p style="font-size:12px; margin:3px 0 0 0; color:var(--text-secondary);">${t.tipo_torneo === 'unico' ? 'Torneo Único' : 'Torneo Dual'} &bull; Temporada ${t.anio_actual}</p>
                        </div>
                    </div>
                    <div style="display:flex; gap:10px; flex: 1 1 auto; justify-content: flex-end;">
                        <button class="btn-start-t" data-id="${t.id}" style="flex:1; background:var(--accent-primary); border:none; color:#fff; padding:10px 18px; border-radius:var(--radius-md); cursor:pointer; font-weight:700; display:flex; align-items:center; justify-content:center; gap:6px;">
                            <i class="fa-solid fa-play"></i> Administrar
                        </button>
                        <button class="btn-delete-t" data-id="${t.id}" title="Eliminar Torneo" style="background:transparent; border:1px solid #EF4444; color:#EF4444; padding:10px 14px; border-radius:var(--radius-md); cursor:pointer; font-weight:600;">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                `;
                tListContainer.appendChild(card);
            });
        }

        if (myTorneosList.length >= 2) {
            btnCreateNew.style.display = 'none';
            limitMsg.style.display = 'block';
        } else {
            btnCreateNew.style.display = 'inline-block';
            limitMsg.style.display = 'none';
        }

        // Listeners Administrar y Eliminar
        document.querySelectorAll('.btn-start-t').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                localStorage.setItem('femfutpal_active_id', id);
                localStorage.setItem('activeTorneoId', id);
                window.location.href = 'panel.html';
            });
        });

        document.querySelectorAll('.btn-delete-t').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                if (confirm("¿Estás seguro de que deseas eliminar este torneo? Se borrarán permanentemente sus equipos, partidos y estadísticas en la nube.")) {
                    showLoader("Eliminando torneo...");
                    try {
                        await window.LigaAuthService.deleteTorneoPermanently(id);
                        await loadTournamentsData();
                        renderUserTournaments();
                        renderPublicTournaments();
                    } catch (err) {
                        alert(err.message || "Error al eliminar");
                    } finally {
                        hideLoader();
                    }
                }
            });
        });
    }

    // Renderizar sección: Ver Todos los Torneos de la Comunidad (En Login y en Mis Torneos)
    function renderPublicTournaments() {
        const renderListInContainer = (container) => {
            if (!container) return;
            if (allDatabaseTorneos.length === 0) {
                container.innerHTML = '<p style="color:#64748b; font-size:12px; text-align:center;">No hay torneos registrados en la plataforma.</p>';
                return;
            }

            container.innerHTML = allDatabaseTorneos.map(t => {
                const logoHtml = t.logo ? `<img src="${t.logo}" style="width:34px;height:34px;border-radius:8px;object-fit:cover;">` : `<i class="fa-solid fa-futbol" style="color:#10b981; font-size:22px;"></i>`;
                return `
                    <div style="padding:12px 14px; border-radius:12px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.08); display:flex; justify-content:space-between; align-items:center; gap:10px;">
                        <div style="display:flex; align-items:center; gap:12px; text-align:left;">
                            ${logoHtml}
                            <div>
                                <h4 style="margin:0; font-size:13.5px; color:#fff;">${t.nombre}</h4>
                                <p style="margin:2px 0 0 0; font-size:11px; color:#94a3b8;">${t.tipo_torneo === 'unico' ? 'Torneo Único' : 'Torneo Dual'} &bull; Año ${t.anio_actual}</p>
                            </div>
                        </div>
                        <button type="button" class="btn-public-view" data-id="${t.id}" style="padding:7px 14px; border-radius:8px; font-size:12px; font-weight:700; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); color:#fff; cursor:pointer; transition:all 0.2s;">
                            <i class="fa-solid fa-eye"></i> Ver Torneo
                        </button>
                    </div>
                `;
            }).join('');

            container.querySelectorAll('.btn-public-view').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-id');
                    localStorage.setItem('femfutpal_active_id', id);
                    localStorage.setItem('activeTorneoId', id);
                    const currentSession = window.LigaAuthService ? window.LigaAuthService.getCurrentSession() : null;
                    const isMine = myTorneosList.some(m => m.id.toString() === id.toString());
                    if (!isMine || !currentSession) {
                        localStorage.setItem('ligaapp_active_role', 'publico');
                    }
                    window.location.href = 'panel.html';
                });
            });
        };

        renderListInContainer(publicTournamentsList);
        renderListInContainer(rootPublicTournaments);
    }

    // Toggle para mostrar/ocultar torneos públicos en pantalla de Login
    if (btnExplorePublicRoot && rootPublicTournaments) {
        btnExplorePublicRoot.addEventListener("click", () => {
            const isHidden = rootPublicTournaments.style.display === "none";
            rootPublicTournaments.style.display = isHidden ? "flex" : "none";
            btnExplorePublicRoot.innerHTML = isHidden 
                ? '<i class="fa-solid fa-chevron-up" style="color:#10b981;"></i> Ocultar torneos de la comunidad' 
                : '<i class="fa-solid fa-earth-americas" style="color:#10b981;"></i> Ver torneos creados por otros usuarios';
        });
    }

    // Toggle para mostrar/ocultar todos los torneos públicos en Mis Torneos
    if (btnTogglePublicExplore && publicTournamentsList) {
        btnTogglePublicExplore.addEventListener("click", () => {
            const isHidden = publicTournamentsList.style.display === "none";
            publicTournamentsList.style.display = isHidden ? "flex" : "none";
            btnTogglePublicExplore.innerHTML = isHidden 
                ? '<i class="fa-solid fa-chevron-up"></i> Ocultar Torneos de la Comunidad' 
                : '<i class="fa-solid fa-globe"></i> Ver Todos los Torneos de la Comunidad';
        });
    }

    // Comprobar estado de sesión al entrar a index.html
    async function checkAuthStateAndLoad() {
        const session = window.LigaAuthService.getCurrentSession();
        if (session) {
            stepAuth.classList.remove("active");
            step0.classList.add("active");
            if (userLoggedName) {
                userLoggedName.textContent = session.nombre || session.username;
            }
            await loadTournamentsData();
            renderUserTournaments();
            renderPublicTournaments();
        } else {
            stepAuth.classList.add("active");
            step0.classList.remove("active");
            step1.classList.remove("active");
            step2.classList.remove("active");
            // Cargar y mostrar lista pública disponible en el login
            await loadTournamentsData();
            renderPublicTournaments();
        }
    }

    await checkAuthStateAndLoad();

    // ==========================================
    // WIZARD DE CREACIÓN DE NUEVO TORNEO (PASO 1 Y 2)
    // ==========================================
    const cards = document.querySelectorAll(".setup-card");
    const yearInput = document.getElementById("setup-year");
    const btnNext = document.getElementById("btn-next-step");
    const btnPrev = document.getElementById("btn-prev-step");
    const btnStart = document.getElementById("btn-start-setup");

    const inputName = document.getElementById("setup-name");
    const inputLugar = document.getElementById("setup-lugar");
    const inputCampo = document.getElementById("setup-campo");
    const inputCelular = document.getElementById("setup-celular");
    const inputLogo = document.getElementById("setup-logo");
    const inputPortada = document.getElementById("setup-portada");
    const previewLogo = document.getElementById("preview-logo");
    const previewPortada = document.getElementById("preview-portada");

    let logoDataUrl = '';
    let portadaDataUrl = '';
    let selectedType = null;

    if (btnCreateNew) {
        btnCreateNew.addEventListener("click", () => {
            step0.classList.remove("active");
            step1.classList.add("active");
        });
    }

    cards.forEach(card => {
        card.addEventListener("click", () => {
            cards.forEach(c => c.classList.remove("active"));
            card.classList.add("active");
            selectedType = card.getAttribute("data-type");
        });
    });

    function handleImageUpload(input, previewElement, callback) {
        if (!input) return;
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

    if (btnNext) {
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
    }

    if (btnPrev) {
        btnPrev.addEventListener("click", () => {
            step2.classList.remove("active");
            step1.classList.add("active");
        });
    }

    // Iniciar y Crear Torneo asignándolo al Propietario Autenticado
    if (btnStart) {
        btnStart.addEventListener("click", async () => {
            const currentSession = window.LigaAuthService.getCurrentSession();
            if (!currentSession || currentSession.role === 'publico') {
                alert("Debes iniciar sesión con tu cuenta para crear una liga.");
                window.location.reload();
                return;
            }

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

            showLoader("Creando torneo en tu cuenta...");

            try {
                // 1. Insertar el torneo en Supabase
                const { error } = await supabase
                    .from('torneos')
                    .insert([nuevoTorneo]);

                if (error) throw error;

                // 2. Vincular el torneo al usuario propietario en la nube
                await window.LigaAuthService.assignTorneoOwner(newId, currentSession, nombreTorneo);

                hideLoader();

                localStorage.setItem('femfutpal_active_id', newId.toString());
                localStorage.setItem('activeTorneoId', newId.toString());
                localStorage.setItem('ligaapp_active_role', 'admin');

                window.location.href = 'panel.html';

            } catch (err) {
                hideLoader();
                console.error("Error al crear torneo:", err);
                alert("Hubo un error al crear el torneo: " + (err.message || err));
            }
        });
    }
});
