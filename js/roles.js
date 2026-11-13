/**
 * roles.js - Sistema Integral de Gestión de Cuentas, Roles y Permisos para LigaApp
 * 
 * Roles soportados:
 *  - admin: Control absoluto e institucional (solo él puede ver y gestionar cuentas/contraseñas).
 *  - moderador: Asistente del admin. Puede gestionar partidos, equipos y estadísticas,
 *               pero NO puede borrar torneos, ni modificar cuentas, ni alterar datos de la liga.
 *  - arbitro: Match center, actas de partidos en vivo, alineaciones, goles y tarjetas.
 *  - delegado: Gestión de plantilla de su club asignado.
 *  - publico: Solo lectura (resultados, posiciones, líderes).
 */

(function () {
    const ROLE_STORAGE_KEY = 'ligaapp_active_role';
    const ROLE_USER_KEY = 'ligaapp_auth_user';
    const ROLE_TEAM_KEY = 'ligaapp_delegado_team';
    const USERS_CACHE_KEY = 'ligaapp_users_accounts';

    // Roles y sus descripciones/estilos
    const ROLES_INFO = {
        publico: {
            id: 'publico',
            nombre: 'Modo Público',
            icon: 'fa-eye',
            color: '#94a3b8',
            badgeBg: 'rgba(148, 163, 184, 0.15)',
            badgeBorder: 'rgba(148, 163, 184, 0.3)',
            desc: 'Consulta de tablas, resultados y estadísticas.'
        },
        admin: {
            id: 'admin',
            nombre: 'Administrador General',
            icon: 'fa-shield-halved',
            color: '#10b981',
            badgeBg: 'rgba(16, 185, 129, 0.15)',
            badgeBorder: 'rgba(16, 185, 129, 0.4)',
            desc: 'Control institucional total y gestión de usuarios.'
        },
        moderador: {
            id: 'moderador',
            nombre: 'Moderador / Asistente',
            icon: 'fa-user-gear',
            color: '#8b5cf6',
            badgeBg: 'rgba(139, 92, 246, 0.15)',
            badgeBorder: 'rgba(139, 92, 246, 0.4)',
            desc: 'Apoyo en calendario, estadísticas y equipos (sin permisos destructivos).'
        },
        arbitro: {
            id: 'arbitro',
            nombre: 'Árbitro / Mesa',
            icon: 'fa-stopwatch',
            color: '#f59e0b',
            badgeBg: 'rgba(245, 158, 11, 0.15)',
            badgeBorder: 'rgba(245, 158, 11, 0.4)',
            desc: 'Marcador en vivo, alineaciones y actas arbitrales.'
        },
        delegado: {
            id: 'delegado',
            nombre: 'Delegado / DT',
            icon: 'fa-user-tie',
            color: '#3b82f6',
            badgeBg: 'rgba(59, 130, 246, 0.15)',
            badgeBorder: 'rgba(59, 130, 246, 0.4)',
            desc: 'Gestión de plantilla e inscripción de jugadores de su equipo.'
        }
    };

    // Cuentas por defecto si la base de datos está vacía
    const DEFAULT_ACCOUNTS = [
        {
            id: 'acc_master_admin',
            username: 'admin',
            password: '123',
            nombre: 'Presidente / Admin General',
            role: 'admin',
            teamId: null,
            created_at: new Date().toISOString()
        },
        {
            id: 'acc_mod_1',
            username: 'moderador',
            password: 'mod',
            nombre: 'Asistente de Torneo',
            role: 'moderador',
            teamId: null,
            created_at: new Date().toISOString()
        },
        {
            id: 'acc_arb_1',
            username: 'arbitro',
            password: '202',
            nombre: 'Colegio de Árbitros',
            role: 'arbitro',
            teamId: null,
            created_at: new Date().toISOString()
        }
    ];

    function getActiveRole() {
        return localStorage.getItem(ROLE_STORAGE_KEY) || 'publico';
    }

    function getAuthUser() {
        try {
            const raw = localStorage.getItem(ROLE_USER_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function getDelegadoTeam() {
        return localStorage.getItem(ROLE_TEAM_KEY) || null;
    }

    function setSession(roleId, userObj = null, teamId = null) {
        if (!ROLES_INFO[roleId]) roleId = 'publico';
        localStorage.setItem(ROLE_STORAGE_KEY, roleId);
        if (userObj) {
            localStorage.setItem(ROLE_USER_KEY, JSON.stringify(userObj));
        } else {
            localStorage.removeItem(ROLE_USER_KEY);
        }

        if (teamId) {
            localStorage.setItem(ROLE_TEAM_KEY, teamId);
        } else if (roleId !== 'delegado') {
            localStorage.removeItem(ROLE_TEAM_KEY);
        }

        applyRolePermissions();
        updateRoleUI();
    }

    function logout() {
        if (window.supabase && window.supabase.auth) {
            try { window.supabase.auth.signOut(); } catch (e) {}
        }
        setSession('publico', null, null);
        if (window.Swal) {
            Swal.fire({
                icon: 'info',
                title: 'Sesión Cerrada',
                text: 'Has regresado al Modo Público (Solo Lectura).',
                timer: 1600,
                showConfirmButton: false
            });
        }
    }

    // ==========================================
    // SINCRONIZACIÓN DE USUARIOS EN LA NUBE
    // ==========================================
    async function loadAccountsFromCloud() {
        let accounts = [...DEFAULT_ACCOUNTS];
        const activeTorneoId = localStorage.getItem('activeTorneoId');

        try {
            if (window.supabase) {
                let query = window.supabase
                    .from('movimientos')
                    .select('*')
                    .eq('tipo', 'USER_ACCOUNT');

                if (activeTorneoId) {
                    query = query.eq('torneo_id', activeTorneoId);
                }

                const { data, error } = await query;
                if (!error && data && data.length > 0) {
                    const cloudUsers = [];
                    data.forEach(row => {
                        try {
                            const parsed = typeof row.fecha === 'string' ? JSON.parse(row.fecha) : row.fecha;
                            if (parsed && parsed.username) {
                                cloudUsers.push({
                                    id: row.id.toString(),
                                    username: parsed.username,
                                    password: parsed.password || '123',
                                    nombre: parsed.nombre || parsed.username,
                                    role: parsed.role || 'arbitro',
                                    teamId: parsed.teamId || null,
                                    created_at: row.created_at
                                });
                            }
                        } catch (e) {}
                    });

                    if (cloudUsers.length > 0) {
                        accounts = cloudUsers;
                    }
                }
            }
        } catch (err) {
            console.warn('Error cargando usuarios de la nube, usando caché local:', err);
        }

        // Cachear localmente
        localStorage.setItem(USERS_CACHE_KEY, JSON.stringify(accounts));
        return accounts;
    }

    function getCachedAccounts() {
        try {
            const raw = localStorage.getItem(USERS_CACHE_KEY);
            return raw ? JSON.parse(raw) : [...DEFAULT_ACCOUNTS];
        } catch (e) {
            return [...DEFAULT_ACCOUNTS];
        }
    }

    async function saveAccountToCloud(userObj) {
        const activeTorneoId = localStorage.getItem('activeTorneoId');
        let currentAccounts = getCachedAccounts();

        const existingIdx = currentAccounts.findIndex(u => u.username.toLowerCase() === userObj.username.toLowerCase() || u.id === userObj.id);
        if (existingIdx >= 0) {
            currentAccounts[existingIdx] = { ...currentAccounts[existingIdx], ...userObj };
        } else {
            currentAccounts.push(userObj);
        }
        localStorage.setItem(USERS_CACHE_KEY, JSON.stringify(currentAccounts));

        // Persistir en Supabase
        try {
            if (window.supabase && activeTorneoId) {
                const numericId = parseInt(userObj.id.replace(/\D/g, '') || Date.now().toString().slice(-8));
                const payload = {
                    id: numericId,
                    torneo_id: activeTorneoId,
                    tipo: 'USER_ACCOUNT',
                    fecha: JSON.stringify({
                        username: userObj.username,
                        password: userObj.password,
                        nombre: userObj.nombre,
                        role: userObj.role,
                        teamId: userObj.teamId || null
                    })
                };
                await window.supabase.from('movimientos').upsert([payload]);
            }
        } catch (err) {
            console.error('Error guardando usuario en nube:', err);
        }

        renderAccountsList();
    }

    async function deleteAccountFromCloud(userId, username) {
        let currentAccounts = getCachedAccounts().filter(u => u.id !== userId && u.username !== username);
        localStorage.setItem(USERS_CACHE_KEY, JSON.stringify(currentAccounts));

        try {
            if (window.supabase) {
                const numericId = parseInt(userId.replace(/\D/g, '') || '0');
                if (numericId > 0) {
                    await window.supabase.from('movimientos').delete().eq('id', numericId);
                }
            }
        } catch (err) {
            console.error('Error eliminando usuario en nube:', err);
        }

        renderAccountsList();
    }

    // ==========================================
    // RENDERIZADO DEL PANEL DE USUARIOS (SOLO ADMIN)
    // ==========================================
    function renderAccountsList() {
        const listContainer = document.getElementById('admin-users-list');
        if (!listContainer) return;

        const currentRole = getActiveRole();
        if (currentRole !== 'admin') {
            listContainer.innerHTML = '<p style="color:#ef4444; font-size:12px;">Solo el Administrador General puede ver las cuentas del sistema.</p>';
            return;
        }

        const accounts = getCachedAccounts();

        if (accounts.length === 0) {
            listContainer.innerHTML = '<p style="color:#94a3b8; font-size:12px; text-align:center;">No hay cuentas creadas aún.</p>';
            return;
        }

        listContainer.innerHTML = accounts.map(u => {
            const roleMeta = ROLES_INFO[u.role] || ROLES_INFO.arbitro;
            const isMaster = u.username.toLowerCase() === 'admin';
            let teamLabel = '';
            if (u.role === 'delegado' && u.teamId && window.appData?.equipos) {
                const eq = window.appData.equipos.find(t => t.id == u.teamId);
                if (eq) teamLabel = `<span style="font-size:10px; color:#60a5fa; background:rgba(59,130,246,0.15); padding:2px 6px; border-radius:4px; margin-left:6px;"><i class="fa-solid fa-shield-halved"></i> ${eq.nombre}</span>`;
            }

            return `
                <div class="user-account-row" style="padding:12px 14px; border-radius:12px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); display:flex; justify-content:space-between; align-items:center; gap:12px;">
                    <div style="display:flex; align-items:center; gap:12px; min-width:0;">
                        <div style="width:36px; height:36px; border-radius:10px; background:${roleMeta.badgeBg}; border:1px solid ${roleMeta.badgeBorder}; color:${roleMeta.color}; display:flex; align-items:center; justify-content:center; font-size:15px; flex-shrink:0;">
                            <i class="fa-solid ${roleMeta.icon}"></i>
                        </div>
                        <div style="min-width:0;">
                            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                                <strong style="color:#fff; font-size:13.5px;">${u.nombre || u.username}</strong>
                                <span style="font-size:9.5px; padding:2px 8px; border-radius:12px; background:${roleMeta.badgeBg}; color:${roleMeta.color}; font-weight:700; text-transform:uppercase;">
                                    ${roleMeta.nombre}
                                </span>
                                ${teamLabel}
                            </div>
                            <div style="display:flex; align-items:center; gap:14px; margin-top:3px; font-size:11.5px; color:#94a3b8;">
                                <span><i class="fa-solid fa-user" style="color:#64748b;"></i> Usuario: <strong style="color:#cbd5e1;">${u.username}</strong></span>
                                <span><i class="fa-solid fa-key" style="color:#64748b;"></i> Clave: <span style="font-family:monospace; background:rgba(0,0,0,0.3); padding:2px 6px; border-radius:4px; color:#34d399; font-weight:700;">${u.password}</span></span>
                            </div>
                        </div>
                    </div>

                    <div style="display:flex; gap:6px; flex-shrink:0;">
                        ${!isMaster ? `
                            <button type="button" class="btn-action btn-delete-user" data-id="${u.id}" data-user="${u.username}" title="Eliminar Cuenta" style="background:rgba(239,68,68,0.2); color:#f87171; border:1px solid rgba(239,68,68,0.3); padding:6px 10px; border-radius:8px; cursor:pointer; font-size:12px;">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        ` : '<span style="font-size:10.5px; color:#10b981; font-weight:700;"><i class="fa-solid fa-lock"></i> Principal</span>'}
                    </div>
                </div>
            `;
        }).join('');

        // Listeners para eliminar usuario
        listContainer.querySelectorAll('.btn-delete-user').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const user = btn.getAttribute('data-user');
                if (confirm(`¿Estás seguro de eliminar el usuario "${user}"?`)) {
                    deleteAccountFromCloud(id, user);
                }
            });
        });
    }

    // Modal de Crear Nuevo Rol / Cuenta
    function openCreateRoleModal() {
        const teams = window.appData?.equipos || [];
        const modalHtml = `
            <div class="modal-overlay active" id="modal-crear-rol" style="display:flex; z-index:999999; backdrop-filter:blur(10px); background:rgba(0,0,0,0.75);">
                <div class="modal-content" style="max-width:440px; width:92%; background:#0f172a; border:1px solid rgba(255,255,255,0.15); border-radius:22px; box-shadow:0 30px 60px rgba(0,0,0,0.85); overflow:hidden;">
                    <div class="modal-header" style="background:rgba(30,41,59,0.7); border-bottom:1px solid rgba(255,255,255,0.08); padding:18px 22px; display:flex; justify-content:space-between; align-items:center;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <div style="width:36px; height:36px; border-radius:10px; background:linear-gradient(135deg, #10b981, #059669); display:flex; align-items:center; justify-content:center; color:#fff; font-size:16px;">
                                <i class="fa-solid fa-user-plus"></i>
                            </div>
                            <h3 style="margin:0; font-size:17px; color:#fff; font-family:'Outfit', sans-serif;">Crear Cuenta de Rol</h3>
                        </div>
                        <button type="button" class="close-btn" id="close-crear-rol-modal" style="background:none; border:none; color:#94a3b8; font-size:18px; cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
                    </div>

                    <div class="modal-body" style="padding:22px;">
                        <form id="form-nuevo-usuario-rol">
                            <div class="form-group" style="margin-bottom:14px;">
                                <label style="display:block; font-size:12px; font-weight:600; color:#cbd5e1; margin-bottom:6px;">Nombre / Identificación</label>
                                <input type="text" id="new-user-nombre" placeholder="Ej: Prof. Carlos (Árbitro Principal)" class="form-control" required style="width:100%; box-sizing:border-box; padding:10px 12px; border-radius:10px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.15); color:#fff;">
                            </div>

                            <div class="form-group" style="margin-bottom:14px;">
                                <label style="display:block; font-size:12px; font-weight:600; color:#cbd5e1; margin-bottom:6px;">Rol de Permisos</label>
                                <select id="new-user-role" class="form-control" required style="width:100%; padding:10px 12px; border-radius:10px; background:rgba(15,23,42,0.95); border:1px solid rgba(255,255,255,0.15); color:#fff; font-weight:600;">
                                    <option value="admin">👑 Administrador General (Control Total)</option>
                                    <option value="moderador" selected>⚡ Moderador / Asistente (Apoyo sin permisos destructivos)</option>
                                    <option value="arbitro">⏱️ Árbitro / Mesa (Match Center y Actas)</option>
                                    <option value="delegado">🛡️ Delegado de Club (Solo su Equipo)</option>
                                </select>
                            </div>

                            <div class="form-group" id="delegado-select-team-group" style="display:none; margin-bottom:14px; background:rgba(59,130,246,0.08); padding:10px; border-radius:10px; border:1px solid rgba(59,130,246,0.3);">
                                <label style="display:block; font-size:12px; font-weight:600; color:#60a5fa; margin-bottom:4px;">Asignar Equipo al Delegado</label>
                                <select id="new-user-team" class="form-control" style="width:100%; padding:8px 10px; border-radius:8px; background:#0f172a; border:1px solid rgba(255,255,255,0.15); color:#fff;">
                                    <option value="">Selecciona el club...</option>
                                    ${teams.map(t => `<option value="${t.id}">${t.nombre}</option>`).join('')}
                                </select>
                            </div>

                            <div class="form-group" style="margin-bottom:14px;">
                                <label style="display:block; font-size:12px; font-weight:600; color:#cbd5e1; margin-bottom:6px;">Nombre de Usuario (Para iniciar sesión)</label>
                                <input type="text" id="new-user-username" placeholder="Ej: arbitro2, mod_juan" class="form-control" required autocomplete="off" style="width:100%; box-sizing:border-box; padding:10px 12px; border-radius:10px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.15); color:#fff;">
                            </div>

                            <div class="form-group" style="margin-bottom:20px;">
                                <label style="display:block; font-size:12px; font-weight:600; color:#cbd5e1; margin-bottom:6px;">Definir Contraseña</label>
                                <input type="text" id="new-user-password" placeholder="Define la clave de acceso..." class="form-control" required style="width:100%; box-sizing:border-box; padding:10px 12px; border-radius:10px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.15); color:#34d399; font-weight:700;">
                            </div>

                            <button type="submit" class="btn-primary" style="width:100%; padding:12px; font-size:13.5px; font-weight:700; border-radius:10px; background:linear-gradient(135deg, #10b981 0%, #059669 100%); cursor:pointer;">
                                <i class="fa-solid fa-floppy-disk"></i> Guardar y Habilitar Cuenta
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        `;

        const existing = document.getElementById('modal-crear-rol');
        if (existing) existing.remove();

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const modal = document.getElementById('modal-crear-rol');
        const roleSelect = document.getElementById('new-user-role');
        const teamGroup = document.getElementById('delegado-select-team-group');
        const form = document.getElementById('form-nuevo-usuario-rol');

        roleSelect.addEventListener('change', () => {
            teamGroup.style.display = (roleSelect.value === 'delegado') ? 'block' : 'none';
        });

        const closeModal = () => modal.remove();
        document.getElementById('close-crear-rol-modal').addEventListener('click', closeModal);

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nombre = document.getElementById('new-user-nombre').value.trim();
            const role = roleSelect.value;
            const username = document.getElementById('new-user-username').value.trim().toLowerCase();
            const password = document.getElementById('new-user-password').value.trim();
            const teamId = (role === 'delegado') ? document.getElementById('new-user-team').value : null;

            if (!username || !password) return;

            const newAccount = {
                id: 'acc_' + Date.now().toString().slice(-6),
                username,
                password,
                nombre,
                role,
                teamId,
                created_at: new Date().toISOString()
            };

            await saveAccountToCloud(newAccount);
            closeModal();

            if (window.Swal) {
                Swal.fire({
                    icon: 'success',
                    title: 'Cuenta Creada',
                    text: `El usuario "${username}" ha sido registrado exitosamente con rol de ${ROLES_INFO[role].nombre}.`,
                    timer: 2000,
                    showConfirmButton: false
                });
            }
        });
    }

    // ==========================================
    // APLICACIÓN DE PERMISOS
    // ==========================================
    function applyRolePermissions() {
        const currentRole = getActiveRole();
        document.body.setAttribute('data-user-role', currentRole);

        // Control de botón Admin en navegación lateral (SOLO ADMIN Y MODERADOR)
        const btnAdmin = document.getElementById('btn-open-admin');
        if (btnAdmin) btnAdmin.style.display = (currentRole === 'admin' || currentRole === 'moderador') ? 'flex' : 'none';

        // Pestaña de Roles en el modal de admin (SOLO ADMIN)
        const tabRoles = document.querySelector('.admin-tab[data-target="admin-roles"], .admin-tab-btn[data-target="admin-roles"]');
        if (tabRoles) tabRoles.style.display = (currentRole === 'admin') ? 'flex' : 'none';

        // Botón Finalizar Apertura (SOLO ADMIN)
        const btnFinishApertura = document.getElementById('btn-finish-apertura');
        if (btnFinishApertura) btnFinishApertura.style.display = (currentRole === 'admin') ? 'inline-flex' : 'none';

        // Botón circular (+) de nuevo calendario y eliminar calendario
        const btnNuevoCal = document.getElementById('btn-nuevo-calendario');
        const btnEliminarCal = document.getElementById('btn-eliminar-calendario');
        const hasCalendars = window.calendariosDisponibles && window.calendariosDisponibles.length > 0;
        const canManageCal = (currentRole === 'admin' || currentRole === 'moderador');

        if (btnNuevoCal) btnNuevoCal.style.display = (canManageCal && hasCalendars) ? 'flex' : 'none';
        if (btnEliminarCal) btnEliminarCal.style.display = (currentRole === 'admin' && hasCalendars) ? 'flex' : 'none';

        let styleTag = document.getElementById('ligaapp-role-styles');
        if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = 'ligaapp-role-styles';
            document.head.appendChild(styleTag);
        }

        if (currentRole === 'publico') {
            styleTag.textContent = `
                body[data-user-role="publico"] #btn-open-admin,
                body[data-user-role="publico"] #btn-finish-apertura,
                body[data-user-role="publico"] #btn-nuevo-calendario,
                body[data-user-role="publico"] #btn-eliminar-calendario,
                body[data-user-role="publico"] #btn-delete-team,
                body[data-user-role="publico"] #btn-inline-add-player,
                body[data-user-role="publico"] #btn-team-options-menu,
                body[data-user-role="publico"] #btn-quick-add-team,
                body[data-user-role="publico"] #btn-add-tarjeta,
                body[data-user-role="publico"] .btn-action,
                body[data-user-role="publico"] .btn-inline-edit,
                body[data-user-role="publico"] .btn-inline-delete,
                body[data-user-role="publico"] .btn-inline-transfer,
                body[data-user-role="publico"] .btn-match-edit,
                body[data-user-role="publico"] .match-card-actions,
                body[data-user-role="publico"] .btn-card-action {
                    display: none !important;
                }
            `;
        } else if (currentRole === 'moderador') {
            // El moderador puede gestionar estadísticas, editar partidos y agregar jugadores,
            // pero NO puede borrar equipos completos, ni finalizar apertura, ni gestionar usuarios/cuentas.
            styleTag.textContent = `
                body[data-user-role="moderador"] #btn-finish-apertura,
                body[data-user-role="moderador"] #btn-delete-team,
                body[data-user-role="moderador"] #btn-eliminar-calendario,
                body[data-user-role="moderador"] .admin-tab[data-target="admin-roles"],
                body[data-user-role="moderador"] .admin-tab-btn[data-target="admin-roles"],
                body[data-user-role="moderador"] #admin-roles {
                    display: none !important;
                }
            `;
        } else if (currentRole === 'arbitro') {
            styleTag.textContent = `
                body[data-user-role="arbitro"] #btn-open-admin,
                body[data-user-role="arbitro"] #btn-finish-apertura,
                body[data-user-role="arbitro"] #btn-nuevo-calendario,
                body[data-user-role="arbitro"] #btn-eliminar-calendario,
                body[data-user-role="arbitro"] #btn-delete-team,
                body[data-user-role="arbitro"] #btn-team-options-menu,
                body[data-user-role="arbitro"] #btn-quick-add-team {
                    display: none !important;
                }
            `;
        } else if (currentRole === 'delegado') {
            styleTag.textContent = `
                body[data-user-role="delegado"] #btn-open-admin,
                body[data-user-role="delegado"] #btn-finish-apertura,
                body[data-user-role="delegado"] #btn-nuevo-calendario,
                body[data-user-role="delegado"] #btn-eliminar-calendario,
                body[data-user-role="delegado"] #btn-delete-team,
                body[data-user-role="delegado"] #btn-quick-add-team,
                body[data-user-role="delegado"] .match-card-actions {
                    display: none !important;
                }
            `;
        } else {
            styleTag.textContent = '';
        }
    }

    // Actualizar visual del usuario en la cabecera
    function updateRoleUI() {
        const currentRole = getActiveRole();
        const user = getAuthUser();
        const roleData = ROLES_INFO[currentRole] || ROLES_INFO.publico;
        const profileBox = document.querySelector('.user-profile');

        if (!profileBox) return;

        profileBox.style.cursor = 'pointer';

        if (currentRole === 'publico') {
            profileBox.title = 'Hacer clic para Iniciar Sesión';
            profileBox.innerHTML = `
                <div class="avatar" style="background: rgba(148, 163, 184, 0.15); border: 1px solid rgba(148, 163, 184, 0.3); color: #94a3b8;">
                    <i class="fa-solid fa-lock"></i>
                </div>
                <div style="display:flex; flex-direction:column; text-align:left; line-height:1.15;">
                    <span style="font-weight:700; color:#fff; font-size:12.5px;">Acceso</span>
                    <span style="font-size:9.5px; color:#10b981; font-weight:700; letter-spacing:0.5px;">
                        <i class="fa-solid fa-arrow-right-to-bracket" style="font-size:8.5px;"></i> Iniciar Sesión
                    </span>
                </div>
            `;
        } else {
            profileBox.title = `Conectado como: ${roleData.nombre} (Clic para opciones)`;
            const iconClass = roleData.icon.startsWith('fa-') ? `fa-solid ${roleData.icon}` : 'fa-solid fa-user';
            const displayTitle = user?.nombre || user?.username || roleData.nombre;

            profileBox.innerHTML = `
                <div class="avatar" style="background:${roleData.badgeBg}; border:1px solid ${roleData.badgeBorder}; color:${roleData.color};">
                    <i class="${iconClass}"></i>
                </div>
                <div style="display:flex; flex-direction:column; text-align:left; line-height:1.15;">
                    <span style="font-weight:700; color:#fff; font-size:12.5px;">${displayTitle}</span>
                    <span style="font-size:9.5px; color:${roleData.color}; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">
                        ${roleData.nombre} <i class="fa-solid fa-chevron-down" style="font-size:8px;"></i>
                    </span>
                </div>
            `;
        }
    }

    // Modal de Iniciar Sesión
    function openLoginModal() {
        const currentRole = getActiveRole();

        if (currentRole !== 'publico') {
            const user = getAuthUser();
            const roleData = ROLES_INFO[currentRole];
            
            if (window.Swal) {
                Swal.fire({
                    title: `<span style="color:#fff; font-size:20px;">Sesión Activa</span>`,
                    html: `
                        <div style="text-align:center; margin-bottom:15px;">
                            <div style="width:50px; height:50px; border-radius:14px; background:${roleData.badgeBg}; border:1px solid ${roleData.badgeBorder}; color:${roleData.color}; display:flex; align-items:center; justify-content:center; font-size:22px; margin:0 auto 10px auto;">
                                <i class="fa-solid ${roleData.icon}"></i>
                            </div>
                            <h4 style="margin:0; color:#fff; font-size:16px;">${user?.nombre || user?.username}</h4>
                            <span style="font-size:11.5px; color:${roleData.color}; font-weight:700; text-transform:uppercase;">${roleData.nombre}</span>
                        </div>
                    `,
                    icon: 'info',
                    showCancelButton: true,
                    confirmButtonText: '<i class="fa-solid fa-arrow-right-from-bracket"></i> Cerrar Sesión',
                    cancelButtonText: 'Seguir Trabajando',
                    confirmButtonColor: '#ef4444',
                    cancelButtonColor: '#334155',
                    background: '#0f172a',
                    color: '#fff'
                }).then(result => {
                    if (result.isConfirmed) {
                        logout();
                    }
                });
            }
            return;
        }

        const modalHtml = `
            <div class="modal-overlay active" id="auth-login-modal" style="display:flex; z-index:999999; backdrop-filter:blur(10px); background:rgba(0,0,0,0.75);">
                <div class="modal-content" style="max-width:420px; width:92%; background:#0f172a; border:1px solid rgba(255,255,255,0.15); border-radius:22px; box-shadow:0 30px 60px rgba(0,0,0,0.85); overflow:hidden;">
                    
                    <div class="modal-header" style="background:rgba(30,41,59,0.7); border-bottom:1px solid rgba(255,255,255,0.08); padding:20px 24px; display:flex; justify-content:space-between; align-items:center;">
                        <div style="display:flex; align-items:center; gap:12px;">
                            <div style="width:38px; height:38px; border-radius:10px; background:linear-gradient(135deg, #10b981 0%, #059669 100%); display:flex; align-items:center; justify-content:center; color:#fff; font-size:16px;">
                                <i class="fa-solid fa-lock"></i>
                            </div>
                            <div>
                                <h3 style="margin:0; font-size:17px; color:#fff; font-family:'Outfit', sans-serif;">Iniciar Sesión</h3>
                                <p style="margin:2px 0 0 0; color:#94a3b8; font-size:11.5px;">Acceso administrativo, moderación y arbitraje</p>
                            </div>
                        </div>
                        <button type="button" class="close-btn" id="close-auth-modal" style="background:none; border:none; color:#94a3b8; font-size:18px; cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
                    </div>

                    <div class="modal-body" style="padding:24px;">
                        <form id="form-auth-login">
                            <div class="form-group" style="margin-bottom:16px;">
                                <label style="display:block; font-size:12.5px; font-weight:600; color:#cbd5e1; margin-bottom:6px;">
                                    <i class="fa-solid fa-user" style="color:#10b981; margin-right:4px;"></i> Usuario o Correo
                                </label>
                                <input type="text" id="auth-email-input" class="form-control" placeholder="Ingresa tu usuario..." required autocomplete="username" style="width:100%; box-sizing:border-box; padding:12px 14px; border-radius:10px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.15); color:#fff; font-size:14px;">
                            </div>

                            <div class="form-group" style="margin-bottom:20px;">
                                <label style="display:block; font-size:12.5px; font-weight:600; color:#cbd5e1; margin-bottom:6px;">
                                    <i class="fa-solid fa-key" style="color:#10b981; margin-right:4px;"></i> Contraseña
                                </label>
                                <div style="position:relative;">
                                    <input type="password" id="auth-password-input" class="form-control" placeholder="••••••••" required autocomplete="current-password" style="width:100%; box-sizing:border-box; padding:12px 42px 12px 14px; border-radius:10px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.15); color:#fff; font-size:14px;">
                                    <button type="button" id="toggle-auth-password" style="position:absolute; right:12px; top:50%; transform:translateY(-50%); background:none; border:none; color:#94a3b8; cursor:pointer; font-size:14px;">
                                        <i class="fa-regular fa-eye"></i>
                                    </button>
                                </div>
                                <small id="auth-error-msg" style="color:#ef4444; font-size:12px; display:none; margin-top:6px; font-weight:600;"></small>
                            </div>

                            <button type="submit" id="btn-submit-auth" class="btn-primary" style="width:100%; padding:13px; font-size:14px; font-weight:700; border-radius:12px; display:flex; align-items:center; justify-content:center; gap:8px; cursor:pointer; background:linear-gradient(135deg, #10b981 0%, #059669 100%);">
                                <span>Entrar al Sistema</span> <i class="fa-solid fa-arrow-right"></i>
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        `;

        const existing = document.getElementById('auth-login-modal');
        if (existing) existing.remove();

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const modal = document.getElementById('auth-login-modal');
        const emailInput = document.getElementById('auth-email-input');
        const passInput = document.getElementById('auth-password-input');
        const errorMsg = document.getElementById('auth-error-msg');
        const togglePassBtn = document.getElementById('toggle-auth-password');
        const form = document.getElementById('form-auth-login');
        const submitBtn = document.getElementById('btn-submit-auth');

        const closeModal = () => modal.remove();
        document.getElementById('close-auth-modal').addEventListener('click', closeModal);

        togglePassBtn.addEventListener('click', () => {
            const isPassword = passInput.type === 'password';
            passInput.type = isPassword ? 'text' : 'password';
            togglePassBtn.innerHTML = isPassword ? '<i class="fa-regular fa-eye-slash"></i>' : '<i class="fa-regular fa-eye"></i>';
        });

        emailInput.focus();

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            errorMsg.style.display = 'none';

            const identifier = (emailInput.value || '').trim().toLowerCase();
            const password = (passInput.value || '').trim();

            if (!identifier || !password) return;

            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verificando credenciales...';

            try {
                // Cargar cuentas actualizadas desde la nube
                const accounts = await loadAccountsFromCloud();
                const matchedUser = accounts.find(u => 
                    (u.username.toLowerCase() === identifier || (u.email && u.email.toLowerCase() === identifier)) &&
                    u.password === password
                );

                if (!matchedUser) {
                    throw new Error('Usuario o contraseña incorrectos.');
                }

                setSession(matchedUser.role, matchedUser, matchedUser.teamId);
                closeModal();

                if (window.Swal) {
                    Swal.fire({
                        icon: 'success',
                        title: `¡Bienvenido, ${matchedUser.nombre || matchedUser.username}!`,
                        text: `Has ingresado con permisos de: ${ROLES_INFO[matchedUser.role].nombre}`,
                        timer: 2000,
                        showConfirmButton: false
                    });
                }

            } catch (err) {
                errorMsg.textContent = err.message || 'Error al iniciar sesión.';
                errorMsg.style.display = 'block';
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<span>Entrar al Sistema</span> <i class="fa-solid fa-arrow-right"></i>';
            }
        });
    }

    // Inicialización al cargar la página
    document.addEventListener('DOMContentLoaded', () => {
        applyRolePermissions();
        updateRoleUI();

        // Cargar cuentas silenciosamente en segundo plano
        loadAccountsFromCloud().then(() => {
            renderAccountsList();
        });

        const profileBox = document.querySelector('.user-profile');
        if (profileBox) {
            profileBox.addEventListener('click', openLoginModal);
        }

        const btnCrearRol = document.getElementById('btn-open-create-role-modal');
        if (btnCrearRol) {
            btnCrearRol.addEventListener('click', openCreateRoleModal);
        }
    });

    window.LigaRoles = {
        getActiveRole,
        setSession,
        logout,
        openLoginModal,
        openCreateRoleModal,
        renderAccountsList,
        loadAccountsFromCloud,
        saveAccountToCloud,
        deleteAccountFromCloud,
        getDelegadoTeam,
        ROLES_INFO,
        applyRolePermissions
    };
})();
