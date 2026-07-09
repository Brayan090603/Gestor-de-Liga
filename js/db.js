// js/db.js
const SUPABASE_URL = 'https://uzmoubiomubvthayvweu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6bW91YmlvbXVidnRoYXl2d2V1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MTcwNzIsImV4cCI6MjA5Nzk5MzA3Mn0.9QDAThCpnG-Xaq2UTCLilIUOIrVMjtyXJd9owMYPCVQ';

try {
    window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} catch (e) {
    alert("Error inicializando Supabase en db.js: " + e.message);
}

// Helper function para mostrar loaders
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
        loader.style.backgroundColor = 'rgba(15, 23, 42, 0.8)';
        loader.style.backdropFilter = 'blur(4px)';
        loader.style.zIndex = '9999';
        loader.style.display = 'flex';
        loader.style.flexDirection = 'column';
        loader.style.justifyContent = 'center';
        loader.style.alignItems = 'center';
        loader.style.color = '#10B981';
        loader.innerHTML = `
            <i class="fa-solid fa-spinner fa-spin" style="font-size: 40px; margin-bottom: 15px;"></i>
            <h3 id="global-loader-msg" style="font-family: 'Inter', sans-serif;">${msg}</h3>
        `;
        document.body.appendChild(loader);
    } else {
        document.getElementById('global-loader-msg').textContent = msg;
        loader.style.display = 'flex';
    }
}

function hideLoader() {
    const loader = document.getElementById('global-loader');
    if (loader) {
        loader.style.display = 'none';
    }
}
