/**
 * auth_service.js - Sistema Central de Autenticación, Registro Simplificado, 
 * Recuperación de Contraseña por Código y Conexión OAuth con Google
 */

(function () {
    const AUTH_SESSION_KEY = 'ligaapp_auth_session';
    const CACHED_USERS_KEY = 'ligaapp_users_vault';
    const CACHED_OWNERS_KEY = 'ligaapp_torneo_owners_map';
    const PENDING_RESET_KEY = 'ligaapp_pending_reset';

    function getCurrentSession() {
        try {
            const raw = localStorage.getItem(AUTH_SESSION_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function setSession(userObj) {
        if (userObj) {
            localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(userObj));
            localStorage.setItem('ligaapp_active_role', userObj.role || 'admin');
        } else {
            localStorage.removeItem(AUTH_SESSION_KEY);
            localStorage.setItem('ligaapp_active_role', 'publico');
        }
    }

    function logout() {
        if (window.supabase && window.supabase.auth) {
            try { window.supabase.auth.signOut(); } catch (e) {}
        }
        localStorage.removeItem(AUTH_SESSION_KEY);
        localStorage.setItem('ligaapp_active_role', 'publico');
        window.location.href = 'index.html';
    }

    // ==========================================
    // USUARIOS EN NUBE (TABLA MOVIMIENTOS TIPO USER_REGISTER)
    // ==========================================
    async function getCloudUsers() {
        let users = [];
        try {
            const rawCache = localStorage.getItem(CACHED_USERS_KEY);
            if (rawCache) users = JSON.parse(rawCache);
        } catch (e) {}

        try {
            if (window.supabase) {
                const { data, error } = await window.supabase
                    .from('movimientos')
                    .select('*')
                    .eq('tipo', 'USER_REGISTER');

                if (!error && data && data.length > 0) {
                    const cloudMap = [];
                    data.forEach(row => {
                        try {
                            const parsed = typeof row.fecha === 'string' ? JSON.parse(row.fecha) : row.fecha;
                            if (parsed && parsed.email) {
                                cloudMap.push({
                                    id: row.id.toString(),
                                    userId: parsed.userId,
                                    email: parsed.email.trim().toLowerCase(),
                                    username: parsed.username || parsed.email.split('@')[0],
                                    password: parsed.password,
                                    nombre: parsed.nombre || parsed.email.split('@')[0],
                                    role: parsed.role || 'admin',
                                    created_at: row.created_at
                                });
                            }
                        } catch (e) {}
                    });

                    if (cloudMap.length > 0) {
                        users = cloudMap;
                        localStorage.setItem(CACHED_USERS_KEY, JSON.stringify(users));
                    }
                }
            }
        } catch (err) {
            console.warn('Error leyendo usuarios de la nube:', err);
        }

        return users;
    }

    // Registro simplificado: Solo Correo, Contraseña y Confirmar Contraseña
    async function registerUser(email, password, confirmPassword) {
        const cleanEmail = (email || '').trim().toLowerCase();
        const cleanPass = (password || '').trim();
        const cleanConfirm = (confirmPassword || '').trim();

        if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
            throw new Error('Por favor ingresa un correo electrónico válido.');
        }
        if (!cleanPass || cleanPass.length < 4) {
            throw new Error('La contraseña debe tener al menos 4 caracteres.');
        }
        if (cleanPass !== cleanConfirm) {
            throw new Error('Las contraseñas no coinciden. Verifícalas de nuevo.');
        }

        const existingUsers = await getCloudUsers();
        const duplicate = existingUsers.find(u => u.email === cleanEmail);
        if (duplicate) {
            throw new Error('Ya existe una cuenta registrada con este correo electrónico.');
        }

        const newUserId = 'usr_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
        const numericId = parseInt(Date.now().toString().slice(-9)) + Math.floor(Math.random() * 100);
        const userNamePart = cleanEmail.split('@')[0];

        const newUserObj = {
            id: numericId.toString(),
            userId: newUserId,
            email: cleanEmail,
            username: userNamePart,
            password: cleanPass,
            nombre: userNamePart,
            role: 'admin',
            created_at: new Date().toISOString()
        };

        // Guardar en la nube
        if (window.supabase) {
            await window.supabase
                .from('movimientos')
                .insert([{
                    id: numericId,
                    torneo_id: 1794001549968,
                    tipo: 'USER_REGISTER',
                    fecha: JSON.stringify({
                        userId: newUserId,
                        email: cleanEmail,
                        username: userNamePart,
                        password: cleanPass,
                        nombre: userNamePart,
                        role: 'admin'
                    })
                }]);
        }

        existingUsers.push(newUserObj);
        localStorage.setItem(CACHED_USERS_KEY, JSON.stringify(existingUsers));

        setSession(newUserObj);
        return newUserObj;
    }

    // Iniciar sesión con Correo y Contraseña
    async function loginUser(email, password) {
        const cleanEmail = (email || '').trim().toLowerCase();
        const cleanPass = (password || '').trim();

        const users = await getCloudUsers();
        let matched = users.find(u => 
            (u.email === cleanEmail || u.username === cleanEmail) && u.password === cleanPass
        );

        // Cuenta maestra de respaldo
        if (!matched && (cleanEmail === 'admin' || cleanEmail === 'admin@liga.com' || cleanEmail === 'admin@ligaapp.com') && cleanPass === '123') {
            matched = {
                userId: 'usr_master_admin',
                email: 'admin@ligaapp.com',
                username: 'admin',
                nombre: 'Administrador Maestro',
                role: 'admin'
            };
        }

        if (!matched) {
            throw new Error('Correo o contraseña incorrectos. Verifica tus datos.');
        }

        setSession(matched);
        return matched;
    }

    // ==========================================
    // INICIAR SESIÓN CON GOOGLE (OAUTH)
    // ==========================================
    async function signInWithGoogle() {
        if (!window.supabase || !window.supabase.auth) {
            throw new Error('Supabase no está disponible para autenticación con Google.');
        }

        const redirectTo = window.location.origin + window.location.pathname;

        const { data, error } = await window.supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectTo
            }
        });

        if (error) {
            throw error;
        }
        return data;
    }

    // Manejar retorno de sesión OAuth de Google si existe en URL
    async function checkGoogleAuthCallback() {
        try {
            if (window.supabase && window.supabase.auth) {
                const { data } = await window.supabase.auth.getSession();
                if (data && data.session && data.session.user) {
                    const gUser = data.session.user;
                    const googleEmail = gUser.email.toLowerCase();
                    const googleName = gUser.user_metadata?.full_name || googleEmail.split('@')[0];

                    const users = await getCloudUsers();
                    let appUser = users.find(u => u.email === googleEmail);

                    if (!appUser) {
                        // Crear registro si entra con Google por primera vez
                        const numericId = parseInt(Date.now().toString().slice(-9)) + Math.floor(Math.random() * 50);
                        appUser = {
                            id: numericId.toString(),
                            userId: 'usr_g_' + gUser.id.substring(0, 8),
                            email: googleEmail,
                            username: googleEmail.split('@')[0],
                            password: 'oauth_google_signed_' + Math.random().toString(36),
                            nombre: googleName,
                            role: 'admin',
                            created_at: new Date().toISOString()
                        };

                        await window.supabase
                            .from('movimientos')
                            .insert([{
                                id: numericId,
                                torneo_id: 1794001549968,
                                tipo: 'USER_REGISTER',
                                fecha: JSON.stringify(appUser)
                            }]);

                        users.push(appUser);
                        localStorage.setItem(CACHED_USERS_KEY, JSON.stringify(users));
                    }

                    setSession(appUser);
                    return appUser;
                }
            }
        } catch (e) {
            console.warn('Aviso verificando Google OAuth:', e);
        }
        return null;
    }

    // ==========================================
    // RECUPERACIÓN DE CONTRASEÑA POR CÓDIGO AL CORREO
    // ==========================================
    async function requestPasswordResetCode(email) {
        const cleanEmail = (email || '').trim().toLowerCase();
        if (!cleanEmail || !cleanEmail.includes('@')) {
            throw new Error('Por favor ingresa un correo electrónico válido.');
        }

        const users = await getCloudUsers();
        const user = users.find(u => u.email === cleanEmail);
        if (!user && cleanEmail !== 'admin@ligaapp.com' && cleanEmail !== 'admin@liga.com') {
            throw new Error('No encontramos ninguna cuenta asociada a este correo electrónico.');
        }

        // Generar código numérico de 6 dígitos
        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + (15 * 60 * 1000); // 15 minutos de validez

        // Intentar envío de correo vía Supabase Auth Password Reset
        let sentViaSupabase = false;
        try {
            if (window.supabase && window.supabase.auth) {
                const { error: resetErr } = await window.supabase.auth.resetPasswordForEmail(cleanEmail);
                if (!resetErr) sentViaSupabase = true;
            }
        } catch (err) {}

        // Guardar código pendiente de forma segura en la nube (tabla movimientos tipo RESET_CODE)
        const numericId = parseInt(Date.now().toString().slice(-9)) + Math.floor(Math.random() * 100);
        if (window.supabase) {
            await window.supabase
                .from('movimientos')
                .insert([{
                    id: numericId,
                    torneo_id: 1794001549968,
                    tipo: 'RESET_CODE',
                    fecha: JSON.stringify({
                        email: cleanEmail,
                        code: resetCode,
                        expiresAt: expiresAt
                    })
                }]);
        }

        localStorage.setItem(PENDING_RESET_KEY, JSON.stringify({
            email: cleanEmail,
            code: resetCode,
            expiresAt: expiresAt
        }));

        return {
            email: cleanEmail,
            code: resetCode, // Devuelto para mostrar notificación visual directa al usuario
            sentViaSupabase: sentViaSupabase
        };
    }

    async function verifyCodeAndResetPassword(email, code, newPassword, confirmNewPassword) {
        const cleanEmail = (email || '').trim().toLowerCase();
        const cleanCode = (code || '').trim();
        const cleanPass = (newPassword || '').trim();
        const cleanConfirm = (confirmNewPassword || '').trim();

        if (!cleanCode || cleanCode.length < 4) {
            throw new Error('Ingresa el código de 6 dígitos recibido.');
        }
        if (!cleanPass || cleanPass.length < 4) {
            throw new Error('La nueva contraseña debe tener al menos 4 caracteres.');
        }
        if (cleanPass !== cleanConfirm) {
            throw new Error('Las nuevas contraseñas no coinciden.');
        }

        // Verificar código en la nube o local
        let isValid = false;
        try {
            const rawLocal = localStorage.getItem(PENDING_RESET_KEY);
            if (rawLocal) {
                const parsed = JSON.parse(rawLocal);
                if (parsed.email === cleanEmail && parsed.code === cleanCode && Date.now() < parsed.expiresAt) {
                    isValid = true;
                }
            }

            if (!isValid && window.supabase) {
                const { data } = await window.supabase
                    .from('movimientos')
                    .select('*')
                    .eq('tipo', 'RESET_CODE')
                    .order('created_at', { ascending: false })
                    .limit(5);

                if (data) {
                    data.forEach(row => {
                        try {
                            const p = typeof row.fecha === 'string' ? JSON.parse(row.fecha) : row.fecha;
                            if (p && p.email === cleanEmail && p.code === cleanCode && Date.now() < p.expiresAt) {
                                isValid = true;
                            }
                        } catch (e) {}
                    });
                }
            }
        } catch (e) {}

        if (!isValid) {
            throw new Error('El código ingresado es incorrecto o ha expirado. Solicita uno nuevo.');
        }

        // Actualizar contraseña del usuario en la nube
        const users = await getCloudUsers();
        const userIdx = users.findIndex(u => u.email === cleanEmail);
        if (userIdx >= 0) {
            users[userIdx].password = cleanPass;
            localStorage.setItem(CACHED_USERS_KEY, JSON.stringify(users));

            if (window.supabase) {
                const numericId = parseInt(users[userIdx].id || Date.now().toString().slice(-9));
                await window.supabase
                    .from('movimientos')
                    .upsert([{
                        id: numericId,
                        torneo_id: 1794001549968,
                        tipo: 'USER_REGISTER',
                        fecha: JSON.stringify({
                            userId: users[userIdx].userId,
                            email: cleanEmail,
                            username: users[userIdx].username,
                            password: cleanPass,
                            nombre: users[userIdx].nombre,
                            role: users[userIdx].role || 'admin'
                        })
                    }]);
            }
        }

        localStorage.removeItem(PENDING_RESET_KEY);
        return true;
    }

    // ==========================================
    // MAPEO DE PROPIETARIOS DE TORNEOS
    // ==========================================
    async function getTorneoOwnersMap() {
        let map = {};
        try {
            const rawCache = localStorage.getItem(CACHED_OWNERS_KEY);
            if (rawCache) map = JSON.parse(rawCache);
        } catch (e) {}

        try {
            if (window.supabase) {
                const { data, error } = await window.supabase
                    .from('movimientos')
                    .select('*')
                    .eq('tipo', 'TORNEO_OWNER');

                if (!error && data && data.length > 0) {
                    data.forEach(row => {
                        try {
                            const parsed = typeof row.fecha === 'string' ? JSON.parse(row.fecha) : row.fecha;
                            if (parsed && parsed.torneoId && parsed.ownerId) {
                                map[parsed.torneoId.toString()] = {
                                    ownerId: parsed.ownerId,
                                    ownerEmail: parsed.ownerEmail || parsed.ownerUsername || '',
                                    nombreTorneo: parsed.nombreTorneo || ''
                                };
                            }
                        } catch (e) {}
                    });
                    localStorage.setItem(CACHED_OWNERS_KEY, JSON.stringify(map));
                }
            }
        } catch (err) {}

        return map;
    }

    async function assignTorneoOwner(torneoId, ownerUser, nombreTorneo = '') {
        const map = await getTorneoOwnersMap();
        map[torneoId.toString()] = {
            ownerId: ownerUser.userId,
            ownerEmail: ownerUser.email,
            nombreTorneo: nombreTorneo
        };
        localStorage.setItem(CACHED_OWNERS_KEY, JSON.stringify(map));

        try {
            if (window.supabase) {
                const numericId = parseInt(Date.now().toString().slice(-9)) + Math.floor(Math.random() * 50);
                await window.supabase
                    .from('movimientos')
                    .upsert([{
                        id: numericId,
                        torneo_id: parseInt(torneoId),
                        tipo: 'TORNEO_OWNER',
                        fecha: JSON.stringify({
                            torneoId: parseInt(torneoId),
                            ownerId: ownerUser.userId,
                            ownerEmail: ownerUser.email,
                            nombreTorneo: nombreTorneo
                        })
                    }]);
            }
        } catch (e) {}
    }

    // Vincular un torneo existente al usuario autenticado (para ligas existentes sin dueño)
    async function claimTournamentOwnership(torneoId, nombreTorneo = '') {
        const currentSession = getCurrentSession();
        if (!currentSession) throw new Error('Debes iniciar sesión primero.');
        await assignTorneoOwner(torneoId, currentSession, nombreTorneo);
        return true;
    }

    async function filterTorneosForCurrentUser(allTorneos) {
        const currentSession = getCurrentSession();
        if (!currentSession) return [];

        const ownersMap = await getTorneoOwnersMap();

        return allTorneos.filter(t => {
            const tIdStr = t.id.toString();
            const ownerInfo = ownersMap[tIdStr];

            if (ownerInfo) {
                return ownerInfo.ownerId === currentSession.userId;
            }

            if (currentSession.username === 'admin' || currentSession.email === 'admin@ligaapp.com') {
                return true;
            }

            return false;
        });
    }

    async function deleteTorneoPermanently(torneoId) {
        const currentSession = getCurrentSession();
        if (!currentSession) throw new Error('No autorizado');

        const ownersMap = await getTorneoOwnersMap();
        const ownerInfo = ownersMap[torneoId.toString()];

        if (ownerInfo && ownerInfo.ownerId !== currentSession.userId && currentSession.username !== 'admin') {
            throw new Error('No tienes permiso para eliminar este torneo porque pertenece a otro usuario.');
        }

        if (window.supabase) {
            await window.supabase.from('torneos').delete().eq('id', torneoId);
            await window.supabase.from('equipos').delete().eq('torneo_id', torneoId);
            await window.supabase.from('jugadores').delete().eq('torneo_id', torneoId);
            await window.supabase.from('partidos').delete().eq('torneo_id', torneoId);
            await window.supabase.from('movimientos').delete().eq('torneo_id', torneoId);
        }

        delete ownersMap[torneoId.toString()];
        localStorage.setItem(CACHED_OWNERS_KEY, JSON.stringify(ownersMap));
    }

    window.LigaAuthService = {
        getCurrentSession,
        setSession,
        logout,
        registerUser,
        loginUser,
        signInWithGoogle,
        checkGoogleAuthCallback,
        requestPasswordResetCode,
        verifyCodeAndResetPassword,
        getCloudUsers,
        getTorneoOwnersMap,
        assignTorneoOwner,
        claimTournamentOwnership,
        filterTorneosForCurrentUser,
        deleteTorneoPermanently
    };
})();
