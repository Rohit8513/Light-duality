// 1. CORE PHYSICS ENGINE VARIABLES & CONSTANTS

const slitDist = 7.0;                  // Distance between the centers of the two slits (d)
const slitWidth = 1.2;                 // Width of each individual slit (a)
const wavelength = 3.2;                // Spatial period of the wave (lambda)
const k = (2 * Math.PI) / wavelength;  // Wavenumber

let time = 0;
let particleCount = 0;
let currentMode = 'wave';               // Options: 'wave', 'particle', 'prob'


// 2. THREE.JS SYSTEM SETUP (SCENE, CAMERA, RENDERER)

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x030305);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// Interactive Viewport Camera setup

const controls = new THREE.OrbitControls(camera, renderer.domElement);
camera.position.set(0, 40, 70);
controls.target.set(0, 0, 5);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Global Lighting Configurations

const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
dirLight.position.set(20, 60, 10);
scene.add(dirLight);


// 3. LABORATORY APPARATUS GEOMETRY


         // 3A. Particle Emitter Source (Hidden completely in Wave mode)

const emitterGeo = new THREE.CylinderGeometry(1.0, 1.4, 5, 24);
const emitterMat = new THREE.MeshStandardMaterial({ color: 0x222226, roughness: 0.5, metalness: 0.8 });
const particleEmitter = new THREE.Mesh(emitterGeo, emitterMat);
particleEmitter.rotation.x = Math.PI / 2;
particleEmitter.position.set(0, 0, -42);
scene.add(particleEmitter);

// 3B. Physical Slit Obstacle Wall Setup

const wallWidth = 45;
const wallHeight = 12;
const wallThickness = 0.6;
const wallMat = new THREE.MeshStandardMaterial({ color: 0x2c2c35, roughness: 0.7 });
const barrierGroup = new THREE.Group();

// Math segments to construct slits cleanly
const sideSegmentWidth = (wallWidth - slitDist - slitWidth) / 2;
const centerSegmentWidth = slitDist - slitWidth;

const sideGeo = new THREE.BoxGeometry(sideSegmentWidth, wallHeight, wallThickness);
const centerGeo = new THREE.BoxGeometry(centerSegmentWidth, wallHeight, wallThickness);

const leftWall = new THREE.Mesh(sideGeo, wallMat);
leftWall.position.x = -(wallWidth / 2 - sideSegmentWidth / 2);
barrierGroup.add(leftWall);

const centerWall = new THREE.Mesh(centerGeo, wallMat);
centerWall.position.x = 0;
barrierGroup.add(centerWall);

const rightWall = new THREE.Mesh(sideGeo, wallMat);
rightWall.position.x = (wallWidth / 2 - sideSegmentWidth / 2);
barrierGroup.add(rightWall);

barrierGroup.position.z = -15; // Placed at z = -15
scene.add(barrierGroup);

// 3C. Expanded Detection Target Canvas Screen
const screenCanvas = document.createElement('canvas');
screenCanvas.width = 1024;                                                                      // High definition resolution mapping
screenCanvas.height = 256;
const screenContext = screenCanvas.getContext('2d');

const screenTexture = new THREE.CanvasTexture(screenCanvas);
const screenGeo = new THREE.PlaneGeometry(65, 24);                                          // Large display surface dimensions
const screenMat = new THREE.MeshBasicMaterial({ map: screenTexture, side: THREE.DoubleSide });
const detectorScreen = new THREE.Mesh(screenGeo, screenMat);
detectorScreen.position.set(0, 0, 32);                                                          // Shifted backward to allow full interference evolution
scene.add(detectorScreen);


// 4. WAVE SIMULATION MATRIX

const waveWidth = 65;
const waveLength = 80;
const waveGeo = new THREE.PlaneGeometry(waveWidth, waveLength, 150, 150);
const waveMat = new THREE.MeshStandardMaterial({
    color: 0x00d2ff,
    wireframe: true,
    transparent: true,
    opacity: 0.5
});
const waveMesh = new THREE.Mesh(waveGeo, waveMat);
waveMesh.rotation.x = Math.PI / 2;
waveMesh.position.set(0, 0, -5); 
scene.add(waveMesh);


// 5. QUANTUM PARTICLES COMPONENT SYSTEM

const maxParticles = 1200;
const particleGeo = new THREE.BufferGeometry();
const pPositions = new Float32Array(maxParticles * 3);
const pVelocities = new Float32Array(maxParticles * 3);
const pFinalDestX = new Float32Array(maxParticles);
const pLifeStates = new Float32Array(maxParticles); // 0 = ready, 1 = flying

particleGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
const particleMat = new THREE.PointsMaterial({ color: 0xff0000, size: 0.45, transparent: true, opacity: 0.95 });
const particleSystem = new THREE.Points(particleGeo, particleMat);
scene.add(particleSystem);

// Persistent Screen Impacts Buffer
const landedGeo = new THREE.BufferGeometry();
let landedPositions = [];
const landedMat = new THREE.PointsMaterial({ color: 0xff0000 , size: 0.35, transparent: true, opacity: 0.85 });
const landedSystem = new THREE.Points(landedGeo, landedMat);
scene.add(landedSystem);


// 6. PROBABILITY DISTRIBUTION DATA CURVE

const traceSteps = 300;
const pathPoints = [];

// Analytical Double Slit Fraunhofer & Fresnel approximation logic
function evaluateInterference(x) {
    const distanceZ = 47; // From barrier (z=-15) to screen (z=32)
    const angleTheta = Math.atan(x / distanceZ);
    
    // Interference variable (d * sin(theta))
    const beta = (k * slitDist * Math.sin(angleTheta)) / 2;
    // Diffraction envelope variable (a * sin(theta))
    const alpha = (k * slitWidth * Math.sin(angleTheta)) / 2;
    
    const interferenceFactor = Math.pow(Math.cos(beta), 2);
    const diffractionFactor = alpha === 0 ? 1 : Math.pow(Math.sin(alpha) / alpha, 2);
    
    // Gaussian falloff wrapper for physical beam realism
    const beamGaussian = Math.exp(-Math.pow(x / 28, 2));
    
    return interferenceFactor * diffractionFactor * beamGaussian;
}

// Generate the 3D analytical geometry trajectory loop
for (let i = 0; i <= traceSteps; i++) {
    const worldX = (i / traceSteps) * 65 - 32.5;
    const probabilityY = evaluateInterference(worldX) * 16; 
    pathPoints.push(new THREE.Vector3(worldX, probabilityY, 31.5));
}
const curvePath = new THREE.CatmullRomCurve3(pathPoints);
const dynamicTubeGeo = new THREE.TubeGeometry(curvePath, 180, 0.35, 8, false);
const dynamicTubeMat = new THREE.MeshStandardMaterial({
    color: 0x00ffcc,
    emissive: 0x00ffcc,
    emissiveIntensity: 0.6
});
const analyticalCurveMesh = new THREE.Mesh(dynamicTubeGeo, dynamicTubeMat);
scene.add(analyticalCurveMesh);

// Monte Carlo accept-reject sampler algorithm
function computeQuantumTargetX() {
    while (true) {
        let proposedX = (Math.random() - 0.5) * 65;
        let evaluationThreshold = Math.random();
        if (evaluationThreshold < evaluateInterference(proposedX)) {
            return proposedX;
        }
    }
}

function triggerParticleEmission() {
    const pos = particleSystem.geometry.attributes.position;
    for (let i = 0; i < maxParticles; i++) {
        if (pLifeStates[i] === 0) {
            pLifeStates[i] = 1;
            pos.setXYZ(i, 0, 0, -42); // Spawn inside emitter barrel
            
            const targetX = computeQuantumTargetX();
            pFinalDestX[i] = targetX;
            
            // Linear parametric path calculation
            pVelocities[i * 3] = targetX / 56.4; 
            pVelocities[i * 3 + 1] = (Math.random() - 0.5) * 0.08;
            pVelocities[i * 3 + 2] = 1.35; // Forward propagation velocity
            
            particleCount++;
            break;
        }
    }
    pos.needsUpdate = true;
}

// 7. RESPONSIVE DYNAMIC UI & HOVER LABELS ENGINE

const annotationsArray = [
    { id: 'lbl-src', text: 'Plane Wave Source Plane', pos: new THREE.Vector3(0, 8, -42) },
    { id: 'lbl-bar', text: 'Double Slit Barrier Wall', pos: new THREE.Vector3(0, 8, -15) },
    { id: 'lbl-scr', text: 'Interference Capture Screen', pos: new THREE.Vector3(0, 14, 32) }
];

function buildHUDLabels() {
    const rootLayer = document.getElementById('labels-overlay-layer');
    if (!rootLayer) return;
    rootLayer.innerHTML = '';
    
    annotationsArray.forEach(config => {
        // Skip rendering source label explicitly if in wave view
        if (currentMode === 'wave' && config.id === 'lbl-src') return;
        
        const block = document.createElement('div');
        block.id = config.id;
        block.className = 'lab-3d-label';
        block.innerText = config.text;
        rootLayer.appendChild(block);
    });
}

function processLabelsTracking() {
    const halfW = window.innerWidth / 2;
    const halfH = window.innerHeight / 2;
    const projectedVector = new THREE.Vector3();

    annotationsArray.forEach(config => {
        const domElement = document.getElementById(config.id);
        if (!domElement) return;

        projectedVector.copy(config.pos).project(camera);

        if (projectedVector.z > 1) {
            domElement.style.opacity = 0;
            return;
        }

        domElement.style.opacity = 1;
        domElement.style.left = `${(projectedVector.x * halfW) + halfW}px`;
        domElement.style.top = `${-(projectedVector.y * halfH) + halfH}px`;
    });
}

window.setMode = function(targetMode) {
    currentMode = targetMode;
    
    // Interface State Class updates
    document.getElementById('wave-btn').classList.toggle('active', targetMode === 'wave');
    document.getElementById('particle-btn').classList.toggle('active', targetMode === 'particle');
    document.getElementById('prob-btn').classList.toggle('active', targetMode === 'prob');
    
    const monitorText = document.getElementById('hud-mode');
    const particleMonitor = document.getElementById('hud-count');
    
    if (monitorText) monitorText.innerText = "Mode: " + document.getElementById(targetMode + '-btn').innerText;
    
    // Reset canvas system completely before adjustments
    screenContext.fillStyle = '#030305';
    screenContext.fillRect(0, 0, screenCanvas.width, screenCanvas.height);
    screenTexture.needsUpdate = true;

    // View Routing Configuration Logic
    if (targetMode === 'wave') {
        waveMesh.visible = true;
        particleEmitter.visible = false; // Rule 3: Hide source completely in Wave mode
        particleSystem.visible = false;
        landedSystem.visible = false;
        analyticalCurveMesh.visible = false;
        if (particleMonitor) particleMonitor.style.display = 'none';
        
        annotationsArray[2].text = "Interference Capture Screen";
    } 
    else if (targetMode === 'particle') {
        waveMesh.visible = false;
        particleEmitter.visible = true; // Rule 1: Show source in particle view
        particleSystem.visible = true;
        landedSystem.visible = true;
        analyticalCurveMesh.visible = false;
        if (particleMonitor) {
            particleMonitor.style.display = 'block';
            particleMonitor.innerText = "Particles: " + particleCount.toLocaleString();
        }
        annotationsArray[1].text = "Double Slit Barrier Wall";
        annotationsArray[2].text = "Discrete Target Collapse View";
    } 
    else if (targetMode === 'prob') {
        waveMesh.visible = false;
        particleEmitter.visible = true;
        particleSystem.visible = false;
        landedSystem.visible = false;
        analyticalCurveMesh.visible = true; // Show smooth analytical probability distribution line
        if (particleMonitor) particleMonitor.style.display = 'none';
        
        annotationsArray[2].text = "Calculated Probability Density";
    }
    
    buildHUDLabels();
};

// Initialize default state elements
buildHUDLabels();
setMode('wave');


// 8. STEADY PROPAGATION ANIMATION PROCESSING LOOP

function animate() {
    requestAnimationFrame(animate);
    time += 0.09;

    if (currentMode === 'wave') {
        const attributesRef = waveMesh.geometry.attributes.position;
        const limitZ = -15; // Slit position boundary
        
        const transitionDist = limitZ - (-40); // Propagation phase depth
        
        // FIXED FORWARD DIRECTION: Inverting the wave calculation sign here
        // converts it to a forward-moving wave engine (+ time instead of - time)
        const entrancePhase = k * transitionDist + time;

        for (let i = 0; i < attributesRef.count; i++) {
            const currentX = attributesRef.getX(i);
            const currentZ = attributesRef.getY(i); // Internal tracking coordinates mapped on Y
            let computedHeight = 0;

            if (currentZ <= limitZ) {
                // FIXED FORWARD DIRECTION PLANE WAVE: 
                // Using + time causes ripples to march towards the screen obstacle cleanly
                let propagationDepth = currentZ - (-40);
                computedHeight = Math.sin(k * propagationDepth + time) * 1.6;
            } else {
                // Double Radial Slit coherent recombination equations
                let radialDistance1 = Math.sqrt(Math.pow(currentX - slitDist / 2, 2) + Math.pow(currentZ - limitZ, 2));
                let radialDistance2 = Math.sqrt(Math.pow(currentX + slitDist / 2, 2) + Math.pow(currentZ - limitZ, 2));
                
                // Fixed downstream phase coherence vectors
                let phaseDiff1 = Math.sin(k * radialDistance1 - entrancePhase);
                let phaseDiff2 = Math.sin(k * radialDistance2 - entrancePhase);
                
                // Geometric cylindrical scattering drop factor
                let falloffFactor1 = 0.6 / (1.0 + radialDistance1 * 0.06);
                let falloffFactor2 = 0.6 / (1.0 + radialDistance2 * 0.06);
                
                // Sub-slit aperture boundary isolation filters
                let spatialMuffling = Math.exp(-(currentZ - limitZ) * 0.12);
                let filterAperture1 = Math.exp(-Math.pow(currentX - slitDist / 2, 2) / 3.0);
                let filterAperture2 = Math.exp(-Math.pow(currentX + slitDist / 2, 2) / 3.0);
                let fringeDiffractionShadow = (filterAperture1 + filterAperture2) * spatialMuffling + (1.0 - spatialMuffling);
                
                computedHeight = (phaseDiff1 * falloffFactor1 + phaseDiff2 * falloffFactor2) * 1.6 * fringeDiffractionShadow;
            }
            attributesRef.setZ(i, computedHeight);
        }
        waveMesh.geometry.computeVertexNormals();
        attributesRef.needsUpdate = true;

        // Render Wave Mode Target Screen: Continuous Bright Glowing Interference Bands
        screenContext.fillStyle = '#030305';
        screenContext.fillRect(0, 0, screenCanvas.width, screenCanvas.height);
        
        for (let horizontalPixel = 0; horizontalPixel < screenCanvas.width; horizontalPixel++) {
            let relativeWorldX = ((horizontalPixel / screenCanvas.width) * 65) - 32.5;
            let intenseFactor = evaluateInterference(relativeWorldX);
            
            // Neon Cyan glowing bands calculation loop
            let rChannel = Math.floor(0 * intenseFactor);
            let gChannel = Math.floor(210 * intenseFactor);
            let bChannel = Math.floor(255 * intenseFactor);
            
            screenContext.fillStyle = `rgb(${rChannel}, ${gChannel}, ${bChannel})`;
            screenContext.fillRect(horizontalPixel, 0, 1, screenCanvas.height);
        }
        screenTexture.needsUpdate = true;
    } 
    else if (currentMode === 'particle') {
        if (Math.random() < 0.28) {
            triggerParticleEmission();
        }

        const particlePositionsAttr = particleSystem.geometry.attributes.position;
        const targetHUDCount = document.getElementById('hud-count');
        if (targetHUDCount) targetHUDCount.innerText = "Particles: " + particleCount.toLocaleString();

        for (let idx = 0; idx < maxParticles; idx++) {
            if (pLifeStates[idx] === 1) {
                let xPosition = particlePositionsAttr.getX(idx) + pVelocities[idx * 3];
                let yPosition = particlePositionsAttr.getY(idx) + pVelocities[idx * 3 + 1];
                let zPosition = particlePositionsAttr.getZ(idx) + pVelocities[idx * 3 + 2];

                // Check passage through slit position geometry boundary
                if (zPosition > -15 && particlePositionsAttr.getZ(idx) <= -15) {
                    xPosition = Math.random() > 0.5 ? slitDist / 2 : -slitDist / 2;
                }

                // Impact collision check on screen plane
                if (zPosition >= 31.8) {
                    pLifeStates[idx] = 0; // Return state to buffer
                    
                    // Quantum particles display exclusively where they register an impact dot on the detector screen
                    landedPositions.push(pFinalDestX[idx], yPosition, 31.6);
                    landedGeo.setAttribute('position', new THREE.Float32BufferAttribute(landedPositions, 3));
                    landedGeo.attributes.position.needsUpdate = true;
                    
                    zPosition = -42;
                }
                particlePositionsAttr.setXYZ(idx, xPosition, yPosition, zPosition);
            }
        }
        particlePositionsAttr.needsUpdate = true;

        // Render Particle Mode Screen Canvas: Cumulative discrete impacts only, absolutely no background glow lines
        screenContext.fillStyle = '#030305';
        screenContext.fillRect(0, 0, screenCanvas.width, screenCanvas.height);
        
        // Draw each accumulated classical collision event accurately
        for (let dotIdx = 0; dotIdx < landedPositions.length; dotIdx += 3) {
            let worldImpactX = landedPositions[dotIdx];
            let worldImpactY = landedPositions[dotIdx + 1];
            
            // Convert standard 3D world plane units back into high resolution canvas pixel mapping space
            let canvasPixelX = ((worldImpactX + 32.5) / 65) * screenCanvas.width;
            let canvasPixelY = ((worldImpactY + 12) / 24) * screenCanvas.height;
            
            screenContext.fillStyle = '#00ffcc';
            screenContext.fillRect(canvasPixelX, canvasPixelY, 2, 2);
        }
        screenTexture.needsUpdate = true;
    }
    else if (currentMode === 'prob') {
        // Probability view screen rendering logic - Kept purely dark with no bright background glowing tracks
        screenContext.fillStyle = '#030305';
        screenContext.fillRect(0, 0, screenCanvas.width, screenCanvas.height);
        screenTexture.needsUpdate = true;
    }

    controls.update();
    processLabelsTracking();
    renderer.render(scene, camera);
}

// Window resizing handler logic
window.addEventListener('resize', handleWindowResize, false);
function handleWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight ) ;
}

animate();