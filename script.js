// CycleTrack PWA — script.js (updated with elevation and Locate Me)
let map, pathLine, polyCoords = [], watchId = null;
let startTime = null, totalDistance = 0, lastPos = null, maxSpeed = 0;
let elevations = [];
const speedEl = document.getElementById('speed');
const distanceEl = document.getElementById('distance');
const elapsedEl = document.getElementById('elapsed');
const maxspeedEl = document.getElementById('maxspeed');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const saveBtn = document.getElementById('saveBtn');
const exportBtn = document.getElementById('exportBtn');
const ridesList = document.getElementById('rides');
const ridesSection = document.getElementById('ridesList');

// Create Locate Me button
const locateBtn = document.createElement('button');
locateBtn.textContent = '📍';
locateBtn.id = 'locateBtn';
locateBtn.title = 'Center on current location';
locateBtn.style.position = 'absolute';
locateBtn.style.bottom = '20px';
locateBtn.style.right = '20px';
locateBtn.style.fontSize = '1.5rem';
locateBtn.style.padding = '10px';
locateBtn.style.borderRadius = '50%';
locateBtn.style.border = 'none';
locateBtn.style.background = '#16a34a';
locateBtn.style.color = 'white';
locateBtn.style.zIndex = 1000;
locateBtn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
document.body.appendChild(locateBtn);
locateBtn.addEventListener('click', ()=>{
  if(lastPos) map.setView([lastPos.lat,lastPos.lon], 17);
});

// init map
function initMap(){
  map = L.map('map', {zoomControl:true}).setView([22.432,87.322], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom:19, attribution:'© OpenStreetMap contributors'
  }).addTo(map);
  pathLine = L.polyline([], {weight:5}).addTo(map);
}

// haversine distance in meters
function haversine(lat1,lon1,lat2,lon2){
  const R = 6371000;
  const toRad = a => a*Math.PI/180;
  const dLat = toRad(lat2-lat1), dLon = toRad(lon2-lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function formatTime(ms){
  const s = Math.floor(ms/1000)%60, m = Math.floor(ms/60000)%60, h = Math.floor(ms/3600000);
  return [h.toString().padStart(2,'0'), m.toString().padStart(2,'0'), s.toString().padStart(2,'0')].join(':');
}

// fetch elevation using OpenElevation API
async function getElevation(lat, lon){
  try{
    const resp = await fetch(`https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lon}`);
    const data = await resp.json();
    return data.results[0].elevation || 0;
  }catch(e){ return 0; }
}

// GPS handler
async function onPosition(pos){
  const {latitude, longitude, speed: gpsSpeed} = pos.coords;
  const now = Date.now();
  if (!startTime) startTime = now;
  if (lastPos){
    const d = haversine(lastPos.lat, lastPos.lon, latitude, longitude);
    if (d > 0.5) totalDistance += d; // ignore tiny jitter
  }
  lastPos = {lat:latitude, lon:longitude, t:now};
  polyCoords.push([latitude, longitude]);
  pathLine.setLatLngs(polyCoords);
  map.panTo([latitude, longitude]);
  elevations.push(await getElevation(latitude, longitude));

  // speed
  let speedMs = gpsSpeed != null ? gpsSpeed : ((polyCoords.length>1) ? (haversine(polyCoords[polyCoords.length-2][0], polyCoords[polyCoords.length-2][1], latitude, longitude) / ((now - startTime)/1000 || 1)) : 0);
  let speedKmh = (speedMs*3.6) || 0;
  if (speedKmh > maxSpeed) maxSpeed = speedKmh;
  speedEl.textContent = speedKmh.toFixed(1) + ' km/h';
  distanceEl.textContent = (totalDistance/1000).toFixed(3) + ' km';
  elapsedEl.textContent = formatTime(now - startTime);
  maxspeedEl.textContent = maxSpeed.toFixed(1) + ' km/h';
}

function onError(err){
  alert('Geolocation error: ' + (err.message || err.code));
  stopRide();
}

// Controls
startBtn.addEventListener('click', ()=>{
  if (!navigator.geolocation) return alert('Geolocation not supported.');
  polyCoords = []; totalDistance = 0; lastPos = null; maxSpeed = 0; startTime = null;
  elevations = [];
  pathLine.setLatLngs([]);
  watchId = navigator.geolocation.watchPosition(onPosition, onError, {enableHighAccuracy:true, maximumAge:500, timeout:10000});
  startBtn.disabled = true; stopBtn.disabled = false; saveBtn.disabled = true; exportBtn.disabled = true;
  ridesSection.classList.add('hidden');
});
stopBtn.addEventListener('click', ()=>{
  stopRide();
  saveBtn.disabled = false; exportBtn.disabled = false;
});

function stopRide(){
  if (watchId != null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  startBtn.disabled = false; stopBtn.disabled = true;
}

// Save ride to localStorage
saveBtn.addEventListener('click', ()=>{
  const ride = {
    id: Date.now(),
    startedAt: startTime,
    durationMs: Date.now() - startTime,
    distanceKm: +(totalDistance/1000).toFixed(3),
    maxSpeedKmh: +maxSpeed.toFixed(2),
    coords: polyCoords,
    elevations: elevations
  };
  const rides = JSON.parse(localStorage.getItem('cycle_rides')||'[]');
  rides.unshift(ride);
  localStorage.setItem('cycle_rides', JSON.stringify(rides));
  renderRides();
  saveBtn.disabled = true;
  ridesSection.classList.remove('hidden');
});

function renderRides(){
  const rides = JSON.parse(localStorage.getItem('cycle_rides')||'[]');
  ridesList.innerHTML = '';
  rides.forEach(r=>{
    const li = document.createElement('li');
    const t = new Date(r.startedAt).toLocaleString();
    li.innerHTML = `<div><strong>${r.distanceKm} km</strong><div style="font-size:0.8rem;color:#9fb4c8">${t}</div></div>
                    <div>
                      <button class="btn-view" data-id="${r.id}">View</button>
                      <button class="btn-elev" data-id="${r.id}">Elevation</button>
                      <button class="btn-export" data-id="${r.id}">GPX</button>
                    </div>`;
    ridesList.appendChild(li);
  });
  // attach buttons
  document.querySelectorAll('.btn-view').forEach(b=>b.addEventListener('click', e=>{
    const id = +e.target.dataset.id;
    const rides = JSON.parse(localStorage.getItem('cycle_rides')||'[]');
    const r = rides.find(x=>x.id===id);
    if (!r) return;
    polyCoords = r.coords;
    pathLine.setLatLngs(polyCoords);
    if (polyCoords.length) map.fitBounds(polyCoords);
    ridesSection.classList.remove('hidden');
  }));
  document.querySelectorAll('.btn-export').forEach(b=>b.addEventListener('click', e=>{
    const id = +e.target.dataset.id;
    const rides = JSON.parse(localStorage.getItem('cycle_rides')||'[]');
    const r = rides.find(x=>x.id===id);
    if (!r) return;
    const gpx = toGPX(r);
    const blob = new Blob([gpx], {type:'application/gpx+xml'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `ride-${r.id}.gpx`; document.body.appendChild(a); a.click(); a.remove();
  }));
  document.querySelectorAll('.btn-elev').forEach(b=>b.addEventListener('click', e=>{
    const id = +e.target.dataset.id;
    const rides = JSON.parse(localStorage.getItem('cycle_rides')||'[]');
    const r = rides.find(x=>x.id===id);
    if (!r || !r.elevations || !r.elevations.length) return alert('No elevation data for this ride.');
    let min = Math.min(...r.elevations);
    let max = Math.max(...r.elevations);
    let gain = 0;
    for(let i=1;i<r.elevations.length;i++){
      if(r.elevations[i]>r.elevations[i-1]) gain += r.elevations[i]-r.elevations[i-1];
    }
    alert(`Elevation Summary:\nMin: ${min} m\nMax: ${max} m\nTotal Gain: ${gain.toFixed(1)} m`);
  }));
}

// GPX Export
function toGPX(ride){
  const header = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="CycleTrack - PWA" xmlns="http://www.topografix.com/GPX/1/1">
<trk><name>Ride ${ride.id}</name><trkseg>`;
  const pts = ride.coords.map((c,i)=>`<trkpt lat="${c[0]}" lon="${c[1]}"><ele>${ride.elevations[i]||0}</ele></trkpt>`).join('\n');
  const footer = `</trkseg></trk></gpx>`;
  return header + '\n' + pts + '\n' + footer;
}

// Service worker and install prompt handled elsewhere

// init app
initMap();
renderRides();
