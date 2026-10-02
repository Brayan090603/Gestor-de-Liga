const SUPABASE_URL = 'https://uzmoubiomubvthayvweu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6bW91YmlvbXVidnRoYXl2d2V1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MTcwNzIsImV4cCI6MjA5Nzk5MzA3Mn0.9QDAThCpnG-Xaq2UTCLilIUOIrVMjtyXJd9owMYPCVQ';

async function checkIds() {
  const resE = await fetch(`${SUPABASE_URL}/rest/v1/equipos?select=*`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  const equipos = await resE.json();
  const rosales = equipos.filter(e => e.nombre.toLowerCase().includes('rosales'));
  console.log("Rosales teams:", rosales);
  
  const resT = await fetch(`${SUPABASE_URL}/rest/v1/torneos?select=*`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  const torneos = await resT.json();
  console.log("Torneos activos:");
  torneos.forEach(t => console.log(t.id, t.nombre, "isActive:", t.id === 1782956734780)); // 1782956734780 was the activeId I saw earlier
}

checkIds();
