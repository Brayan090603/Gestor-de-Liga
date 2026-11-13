// js/db.js
const SUPABASE_URL = 'https://uzmoubiomubvthayvweu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6bW91YmlvbXVidnRoYXl2d2V1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MTcwNzIsImV4cCI6MjA5Nzk5MzA3Mn0.9QDAThCpnG-Xaq2UTCLilIUOIrVMjtyXJd9owMYPCVQ';

try {
    window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} catch (e) {
    alert("Error inicializando Supabase en db.js: " + e.message);
}

// Helper function para mostrar loaders temáticos de fútbol
function showLoader(msg = "Cargando...") {
    let loader = document.getElementById('global-loader');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'global-loader';
        loader.style.position = 'fixed';
        loader.style.top = '0';
        loader.style.left = '0';
        loader.style.width = '100vw';
        loader.style.height = '100vh';
        loader.style.backgroundColor = 'rgba(5, 9, 20, 0.88)';
        loader.style.backdropFilter = 'blur(10px)';
        loader.style.webkitBackdropFilter = 'blur(10px)';
        loader.style.zIndex = '99999';
        loader.style.display = 'flex';
        loader.style.flexDirection = 'column';
        loader.style.justifyContent = 'center';
        loader.style.alignItems = 'center';
        loader.style.color = '#ffffff';

        // Estilos e inyección de animación temática
        loader.innerHTML = `
            <style>
                @keyframes soccerBallRoll {
                    0% { transform: translateX(-40px) rotate(0deg); }
                    50% { transform: translateX(40px) rotate(360deg); }
                    100% { transform: translateX(-40px) rotate(720deg); }
                }
                @keyframes soccerPitchPulse {
                    0%, 100% { transform: scaleX(0.7); opacity: 0.3; }
                    50% { transform: scaleX(1.1); opacity: 0.8; }
                }
                .soccer-loader-box {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 30px 45px;
                    border-radius: 24px;
                    background: linear-gradient(145deg, rgba(16, 27, 49, 0.95), rgba(7, 12, 24, 0.98));
                    border: 1px solid rgba(0, 242, 254, 0.3);
                    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7), 0 0 35px rgba(0, 242, 254, 0.25);
                }
                .soccer-ball-anim {
                    font-size: 46px;
                    color: #ffffff;
                    filter: drop-shadow(0 0 16px rgba(0, 255, 135, 0.6));
                    animation: soccerBallRoll 2s infinite ease-in-out;
                    margin-bottom: 8px;
                }
                .soccer-pitch-line {
                    width: 100px;
                    height: 4px;
                    background: linear-gradient(90deg, transparent, #00ff87, #00f2fe, transparent);
                    border-radius: 2px;
                    box-shadow: 0 0 12px #00ff87;
                    animation: soccerPitchPulse 2s infinite ease-in-out;
                    margin-bottom: 18px;
                }
                .soccer-loader-title {
                    font-family: 'Outfit', sans-serif;
                    font-weight: 700;
                    letter-spacing: 0.5px;
                    font-size: 1.05rem;
                    color: #ffffff;
                    text-align: center;
                    margin: 0;
                    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
                }
                .soccer-loader-sub {
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                    color: #00f2fe;
                    font-weight: 700;
                    margin-top: 6px;
                }
            </style>
            <div class="soccer-loader-box">
                <i class="fa-solid fa-futbol soccer-ball-anim"></i>
                <div class="soccer-pitch-line"></div>
                <h3 id="global-loader-msg" class="soccer-loader-title">${msg}</h3>
                <span class="soccer-loader-sub">LIGA DIGITAL &bull; MATCH CENTER</span>
            </div>
        `;
        document.body.appendChild(loader);
    } else {
        const msgElem = document.getElementById('global-loader-msg');
        if (msgElem) msgElem.textContent = msg;
        loader.style.display = 'flex';
    }
}

function hideLoader() {
    const loader = document.getElementById('global-loader');
    if (loader) {
        loader.style.display = 'none';
    }
}

// Lazy Loader para scripts pesados (libera memoria y acelera el inicio)
window.lazyLoadScript = function(src) {
    return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) {
            return resolve();
        }
        const s = document.createElement('script');
        s.src = src;
        s.onload = () => resolve();
        s.onerror = (e) => reject(e);
        document.body.appendChild(s);
    });
};
