const fs = require('fs');
const m = fs.readFileSync('matches.json', 'utf8');

const script = `

// INYECCIÓN DE CALENDARIO CLAUSURA
setTimeout(async () => {
    if (!localStorage.getItem('calendario_clausura_injected_final_2')) {
        const removeAccents = (str) => str.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().trim();
        const matchesData = ${m};
        let idCounter = Date.now();
        let added = false;
        
        // Limpiamos si hay algo viejo generado
        appData.partidos = appData.partidos.filter(p => !(p.torneo === 'clausura' && p.calendario_nombre === 'Torneo Principal' && p.fase === 'liga'));

        matchesData.forEach(item => {
            let eq1 = 'vacante';
            let eq2 = 'vacante';

            if (item.eq1 !== 'vacante') {
                const searchName1 = removeAccents(item.eq1).replace(/\\d+\\s*/, '');
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
`;

fs.appendFileSync('js/app.js', script);
console.log('Appended injected script');
