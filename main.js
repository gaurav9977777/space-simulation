// ============================================================
// THREE.JS (v0.180.0 via index.html importmap)
// ============================================================

import * as THREE from "three";

import {
    OrbitControls
} from "three/addons/controls/OrbitControls.js";


// ============================================================
// CONFIGURATION
// ============================================================

const CONFIG = {

    earthRadius: 2,

    // Primary operational orbit radius (3rd Orbit - Spacecraft Corridor)
    orbitRadius: 8,

    // Total initial debris distributed non-uniformly across 5 orbits
    initialDebris: 120,

    debrisSize: 0.14,

    // Five distinct LEO/MEO orbits with non-uniform debris distribution
    orbits: [
        {
            index: 0,
            number: 1,
            name: "Orbit 1 · VLEO Decay Zone",
            radius: 4.2,
            debrisCount: 10, // Sparse (~8.3%) - high atmospheric drag
            color: 0x38bdf8,
            opacity: 0.38,
            inclination: 0.08,
            speedMultiplier: 1.42
        },
        {
            index: 1,
            number: 2,
            name: "Orbit 2 · Sun-Sync Constellation",
            radius: 6.0,
            debrisCount: 36, // Dense (~30.0%) - commercial satellite shell
            color: 0x60a5fa,
            opacity: 0.58,
            inclination: 0.16,
            speedMultiplier: 1.18
        },
        {
            index: 2,
            number: 3,
            name: "Orbit 3 · Da Vinci Intercept Corridor",
            radius: 8.0,
            debrisCount: 44, // Peak Density (~36.7%) - Spacecraft operational orbit
            color: 0x00f0ff,
            opacity: 0.92,
            inclination: 0.10,
            speedMultiplier: 1.00
        },
        {
            index: 3,
            number: 4,
            name: "Orbit 4 · Upper LEO Transition",
            radius: 10.5,
            debrisCount: 22, // Moderate (~18.3%)
            color: 0x3b82f6,
            opacity: 0.45,
            inclination: 0.22,
            speedMultiplier: 0.82
        },
        {
            index: 4,
            number: 5,
            name: "Orbit 5 · High LEO Graveyard Fringe",
            radius: 13.2,
            debrisCount: 8,  // Very Sparse (~6.7%)
            color: 0x818cf8,
            opacity: 0.32,
            inclination: 0.28,
            speedMultiplier: 0.68
        }
    ],

    // Debris classification archetypes for Detection & Classification
    classifications: [
        {
            code: "CLASS-A",
            type: "Ti-Al Payload Fragment",
            threat: "MEDIUM",
            colorHex: 0x00f0ff,
            minMass: 18,
            maxMass: 85
        },
        {
            code: "CLASS-B",
            type: "Spent Upper Stage Hull",
            threat: "HIGH",
            colorHex: 0xfbbf24,
            minMass: 120,
            maxMass: 460
        },
        {
            code: "CLASS-C",
            type: "Hypervelocity Slag / Shrapnel",
            threat: "CRITICAL",
            colorHex: 0xf43f5e,
            minMass: 4,
            maxMass: 32
        },
        {
            code: "CLASS-D",
            type: "Defunct Comms Bus",
            threat: "LOW",
            colorHex: 0xa78bfa,
            minMass: 65,
            maxMass: 210
        }
    ]

};


// ============================================================
// SIMULATION & SPACECRAFT STATE
// ============================================================

const state = {

    running: true,

    globalSpeed: 1,

    nextID: 1

};

const spacecraftState = {

    orbitIndex: 2,              // 3rd Orbit (0-indexed -> index 2)
    orbitNumber: 3,
    baseRadius: CONFIG.orbits[2].radius, // Radius 8.0
    angle: 0.35,                // Current orbital phase angle (radians)
    baseAngularSpeed: 0.55,     // Base orbital speed in 3rd orbit
    direction: 1,               // 1 = Counter-clockwise, -1 = Clockwise

    // Player keyboard thruster offsets & velocities
    angularVelocityBoost: 0,    // W/S or ArrowUp/ArrowDown prograde/retrograde delta
    radialOffset: 0,            // A/E or ArrowLeft/ArrowRight lateral offset across orbit
    targetRadialOffset: 0,
    altitudeOffset: 0,          // Q/Z vertical offset
    targetAltitudeOffset: 0,

    // Four Core Spacecraft Functions (Code_Da_Vinci.pdf specs)
    detectionActive: true,      // [D] Detection & Classification radar active
    detectionRange: 4.0,        // Proximity detection radius
    captureRange: 2.5,          // [C] Grapple capture range
    collisionRadius: 0.52,      // Automatic physical collision capture radius
    deorbitRange: 4.4,          // [L] Retro-laser deorbit range

    detectedList: [],           // Nearby debris within detectionRange
    lockedTarget: null,         // Primary targeted debris

    // Cargo storage inside spacecraft (30 debris capacity per capsule)
    grappledDebris: null,       // Debris currently held by the external robotic capture claw
    cargoHold: [],              // Debris stored inside the spacecraft's internal cargo bay
    maxCargoCapacity: 30,       // Upgraded from 15 to 30 debris items
    totalCaptured: 0,
    totalDeorbited: 0,
    totalStored: 0,
    storedMassKg: 0,
    ejectedCapsulesCount: 0,

    cameraFollow: false,        // [V] Toggle camera chase view
    statusMessage: "Da Vinci Interceptor nominal in Orbit 3 (r = 8.0)",
    statusTone: "info"          // "info" | "success" | "warn" | "danger"

};

const activeEjectedCapsules = []; // 3D cargo capsules ejected from spacecraft descending to Earth

// Active keyboard state map for smooth continuous orbital movement
const keyState = {
    forward: false,     // W or ArrowUp
    backward: false,    // S or ArrowDown
    left: false,        // A or ArrowLeft (Radial Inward)
    right: false,       // E or ArrowRight (Radial Outward)
    up: false,          // Q (Altitude +Y)
    down: false         // Z (Altitude -Y)
};


// ============================================================
// SCENE
// ============================================================

const scene =
    new THREE.Scene();

scene.background =
    new THREE.Color(0x02040a);

scene.fog =
    new THREE.FogExp2(0x02040a, 0.0035);


// ============================================================
// CAMERA
// ============================================================

const camera =
    new THREE.PerspectiveCamera(

        50,

        window.innerWidth /
        window.innerHeight,

        0.1,

        1000

    );

camera.position.set(
    18,
    11,
    18
);


// ============================================================
// RENDERER
// ============================================================

const renderer =
    new THREE.WebGLRenderer({

        antialias: true,
        powerPreference: "high-performance"

    });

renderer.setPixelRatio(
    Math.min(
        window.devicePixelRatio,
        2
    )
);

renderer.setSize(
    window.innerWidth,
    window.innerHeight
);

renderer.outputColorSpace =
    THREE.SRGBColorSpace;

renderer.toneMapping =
    THREE.ACESFilmicToneMapping;

renderer.toneMappingExposure = 1.12;

document.body.appendChild(
    renderer.domElement
);


// ============================================================
// ORBIT CONTROLS
// ============================================================

const controls =
    new OrbitControls(

        camera,

        renderer.domElement

    );

controls.enableDamping = true;

controls.dampingFactor = 0.05;

controls.minDistance = 4;

controls.maxDistance = 60;

// Prevent OrbitControls built-in keyboard panning from conflicting with spacecraft keys
controls.enableKeys = false;


// ============================================================
// LIGHTING (Enhanced Multi-Source Orbital Illumination)
// ============================================================

const ambientLight =
    new THREE.AmbientLight(
        0xdbeafe,
        0.48
    );

scene.add(
    ambientLight
);

const hemiLight =
    new THREE.HemisphereLight(
        0x7dd3fc,
        0x090d16,
        0.55
    );

scene.add(
    hemiLight
);

const sunLight =
    new THREE.DirectionalLight(
        0xfff9ed,
        2.8
    );

sunLight.position.set(
    15,
    9,
    12
);

scene.add(
    sunLight
);

const rimLight =
    new THREE.DirectionalLight(
        0x38bdf8,
        0.5
    );

rimLight.position.set(
    -14,
    -6,
    -12
);

scene.add(
    rimLight
);


// ============================================================
// STAR FIELD
// ============================================================

function createStars() {

    const count = 3200;

    const positions =
        new Float32Array(
            count * 3
        );

    const colors =
        new Float32Array(
            count * 3
        );

    const starPalette = [
        new THREE.Color(0xffffff),
        new THREE.Color(0xbae6fd),
        new THREE.Color(0xfef08a),
        new THREE.Color(0xfde68a),
        new THREE.Color(0xc7d2fe)
    ];

    for (
        let i = 0;
        i < positions.length;
        i += 3
    ) {

        const radius =
            85 +
            Math.random() * 115;

        const theta =
            Math.random() *
            Math.PI * 2;

        const phi =
            Math.acos(
                2 * Math.random() - 1
            );

        positions[i] =
            radius *
            Math.sin(phi) *
            Math.cos(theta);

        positions[i + 1] =
            radius *
            Math.cos(phi);

        positions[i + 2] =
            radius *
            Math.sin(phi) *
            Math.sin(theta);

        const c =
            starPalette[
                Math.floor(Math.random() * starPalette.length)
            ];

        colors[i] = c.r;
        colors[i + 1] = c.g;
        colors[i + 2] = c.b;

    }

    const geometry =
        new THREE.BufferGeometry();

    geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(
            positions,
            3
        )
    );

    geometry.setAttribute(
        "color",
        new THREE.BufferAttribute(
            colors,
            3
        )
    );

    const material =
        new THREE.PointsMaterial({

            size: 0.11,
            vertexColors: true,
            transparent: true,
            opacity: 0.9

        });

    const stars =
        new THREE.Points(
            geometry,
            material
        );

    scene.add(stars);

}

createStars();


// ============================================================
// REALISTIC EARTH (Procedural High-Res PBR Maps + Shader Atmosphere)
// ============================================================

/**
 * Generates high-resolution 2048x1024 procedural planetary textures
 * (Albedo/Biomes, Topographic Bump, Ocean/Land Roughness, Night City Lights, Clouds)
 * so Earth renders with high visual fidelity and zero external CORS failures.
 */
function generateRealisticEarthMaps() {

    const width = 1024;
    const height = 512;

    const albedoCanvas = document.createElement("canvas");
    albedoCanvas.width = width;
    albedoCanvas.height = height;
    const albedoCtx = albedoCanvas.getContext("2d");

    const roughnessCanvas = document.createElement("canvas");
    roughnessCanvas.width = width;
    roughnessCanvas.height = height;
    const roughCtx = roughnessCanvas.getContext("2d");

    const bumpCanvas = document.createElement("canvas");
    bumpCanvas.width = width;
    bumpCanvas.height = height;
    const bumpCtx = bumpCanvas.getContext("2d");

    const emissiveCanvas = document.createElement("canvas");
    emissiveCanvas.width = width;
    emissiveCanvas.height = height;
    const emissiveCtx = emissiveCanvas.getContext("2d");

    const cloudsCanvas = document.createElement("canvas");
    cloudsCanvas.width = width;
    cloudsCanvas.height = height;
    const cloudsCtx = cloudsCanvas.getContext("2d");

    // Deterministic pseudo-noise helper for realistic continents & clouds
    function hash2(x, y) {
        const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
        return s - Math.floor(s);
    }

    function smoothNoise(x, y) {
        const ix = Math.floor(x);
        const iy = Math.floor(y);
        const fx = x - ix;
        const fy = y - iy;
        const ux = fx * fx * (3 - 2 * fx);
        const uy = fy * fy * (3 - 2 * fy);

        const a = hash2(ix, iy);
        const b = hash2(ix + 1, iy);
        const c = hash2(ix, iy + 1);
        const d = hash2(ix + 1, iy + 1);

        return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
    }

    function fbm(x, y, octaves = 5) {
        let value = 0;
        let amp = 0.5;
        let freq = 1;
        for (let i = 0; i < octaves; i++) {
            value += amp * smoothNoise(x * freq, y * freq);
            freq *= 2.04;
            amp *= 0.5;
        }
        return value;
    }

    // Major continental landmass lobes in normalized (u, v) coordinates
    const landmasses = [
        { u: 0.22, v: 0.30, rx: 0.11, ry: 0.14, weight: 0.62 }, // North America
        { u: 0.30, v: 0.62, rx: 0.07, ry: 0.16, weight: 0.60 }, // South America
        { u: 0.52, v: 0.28, rx: 0.08, ry: 0.10, weight: 0.58 }, // Europe
        { u: 0.54, v: 0.52, rx: 0.09, ry: 0.17, weight: 0.65 }, // Africa
        { u: 0.70, v: 0.30, rx: 0.16, ry: 0.14, weight: 0.68 }, // Asia
        { u: 0.82, v: 0.68, rx: 0.07, ry: 0.08, weight: 0.56 }, // Australia
        { u: 0.36, v: 0.14, rx: 0.05, ry: 0.05, weight: 0.52 }  // Greenland
    ];

    const albedoData = albedoCtx.createImageData(width, height);
    const roughData = roughCtx.createImageData(width, height);
    const bumpData = bumpCtx.createImageData(width, height);
    const emissiveData = emissiveCtx.createImageData(width, height);
    const cloudsData = cloudsCtx.createImageData(width, height);

    for (let y = 0; y < height; y++) {
        const v = y / height;
        const lat = Math.abs(v - 0.5) * 2; // 0 at equator, 1 at poles

        for (let x = 0; x < width; x++) {
            const u = x / width;
            const idx = (y * width + x) * 4;

            // Evaluate continental masks + fractal coastline distortion
            let continentMask = 0;
            for (let m = 0; m < landmasses.length; m++) {
                const lm = landmasses[m];
                const dx = (u - lm.u) / lm.rx;
                const dy = (v - lm.v) / lm.ry;
                const distSq = dx * dx + dy * dy;
                if (distSq < 2.2) {
                    continentMask = Math.max(
                        continentMask,
                        (1 - distSq * 0.55) * lm.weight
                    );
                }
            }

            // Antarctic continent at south pole
            if (v > 0.89) {
                continentMask = Math.max(continentMask, (v - 0.86) * 4.2);
            }

            const detail = fbm(u * 12 + 1.7, v * 6 + 3.1, 6);
            const microDetail = fbm(u * 36 + 7.2, v * 18 + 5.4, 4);
            const elevation = continentMask + detail * 0.58 + microDetail * 0.16 - 0.49;

            let r = 0, g = 0, b = 0;
            let rough = 210; // default rough
            let bumpVal = 128;
            let cityR = 0, cityG = 0, cityB = 0;

            // Polar sea ice cap check
            const iceEdge = 0.87 - detail * 0.08;
            if (lat > iceEdge) {
                // Polar ice cap
                r = 232 + microDetail * 20;
                g = 242 + microDetail * 12;
                b = 250;
                rough = 110;
                bumpVal = 150;
            } else if (elevation <= 0) {
                // Ocean depth shading (deep trench vs coastal turquoise shelf)
                const depth = Math.min(1, Math.abs(elevation) * 3.5);
                const shelf = Math.pow(1 - depth, 3);
                r = Math.round(6 + shelf * 22 + microDetail * 6);
                g = Math.round(28 + (1 - depth) * 58 + shelf * 45);
                b = Math.round(68 + (1 - depth) * 76 + shelf * 36);
                // Specular shiny ocean water
                rough = 38;
                bumpVal = 124;
            } else {
                // Land biomes based on latitude, moisture, and elevation
                rough = 215;
                bumpVal = Math.min(255, Math.round(130 + elevation * 260 + microDetail * 30));

                const moisture = fbm(u * 10 + 9.4, v * 8 + 2.1, 4);
                if (elevation > 0.34) {
                    // High alpine mountains / snowline
                    r = 215 + microDetail * 32;
                    g = 220 + microDetail * 30;
                    b = 226 + microDetail * 25;
                    rough = 175;
                } else if (elevation > 0.23) {
                    // Rocky highlands
                    r = 115 + microDetail * 25;
                    g = 104 + microDetail * 22;
                    b = 92 + microDetail * 18;
                } else if (lat < 0.42 && moisture < 0.45) {
                    // Subtropical desert / arid dunes (Sahara, Arabia, Outback)
                    r = 188 + microDetail * 32;
                    g = 156 + microDetail * 25;
                    b = 104 + microDetail * 18;
                } else if (lat < 0.25) {
                    // Equatorial rainforest
                    r = 26 + microDetail * 18;
                    g = 84 + microDetail * 28;
                    b = 38 + microDetail * 14;
                } else {
                    // Temperate forest & grasslands
                    r = 44 + (1 - moisture) * 42 + microDetail * 18;
                    g = 98 + moisture * 24 + microDetail * 22;
                    b = 46 + microDetail * 15;
                }

                // Urban night-side city light clusters near coasts & temperate bands
                if (elevation > 0.005 && elevation < 0.16 && lat > 0.08 && lat < 0.65) {
                    const urbanNoise = hash2(Math.floor(u * 220), Math.floor(v * 110));
                    if (urbanNoise > 0.78 && microDetail > 0.52) {
                        const intensity = (urbanNoise - 0.78) * 4.5;
                        cityR = Math.min(255, Math.round(255 * intensity));
                        cityG = Math.min(255, Math.round(195 * intensity));
                        cityB = Math.min(255, Math.round(95 * intensity));
                    }
                }
            }

            albedoData.data[idx] = Math.min(255, Math.max(0, r));
            albedoData.data[idx + 1] = Math.min(255, Math.max(0, g));
            albedoData.data[idx + 2] = Math.min(255, Math.max(0, b));
            albedoData.data[idx + 3] = 255;

            roughData.data[idx] = rough;
            roughData.data[idx + 1] = rough;
            roughData.data[idx + 2] = rough;
            roughData.data[idx + 3] = 255;

            bumpData.data[idx] = bumpVal;
            bumpData.data[idx + 1] = bumpVal;
            bumpData.data[idx + 2] = bumpVal;
            bumpData.data[idx + 3] = 255;

            emissiveData.data[idx] = cityR;
            emissiveData.data[idx + 1] = cityG;
            emissiveData.data[idx + 2] = cityB;
            emissiveData.data[idx + 3] = 255;

            // Dynamic swirling atmospheric cloud bands
            const swirl = Math.sin(v * Math.PI * 6 + detail * 4.2) * 0.12;
            const cloudDensity = fbm(u * 14 + swirl, v * 9 - swirl, 5);
            const cloudAlpha = Math.max(0, Math.min(255, Math.round((cloudDensity - 0.48) * 520)));

            cloudsData.data[idx] = 250;
            cloudsData.data[idx + 1] = 253;
            cloudsData.data[idx + 2] = 255;
            cloudsData.data[idx + 3] = cloudAlpha;
        }
    }

    albedoCtx.putImageData(albedoData, 0, 0);
    roughCtx.putImageData(roughData, 0, 0);
    bumpCtx.putImageData(bumpData, 0, 0);
    emissiveCtx.putImageData(emissiveData, 0, 0);
    cloudsCtx.putImageData(cloudsData, 0, 0);

    const colorTexture = new THREE.CanvasTexture(albedoCanvas);
    colorTexture.colorSpace = THREE.SRGBColorSpace;
    colorTexture.wrapS = THREE.RepeatWrapping;
    colorTexture.wrapT = THREE.ClampToEdgeWrapping;

    const roughnessTexture = new THREE.CanvasTexture(roughnessCanvas);
    roughnessTexture.wrapS = THREE.RepeatWrapping;
    roughnessTexture.wrapT = THREE.ClampToEdgeWrapping;

    const bumpTexture = new THREE.CanvasTexture(bumpCanvas);
    bumpTexture.wrapS = THREE.RepeatWrapping;
    bumpTexture.wrapT = THREE.ClampToEdgeWrapping;

    const emissiveTexture = new THREE.CanvasTexture(emissiveCanvas);
    emissiveTexture.colorSpace = THREE.SRGBColorSpace;
    emissiveTexture.wrapS = THREE.RepeatWrapping;
    emissiveTexture.wrapT = THREE.ClampToEdgeWrapping;

    const cloudsTexture = new THREE.CanvasTexture(cloudsCanvas);
    cloudsTexture.colorSpace = THREE.SRGBColorSpace;
    cloudsTexture.wrapS = THREE.RepeatWrapping;
    cloudsTexture.wrapT = THREE.ClampToEdgeWrapping;

    return {
        colorTexture,
        roughnessTexture,
        bumpTexture,
        emissiveTexture,
        cloudsTexture
    };

}

const earthMaps = generateRealisticEarthMaps();

const earthGeometry =
    new THREE.SphereGeometry(

        CONFIG.earthRadius,

        96,

        96

    );

const earthMaterial =
    new THREE.MeshStandardMaterial({

        map: earthMaps.colorTexture,

        roughnessMap: earthMaps.roughnessTexture,

        bumpMap: earthMaps.bumpTexture,

        bumpScale: 0.05,

        emissive: new THREE.Color(0xffb84d),

        emissiveMap: earthMaps.emissiveTexture,

        emissiveIntensity: 0.42,

        roughness: 0.72,

        metalness: 0.08

    });

const earth =
    new THREE.Mesh(

        earthGeometry,

        earthMaterial

    );

// Realistic axial tilt (~23.4 degrees)
earth.rotation.z = THREE.MathUtils.degToRad(23.4);

scene.add(earth);


// ============================================================
// EARTH CLOUD LAYER & TACTICAL SURFACE GRID DETAIL
// ============================================================

const earthCloudsGeometry =
    new THREE.SphereGeometry(
        CONFIG.earthRadius * 1.014,
        64,
        64
    );

const earthCloudsMaterial =
    new THREE.MeshStandardMaterial({
        map: earthMaps.cloudsTexture,
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
        roughness: 0.9,
        metalness: 0.0
    });

const earthClouds =
    new THREE.Mesh(
        earthCloudsGeometry,
        earthCloudsMaterial
    );

earth.add(earthClouds);

// Preserve earthDetail reference with subtle planetary telemetry wireframe
const earthDetailGeometry =
    new THREE.SphereGeometry(

        CONFIG.earthRadius * 1.006,

        32,

        16

    );

const earthDetailMaterial =
    new THREE.MeshBasicMaterial({

        color: 0x38bdf8,

        wireframe: true,

        transparent: true,

        opacity: 0.06

    });

const earthDetail =
    new THREE.Mesh(

        earthDetailGeometry,

        earthDetailMaterial

    );

earth.add(
    earthDetail
);


// ============================================================
// ATMOSPHERE (Rayleigh & Fresnel Shader Halo + Inner Scatter)
// ============================================================

const atmosphereGeometry =
    new THREE.SphereGeometry(

        CONFIG.earthRadius * 1.14,

        64,

        64

    );

const atmosphereShaderMaterial =
    new THREE.ShaderMaterial({
        uniforms: {
            uSunDirection: { value: sunLight.position.clone().normalize() },
            uDayColor: { value: new THREE.Color(0x38bdf8) },
            uTwilightColor: { value: new THREE.Color(0x1d4ed8) }
        },
        vertexShader: `
            varying vec3 vNormal;
            varying vec3 vWorldPosition;
            void main() {
                vNormal = normalize(normalMatrix * normal);
                vec4 worldPos = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPos.xyz;
                gl_Position = projectionMatrix * viewMatrix * worldPos;
            }
        `,
        fragmentShader: `
            uniform vec3 uSunDirection;
            uniform vec3 uDayColor;
            uniform vec3 uTwilightColor;
            varying vec3 vNormal;
            varying vec3 vWorldPosition;
            void main() {
                vec3 viewDir = normalize(cameraPosition - vWorldPosition);
                float fresnel = pow(1.0 - abs(dot(vNormal, viewDir)), 3.2);
                float sunFactor = smoothstep(-0.35, 0.65, dot(normalize(vWorldPosition), uSunDirection));
                vec3 col = mix(uTwilightColor, uDayColor, sunFactor);
                float alpha = fresnel * (0.25 + 0.65 * sunFactor);
                gl_FragColor = vec4(col, alpha);
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false
    });

const atmosphere =
    new THREE.Mesh(

        atmosphereGeometry,

        atmosphereShaderMaterial

    );

scene.add(
    atmosphere
);

// Inner lower-stratosphere haze
const innerAtmosphereMesh =
    new THREE.Mesh(
        new THREE.SphereGeometry(CONFIG.earthRadius * 1.03, 64, 64),
        new THREE.MeshBasicMaterial({
            color: 0x60a5fa,
            transparent: true,
            opacity: 0.11,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        })
    );
scene.add(innerAtmosphereMesh);


// ============================================================
// FIVE ORBIT RINGS (Non-Uniform LEO/MEO Shells)
// ============================================================

const orbitLines = [];

function createOrbits() {

    const segments = 256;

    for (let o = 0; o < CONFIG.orbits.length; o++) {

        const orb = CONFIG.orbits[o];
        const points = [];

        for (let i = 0; i < segments; i++) {

            const angle = (i / segments) * Math.PI * 2;

            // Subtle orbital plane inclination for realistic multi-shell visualization
            const x = Math.cos(angle) * orb.radius;
            const z = Math.sin(angle) * orb.radius;
            const y = Math.sin(angle) * orb.radius * (orb.index === 2 ? 0 : orb.inclination * 0.22);

            points.push(new THREE.Vector3(x, y, z));

        }

        const geometry =
            new THREE.BufferGeometry().setFromPoints(points);

        const material =
            new THREE.LineBasicMaterial({
                color: orb.color,
                transparent: true,
                opacity: orb.opacity
            });

        const orbitRing =
            new THREE.LineLoop(geometry, material);

        scene.add(orbitRing);
        orbitLines.push(orbitRing);

        // Add subtle inner/outer corridor guide rings for the 3rd Orbit (Spacecraft Corridor)
        if (orb.index === 2) {
            for (const offset of [-0.95, 0.95]) {
                const boundaryPts = [];
                for (let i = 0; i < segments; i++) {
                    const angle = (i / segments) * Math.PI * 2;
                    boundaryPts.push(
                        new THREE.Vector3(
                            Math.cos(angle) * (orb.radius + offset),
                            0,
                            Math.sin(angle) * (orb.radius + offset)
                        )
                    );
                }
                const boundLine = new THREE.LineLoop(
                    new THREE.BufferGeometry().setFromPoints(boundaryPts),
                    new THREE.LineBasicMaterial({
                        color: 0x00f0ff,
                        transparent: true,
                        opacity: 0.16
                    })
                );
                scene.add(boundLine);
            }
        }

    }

}

createOrbits();


// ============================================================
// SHARED DEBRIS GEOMETRY & MATERIALS
// ============================================================

const debrisGeometries = [
    new THREE.IcosahedronGeometry(CONFIG.debrisSize, 0),
    new THREE.DodecahedronGeometry(CONFIG.debrisSize * 1.08, 0),
    new THREE.OctahedronGeometry(CONFIG.debrisSize * 0.95, 0),
    new THREE.BoxGeometry(CONFIG.debrisSize * 1.3, CONFIG.debrisSize * 0.7, CONFIG.debrisSize * 1.1)
];

const baseDebrisMaterial =
    new THREE.MeshStandardMaterial({

        color: 0xd7dce3,

        roughness: 0.48,

        metalness: 0.78

    });


// ============================================================
// DEBRIS ARRAY & NON-UNIFORM DISTRIBUTION HELPERS
// ============================================================

const debrisList = [];
const deorbitingTrajectories = []; // Active visual descent trajectories
const activeTransientEffects = []; // Lasers, capture bursts, re-entry fireballs

/**
 * Picks an orbit index weighted by the non-uniform distribution in CONFIG.orbits
 */
function pickWeightedOrbitIndex() {
    const totalWeight = CONFIG.orbits.reduce((sum, o) => sum + o.debrisCount, 0);
    let r = Math.random() * totalWeight;
    for (let i = 0; i < CONFIG.orbits.length; i++) {
        r -= CONFIG.orbits[i].debrisCount;
        if (r <= 0) return i;
    }
    return 2; // Default to 3rd orbit
}


// ============================================================
// CREATE DEBRIS
// ============================================================

function createDebris(
    angle = Math.random() * Math.PI * 2,
    orbitIndex = null,
    isRecycledObject = false
) {

    const chosenOrbitIdx =
        orbitIndex !== null
            ? orbitIndex
            : pickWeightedOrbitIndex();

    const orbitCfg =
        CONFIG.orbits[chosenOrbitIdx] || CONFIG.orbits[2];

    const classification =
        CONFIG.classifications[
            Math.floor(Math.random() * CONFIG.classifications.length)
        ];

    const geom =
        debrisGeometries[
            Math.floor(Math.random() * debrisGeometries.length)
        ];

    // Individual material clone so detected/deorbiting/recycled debris can glow independently
    const mat = baseDebrisMaterial.clone();
    if (isRecycledObject) {
        mat.color.setHex(0x34d399);
        mat.emissive.setHex(0x059669);
        mat.emissiveIntensity = 0.45;
    }

    const mesh =
        new THREE.Mesh(geom, mat);

    const data =
        mesh.userData;

    data.id =
        state.nextID++;

    data.orbitIndex =
        orbitCfg.index;

    data.orbitNumber =
        orbitCfg.number;

    data.orbitName =
        orbitCfg.name;

    data.angle =
        angle;

    // Keep Orbit 3 debris well within the spacecraft's intercept band
    const radialSpread =
        chosenOrbitIdx === 2 ? 0.95 : 0.75;

    data.radius =
        orbitCfg.radius +
        (Math.random() - 0.5) * radialSpread;

    data.baseRadius =
        data.radius;

    const verticalSpread =
        chosenOrbitIdx === 2 ? 0.85 : 1.35;

    data.height =
        (Math.random() - 0.5) * verticalSpread;

    data.inclinationPhase =
        Math.random() * Math.PI * 2;

    data.inclinationAmp =
        chosenOrbitIdx === 2
            ? (Math.random() - 0.5) * 0.32
            : (Math.random() - 0.5) * orbitCfg.inclination * orbitCfg.radius * 0.35;

    data.speed =
        Number(
            ((0.45 + Math.random() * 1.35) * orbitCfg.speedMultiplier).toFixed(2)
        );

    // Primarily prograde (CCW = 1) in Orbit 3 so spacecraft can smoothly stalk & intercept
    data.direction =
        chosenOrbitIdx === 2
            ? (Math.random() > 0.18 ? 1 : -1)
            : (Math.random() > 0.35 ? 1 : -1);

    data.spinSpeed =
        Number((0.5 + Math.random() * 2.0).toFixed(2));

    data.axis =
        ["x", "y", "z"][
            Math.floor(Math.random() * 3)
        ];

    // Classification metadata for Detection, Capture, Deorbit, and Recycling
    data.classCode =
        isRecycledObject ? "REC-NODE" : classification.code;

    data.classType =
        isRecycledObject ? "Refurbished Telemetry Node" : classification.type;

    data.threatLevel =
        isRecycledObject ? "SAFE" : classification.threat;

    data.classColor =
        isRecycledObject ? 0x34d399 : classification.colorHex;

    data.massKg =
        Math.round(
            classification.minMass +
            Math.random() * (classification.maxMass - classification.minMass)
        );

    data.status = "orbiting"; // "orbiting" | "deorbiting"
    data.isRecycled = isRecycledObject;

    updateDebrisPosition(mesh);

    mesh.rotation.x =
        Math.random() * Math.PI;

    mesh.rotation.y =
        Math.random() * Math.PI;

    mesh.rotation.z =
        Math.random() * Math.PI;

    scene.add(mesh);

    debrisList.push(mesh);

    return mesh;

}


// ============================================================
// UPDATE DEBRIS POSITION
// ============================================================

function updateDebrisPosition(mesh) {

    const data =
        mesh.userData;

    mesh.position.x =
        Math.cos(data.angle) *
        data.radius;

    mesh.position.y =
        data.height +
        Math.sin(data.angle + (data.inclinationPhase || 0)) *
        (data.inclinationAmp || 0);

    mesh.position.z =
        Math.sin(data.angle) *
        data.radius;

}


// ============================================================
// POPULATE 5 ORBITS WITH NON-UNIFORM DEBRIS DISTRIBUTION
// ============================================================

function populateInitialOrbits() {

    for (let o = 0; o < CONFIG.orbits.length; o++) {

        const orb = CONFIG.orbits[o];

        for (let i = 0; i < orb.debrisCount; i++) {

            // Add clustered density pockets + angular jitter to mimic breakup clouds in LEO
            const clusterOffset =
                (i % 3 === 0)
                    ? (Math.random() - 0.5) * 0.35
                    : (Math.random() - 0.5) * 0.12;

            const angle =
                (i / orb.debrisCount) * Math.PI * 2 + clusterOffset;

            createDebris(angle, o, false);

        }

    }

}

populateInitialOrbits();


// ============================================================
// SPACECRAFT IN 3RD ORBIT (DA VINCI ORBITAL SERVICING VEHICLE)
// ============================================================

const spacecraftGroup = new THREE.Group();
let spacecraftThrusterFlame = null;
let spacecraftRadarDish = null;
let targetReticleGroup = null;
let detectionLockLine = null;

function createSpacecraft() {

    // 1. Central octagonal gold-foil & titanium bus
    const busGeom = new THREE.CylinderGeometry(0.22, 0.25, 0.72, 8);
    busGeom.rotateX(Math.PI / 2);
    const busMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        roughness: 0.32,
        metalness: 0.88
    });
    const busMesh = new THREE.Mesh(busGeom, busMat);
    spacecraftGroup.add(busMesh);

    // 2. Forward command & avionics module
    const noseGeom = new THREE.CylinderGeometry(0.14, 0.22, 0.28, 8);
    noseGeom.rotateX(Math.PI / 2);
    const noseMat = new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        roughness: 0.25,
        metalness: 0.85
    });
    const noseMesh = new THREE.Mesh(noseGeom, noseMat);
    noseMesh.position.z = 0.48;
    spacecraftGroup.add(noseMesh);

    // 3. Rotating Multi-Spectral Detection Radar Dish & LiDAR Dome
    spacecraftRadarDish = new THREE.Group();
    spacecraftRadarDish.position.set(0, 0.24, 0.22);

    const dishMesh = new THREE.Mesh(
        new THREE.ConeGeometry(0.18, 0.1, 16, 1, true),
        new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            emissive: 0x0284c7,
            emissiveIntensity: 0.6,
            side: THREE.DoubleSide,
            metalness: 0.7,
            roughness: 0.2
        })
    );
    dishMesh.rotation.x = -Math.PI / 2;
    spacecraftRadarDish.add(dishMesh);

    const beaconLight = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0x00f0ff })
    );
    beaconLight.position.z = 0.08;
    spacecraftRadarDish.add(beaconLight);
    spacecraftGroup.add(spacecraftRadarDish);

    // 4. Dual Photovoltaic Solar Wing Arrays (Port & Starboard)
    const panelGeom = new THREE.BoxGeometry(1.75, 0.025, 0.42);
    const panelMat = new THREE.MeshStandardMaterial({
        color: 0x1d4ed8,
        emissive: 0x1e3a8a,
        emissiveIntensity: 0.38,
        roughness: 0.2,
        metalness: 0.9
    });
    const solarWings = new THREE.Mesh(panelGeom, panelMat);
    solarWings.position.set(0, 0, -0.04);
    spacecraftGroup.add(solarWings);

    // Solar wing structural struts
    const strutMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.82, 0.04, 0.04),
        new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 })
    );
    strutMesh.position.set(0, 0, -0.04);
    spacecraftGroup.add(strutMesh);

    // 5. Dual Forward Robotic Capture Grappler Arms & Deorbit Laser Emitter
    for (const side of [-1, 1]) {
        const arm = new THREE.Mesh(
            new THREE.CylinderGeometry(0.025, 0.025, 0.36, 8),
            new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.85 })
        );
        arm.rotation.x = Math.PI / 2;
        arm.position.set(side * 0.13, -0.06, 0.74);
        spacecraftGroup.add(arm);

        const claw = new THREE.Mesh(
            new THREE.TorusGeometry(0.05, 0.014, 8, 16, Math.PI * 1.3),
            new THREE.MeshBasicMaterial({ color: 0x10b981 })
        );
        claw.position.set(side * 0.13, -0.06, 0.92);
        spacecraftGroup.add(claw);
    }

    // 6. Aft Hall-Effect Ion Thruster Nozzle & Plasma Plume
    const thrusterNozzle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.17, 0.18, 12),
        new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9, roughness: 0.3 })
    );
    thrusterNozzle.rotation.x = Math.PI / 2;
    thrusterNozzle.position.z = -0.44;
    spacecraftGroup.add(thrusterNozzle);

    const flameGeom = new THREE.ConeGeometry(0.13, 0.55, 12);
    flameGeom.rotateX(-Math.PI / 2);
    const flameMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending
    });
    spacecraftThrusterFlame = new THREE.Mesh(flameGeom, flameMat);
    spacecraftThrusterFlame.position.z = -0.75;
    spacecraftGroup.add(spacecraftThrusterFlame);

    // Local point light on spacecraft so it illuminates nearby targets
    const craftLight = new THREE.PointLight(0x00f0ff, 1.4, 5.5);
    craftLight.position.set(0, 0.3, 0.6);
    spacecraftGroup.add(craftLight);

    scene.add(spacecraftGroup);

    // 7. 3D Target Lock Reticle (Highlights primary locked debris in space)
    targetReticleGroup = new THREE.Group();
    const outerRing = new THREE.Mesh(
        new THREE.RingGeometry(0.28, 0.34, 24),
        new THREE.MeshBasicMaterial({
            color: 0x00f0ff,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.92
        })
    );
    const innerRing = new THREE.Mesh(
        new THREE.RingGeometry(0.17, 0.21, 4),
        new THREE.MeshBasicMaterial({
            color: 0xfbbf24,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.88
        })
    );
    targetReticleGroup.add(outerRing);
    targetReticleGroup.add(innerRing);
    targetReticleGroup.visible = false;
    scene.add(targetReticleGroup);

    // 8. Sensor Lock Telemetry Line connecting Spacecraft -> Locked Target
    const lockLineGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(),
        new THREE.Vector3()
    ]);
    const lockLineMat = new THREE.LineBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.65
    });
    detectionLockLine = new THREE.Line(lockLineGeom, lockLineMat);
    detectionLockLine.visible = false;
    scene.add(detectionLockLine);

    updateSpacecraftTransform(0);

}

/**
 * Updates the spacecraft's orbital position in the 3rd Orbit (baseRadius = 8.0)
 * and aligns its heading tangent to its orbital velocity vector.
 */
function updateSpacecraftTransform(delta) {

    // Smoothly interpolate lateral radial and vertical offsets
    spacecraftState.radialOffset = THREE.MathUtils.lerp(
        spacecraftState.radialOffset,
        spacecraftState.targetRadialOffset,
        Math.min(1, delta * 7.5 || 1)
    );

    spacecraftState.altitudeOffset = THREE.MathUtils.lerp(
        spacecraftState.altitudeOffset,
        spacecraftState.targetAltitudeOffset,
        Math.min(1, delta * 7.5 || 1)
    );

    const effectiveRadius =
        spacecraftState.baseRadius + spacecraftState.radialOffset;

    const x = Math.cos(spacecraftState.angle) * effectiveRadius;
    const z = Math.sin(spacecraftState.angle) * effectiveRadius;
    const y = spacecraftState.altitudeOffset;

    spacecraftGroup.position.set(x, y, z);

    // Compute forward tangent vector along the 3rd orbit in direction of motion
    const lookAheadAngle =
        spacecraftState.angle + 0.08 * spacecraftState.direction;

    const targetPos = new THREE.Vector3(
        Math.cos(lookAheadAngle) * effectiveRadius,
        y,
        Math.sin(lookAheadAngle) * effectiveRadius
    );

    spacecraftGroup.lookAt(targetPos);

}

createSpacecraft();


// ============================================================
// VISUAL TRANSIENT EFFECTS (Beams, Shockwaves, Re-Entry Flashes)
// ============================================================

/**
 * Creates a temporary 3D energy beam (Capture Grapple or Deorbit Laser)
 */
function spawnActionBeam(startVec, endVec, colorHex, duration = 0.45) {

    const points = [startVec.clone(), endVec.clone()];
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 1.0
    });
    const beam = new THREE.Line(geom, mat);
    scene.add(beam);

    activeTransientEffects.push({
        type: "beam",
        mesh: beam,
        age: 0,
        duration
    });

}

/**
 * Creates an expanding flat ring pulse at a target coordinate
 */
function spawnPulseEffect(positionVec, colorHex, maxScale = 2.5, duration = 0.55) {

    const geom = new THREE.RingGeometry(0.16, 0.22, 32);
    geom.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
        color: colorHex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(positionVec);
    scene.add(mesh);

    activeTransientEffects.push({
        type: "pulse",
        mesh,
        age: 0,
        duration,
        maxScale
    });

}


// ============================================================
// FOUR CORE SPACECRAFT FUNCTIONS (Code_Da_Vinci.pdf)
// ============================================================

function setSpacecraftStatus(message, tone = "info") {

    spacecraftState.statusMessage = message;
    spacecraftState.statusTone = tone;

    const msgEl = document.getElementById("scStatusBanner");
    if (msgEl) {
        msgEl.textContent = message;
        msgEl.dataset.tone = tone;
    }

}

/**
 * 1. DETECTION & CLASSIFICATION (Key: [D])
 * Scans proximity around the spacecraft in Orbit 3, classifies nearby debris
 * by material/mass/threat, highlights detected objects, and locks the primary target.
 */
function runDetectionAndClassification(manualTrigger = false) {

    const scPos = spacecraftGroup.position;
    const detected = [];

    for (let i = 0; i < debrisList.length; i++) {

        const mesh = debrisList[i];
        const data = mesh.userData;

        // Ignore debris already descending into Earth's atmosphere
        if (data.status === "deorbiting") continue;

        const dist = scPos.distanceTo(mesh.position);
        data.distanceToSpacecraft = dist;

        if (dist <= spacecraftState.detectionRange && spacecraftState.detectionActive) {
            detected.push(mesh);

            // Visually highlight classified debris by threat/class color
            if (mesh.material && mesh.material.emissive) {
                mesh.material.emissive.setHex(data.classColor || 0x00f0ff);
                mesh.material.emissiveIntensity = 0.65;
            }
        } else {
            // Restore standard appearance when outside detection envelope
            if (mesh.material && mesh.material.emissive) {
                if (data.isRecycled) {
                    mesh.material.emissive.setHex(0x059669);
                    mesh.material.emissiveIntensity = 0.4;
                } else {
                    mesh.material.emissive.setHex(0x000000);
                    mesh.material.emissiveIntensity = 0;
                }
            }
        }

    }

    // Sort detected targets by proximity (closest first)
    detected.sort((a, b) => a.userData.distanceToSpacecraft - b.userData.distanceToSpacecraft);

    spacecraftState.detectedList = detected;
    spacecraftState.lockedTarget = detected.length > 0 ? detected[0] : null;

    // Update 3D Target Reticle & Sensor Lock Line
    if (spacecraftState.lockedTarget && spacecraftState.detectionActive) {
        const target = spacecraftState.lockedTarget;
        targetReticleGroup.visible = true;
        targetReticleGroup.position.copy(target.position);
        targetReticleGroup.lookAt(camera.position);

        detectionLockLine.visible = true;
        const posAttr = detectionLockLine.geometry.attributes.position;
        posAttr.setXYZ(0, scPos.x, scPos.y, scPos.z);
        posAttr.setXYZ(1, target.position.x, target.position.y, target.position.z);
        posAttr.needsUpdate = true;
    } else {
        targetReticleGroup.visible = false;
        detectionLockLine.visible = false;
    }

    if (manualTrigger) {
        // Trigger active LiDAR sweep pulse & log primary target
        spacecraftState.detectionActive = true;
        spawnPulseEffect(scPos, 0x00f0ff, spacecraftState.detectionRange * 1.5, 0.55);

        if (spacecraftState.lockedTarget) {
            const tData = spacecraftState.lockedTarget.userData;
            setSpacecraftStatus(
                `📡 DETECTED ${detected.length} target(s) · Locked #${tData.id} [${tData.classCode}: ${tData.classType}, ${tData.massKg}kg, Threat: ${tData.threatLevel}]`,
                "info"
            );
        } else {
            setSpacecraftStatus(
                `📡 Radar Sweep Complete · 0 targets within ${spacecraftState.detectionRange.toFixed(1)}u range. Use W/S/Arrows to intercept.`,
                "warn"
            );
        }
    }

    updateSpacecraftHUD();

}

/**
 * Helper to commit a debris metadata object into the spacecraft's internal storage vault
 */
function commitDebrisToInternalStorage(dData) {

    spacecraftState.cargoHold.push({
        id: dData.id,
        classCode: dData.classCode,
        classType: dData.classType,
        massKg: dData.massKg,
        threatLevel: dData.threatLevel,
        orbitIndex: dData.orbitIndex
    });

    spacecraftState.totalStored = spacecraftState.cargoHold.length;
    spacecraftState.storedMassKg = spacecraftState.cargoHold.reduce(
        (sum, item) => sum + item.massKg,
        0
    );

}

/**
 * 2. CAPTURE (Key: [C] or Direct Collision Detection)
 * Captures targeted or colliding debris from orbit with the robotic grapple claw.
 * If an object is already held on the claw, it is automatically moved into internal storage.
 */
function executeCapture(targetMesh = null, isCollisionIntercept = false) {

    if (debrisList.length === 0) {
        setSpacecraftStatus("⚠ Simulation has no active orbital debris to capture.", "warn");
        return false;
    }

    if (spacecraftState.cargoHold.length >= spacecraftState.maxCargoCapacity) {
        updateSpacecraftHUD();
        setSpacecraftStatus(
            `🚨 Cargo Bay FULL (${spacecraftState.maxCargoCapacity}/${spacecraftState.maxCargoCapacity})! Click [⏏️ Eject Capsule] or press [X] to reset bay to 0.`,
            "danger"
        );
        return false;
    }

    const scPos = spacecraftGroup.position;

    // Resolve target: explicit collision mesh -> lockedTarget -> closest orbiting debris within range
    let candidate = targetMesh || spacecraftState.lockedTarget;
    if (!candidate) {
        let minDist = spacecraftState.captureRange;
        for (let i = 0; i < debrisList.length; i++) {
            const d = debrisList[i];
            if (d.userData.status !== "orbiting") continue;
            const dist = scPos.distanceTo(d.position);
            if (dist <= minDist) {
                minDist = dist;
                candidate = d;
            }
        }
    }

    if (!candidate) {
        setSpacecraftStatus(
            `⚠ Capture Failed: No debris within Capture Range (${spacecraftState.captureRange}u). Maneuver closer or press [D].`,
            "warn"
        );
        return false;
    }

    const dist = scPos.distanceTo(candidate.position);
    if (!isCollisionIntercept && dist > spacecraftState.captureRange) {
        setSpacecraftStatus(
            `⚠ Target #${candidate.userData.id} out of grapple range (${dist.toFixed(2)}u > ${spacecraftState.captureRange}u). Close distance with W/S/A/E.`,
            "warn"
        );
        return false;
    }

    const index = debrisList.indexOf(candidate);
    if (index === -1) return false;

    const dData = candidate.userData;

    // Visual confirmation: Emerald grapple tether beam + flat ring burst
    spawnActionBeam(scPos, candidate.position, 0x10b981, 0.45);
    spawnPulseEffect(candidate.position, 0x10b981, 2.2, 0.5);

    // Remove from active orbital scene & debrisList
    scene.remove(candidate);
    debrisList.splice(index, 1);
    spacecraftState.totalCaptured++;

    // If another debris was already held on the forward claw, stow it inside the spacecraft first
    if (spacecraftState.grappledDebris) {
        const prevMesh = spacecraftState.grappledDebris;
        spacecraftGroup.remove(prevMesh);
        commitDebrisToInternalStorage(prevMesh.userData);
        spacecraftState.grappledDebris = null;
    }

    // Attach captured debris onto the spacecraft's forward grapple claw so user sees it held,
    // ready to be sealed inside the spacecraft with [R] Store in Craft
    candidate.position.set(0, -0.05, 0.98);
    candidate.scale.set(0.85, 0.85, 0.85);
    if (candidate.material && candidate.material.emissive) {
        candidate.material.emissive.setHex(0x10b981);
        candidate.material.emissiveIntensity = 0.7;
    }
    spacecraftGroup.add(candidate);
    spacecraftState.grappledDebris = candidate;

    if (spacecraftState.lockedTarget === candidate) {
        spacecraftState.lockedTarget = null;
    }

    updateCount();
    runDetectionAndClassification(false);

    if (spacecraftState.cargoHold.length >= spacecraftState.maxCargoCapacity) {
        setSpacecraftStatus(
            `🚨 CARGO BAY FULL (${spacecraftState.maxCargoCapacity}/${spacecraftState.maxCargoCapacity})! Click [⏏️ Eject Capsule] or press [X] to eject & reset bay to 0!`,
            "danger"
        );
    } else {
        setSpacecraftStatus(
            `${isCollisionIntercept ? "⚡ COLLISION CAPTURE" : "🧲 GRAPPLED"}: Debris #${dData.id} (${dData.classType}, ${dData.massKg}kg) held on claw · Press [R] to Store Inside Spacecraft`,
            "success"
        );
    }

    return true;

}

/**
 * 3. DEORBIT (Key: [L])
 * Applies retrograde impulse force to push targeted debris toward Earth
 * with a visible 3D spiral descent trajectory curve and atmospheric re-entry burnup.
 */
function executeDeorbit() {

    if (debrisList.length === 0) {
        setSpacecraftStatus("⚠ Cannot Deorbit: No debris objects remaining in orbit.", "warn");
        return false;
    }

    const scPos = spacecraftGroup.position;

    // Find best eligible target within deorbitRange
    let target = spacecraftState.lockedTarget;
    if (!target || target.userData.status === "deorbiting") {
        // Search closest orbiting debris within deorbitRange
        let bestDist = spacecraftState.deorbitRange;
        target = null;
        for (let i = 0; i < debrisList.length; i++) {
            const m = debrisList[i];
            if (m.userData.status === "deorbiting") continue;
            const d = scPos.distanceTo(m.position);
            if (d <= bestDist) {
                bestDist = d;
                target = m;
            }
        }
    }

    if (!target) {
        setSpacecraftStatus(
            `⚠ Deorbit Failed: No target within Retro-Laser Range (${spacecraftState.deorbitRange}u). Move closer first.`,
            "warn"
        );
        return false;
    }

    const dist = scPos.distanceTo(target.position);
    if (dist > spacecraftState.deorbitRange) {
        setSpacecraftStatus(
            `⚠ Target #${target.userData.id} is too far for Deorbit Impulse (${dist.toFixed(2)}u > ${spacecraftState.deorbitRange}u).`,
            "warn"
        );
        return false;
    }

    const data = target.userData;
    data.status = "deorbiting";
    data.deorbitProgress = 0;
    data.deorbitStartRadius = data.radius;
    data.deorbitStartAngle = data.angle;
    data.deorbitStartHeight = target.position.y;

    // Highlight descending debris in incandescent re-entry orange
    if (target.material) {
        target.material.color.setHex(0xff6b35);
        target.material.emissive.setHex(0xff3b00);
        target.material.emissiveIntensity = 0.95;
    }

    // Fire visible Retro-Laser Deorbit Impulse Beam from Spacecraft to Target
    spawnActionBeam(scPos, target.position, 0xf97316, 0.55);
    spawnPulseEffect(target.position, 0xf97316, 2.2, 0.45);

    // Build visible 3D Spiral Descent Trajectory Line from current orbit to Earth's atmosphere
    const curvePoints = [];
    const curveColors = [];
    const steps = 64;
    const targetEntryRadius = CONFIG.earthRadius * 1.04;
    const totalAngleSweep = Math.PI * 1.85 * data.direction;

    for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const easeT = t * t * (3 - 2 * t);
        const r = THREE.MathUtils.lerp(data.deorbitStartRadius, targetEntryRadius, easeT);
        const ang = data.deorbitStartAngle + totalAngleSweep * t;
        const h = THREE.MathUtils.lerp(data.deorbitStartHeight, 0, easeT);

        curvePoints.push(
            new THREE.Vector3(
                Math.cos(ang) * r,
                h,
                Math.sin(ang) * r
            )
        );

        // Gradient from amber-orange at orbit to bright crimson at atmospheric entry
        const col = new THREE.Color().setHSL(0.08 * (1 - t), 1.0, 0.55);
        curveColors.push(col.r, col.g, col.b);
    }

    const trajGeom = new THREE.BufferGeometry().setFromPoints(curvePoints);
    trajGeom.setAttribute("color", new THREE.Float32BufferAttribute(curveColors, 3));

    const trajMat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.9
    });

    const trajectoryLine = new THREE.Line(trajGeom, trajMat);
    scene.add(trajectoryLine);

    data.trajectoryLine = trajectoryLine;
    data.totalAngleSweep = totalAngleSweep;
    deorbitingTrajectories.push(trajectoryLine);

    setSpacecraftStatus(
        `☄️ DEORBIT IMPULSE APPLIED: Debris #${data.id} (${data.classType}) descending toward Earth atmosphere!`,
        "success"
    );

    runDetectionAndClassification(false);
    return true;

}

/**
 * 4. STORE INSIDE SPACECRAFT (Key: [R])
 * Retracts grappled debris (or pulls a proximate target directly) inside the spacecraft's
 * internal cargo bay (up to 30 capacity), removing it from space and logging it in onboard storage.
 */
function executeStoreInSpacecraft() {

    if (spacecraftState.cargoHold.length >= spacecraftState.maxCargoCapacity) {
        updateSpacecraftHUD();
        setSpacecraftStatus(
            `🚨 Spacecraft Cargo Bay is FULL (${spacecraftState.maxCargoCapacity}/${spacecraftState.maxCargoCapacity})! Click [⏏️ Eject Capsule] or press [X] to eject capsule and reset bay to 0!`,
            "danger"
        );
        return false;
    }

    // Case 1: If debris is currently held on the forward grapple claw, retract & store it inside the bus
    if (spacecraftState.grappledDebris) {
        const heldMesh = spacecraftState.grappledDebris;
        const dData = heldMesh.userData;

        spacecraftGroup.remove(heldMesh);
        spacecraftState.grappledDebris = null;

        commitDebrisToInternalStorage(dData);
        spawnPulseEffect(spacecraftGroup.position, 0x38bdf8, 1.8, 0.45);
        updateSpacecraftHUD();

        if (spacecraftState.cargoHold.length >= spacecraftState.maxCargoCapacity) {
            setSpacecraftStatus(
                `🚨 CARGO BAY FULL (${spacecraftState.maxCargoCapacity}/${spacecraftState.maxCargoCapacity})! Click [⏏️ Eject Capsule] or press [X] to eject capsule & reset bay to 0!`,
                "danger"
            );
        } else {
            setSpacecraftStatus(
                `📦 STORED INSIDE SPACECRAFT: Debris #${dData.id} (${dData.classType}, ${dData.massKg}kg) sealed in internal bay (${spacecraftState.cargoHold.length}/${spacecraftState.maxCargoCapacity})`,
                "success"
            );
        }
        return true;
    }

    // Case 2: If nothing is on the claw yet, capture & store the locked/proximate target directly inside the spacecraft
    const scPos = spacecraftGroup.position;
    let target = spacecraftState.lockedTarget;
    if (!target) {
        let minDist = spacecraftState.captureRange;
        for (let i = 0; i < debrisList.length; i++) {
            const d = debrisList[i];
            if (d.userData.status !== "orbiting") continue;
            const dist = scPos.distanceTo(d.position);
            if (dist <= minDist) {
                minDist = dist;
                target = d;
            }
        }
    }

    if (target && scPos.distanceTo(target.position) <= spacecraftState.captureRange) {
        const index = debrisList.indexOf(target);
        if (index !== -1) {
            const dData = target.userData;

            spawnActionBeam(scPos, target.position, 0x38bdf8, 0.45);
            spawnPulseEffect(spacecraftGroup.position, 0x38bdf8, 1.8, 0.45);

            scene.remove(target);
            debrisList.splice(index, 1);
            spacecraftState.totalCaptured++;

            commitDebrisToInternalStorage(dData);

            if (spacecraftState.lockedTarget === target) {
                spacecraftState.lockedTarget = null;
            }

            updateCount();
            runDetectionAndClassification(false);

            if (spacecraftState.cargoHold.length >= spacecraftState.maxCargoCapacity) {
                setSpacecraftStatus(
                    `🚨 CARGO BAY FULL (${spacecraftState.maxCargoCapacity}/${spacecraftState.maxCargoCapacity})! Click [⏏️ Eject Capsule] or press [X] to eject capsule & reset bay to 0!`,
                    "danger"
                );
            } else {
                setSpacecraftStatus(
                    `📦 DIRECTLY STORED IN SPACECRAFT: Debris #${dData.id} (${dData.classType}, ${dData.massKg}kg) · Bay: ${spacecraftState.cargoHold.length}/${spacecraftState.maxCargoCapacity}`,
                    "success"
                );
            }
            return true;
        }
    }

    setSpacecraftStatus(
        `⚠ No debris on claw or within range (${spacecraftState.captureRange}u) to store! Press [C] near debris to Capture first.`,
        "warn"
    );
    return false;

}

/**
 * 5. EJECT RETURN CAPSULE (Visible when Cargo Bay is 30/30 full, Key: [X])
 * Packages all 30 stored debris items into a heat-shielded entry capsule,
 * ejects it from the spacecraft with a retro-thruster impulse toward Earth,
 * and resets the spacecraft cargo bay back to 0/30 for new debris capture!
 */
function executeEjectCapsule() {

    if (spacecraftState.cargoHold.length === 0) {
        setSpacecraftStatus("⚠ Cargo bay is empty (0/30). Store debris before ejecting capsule.", "warn");
        return false;
    }

    const scPos = spacecraftGroup.position.clone();
    const storedCount = spacecraftState.cargoHold.length;
    const storedMass = spacecraftState.storedMassKg;

    // 1. Build a 3D Cargo Return Capsule mesh (heat shield base + cylindrical body + beacon)
    const capsuleGroup = new THREE.Group();

    // Heat shield base
    const shieldGeom = new THREE.CylinderGeometry(0.34, 0.40, 0.12, 16);
    const shieldMat = new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.8,
        metalness: 0.2
    });
    const shield = new THREE.Mesh(shieldGeom, shieldMat);
    capsuleGroup.add(shield);

    // Conical aeroshell body (bright recovery amber & gold)
    const coneGeom = new THREE.ConeGeometry(0.34, 0.52, 16);
    const coneMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        roughness: 0.35,
        metalness: 0.75,
        emissive: 0xd97706,
        emissiveIntensity: 0.35
    });
    const cone = new THREE.Mesh(coneGeom, coneMat);
    cone.position.y = 0.28;
    capsuleGroup.add(cone);

    // Flashing recovery radio beacon light
    const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0x22c55e })
    );
    beacon.position.y = 0.56;
    capsuleGroup.add(beacon);

    // Position capsule slightly beneath/behind the spacecraft upon ejection
    const ejectAngle = spacecraftState.angle - 0.05 * spacecraftState.direction;
    const ejectRadius = spacecraftState.baseRadius + spacecraftState.radialOffset - 0.25;
    const ejectHeight = spacecraftState.altitudeOffset - 0.2;

    capsuleGroup.position.set(
        Math.cos(ejectAngle) * ejectRadius,
        ejectHeight,
        Math.sin(ejectAngle) * ejectRadius
    );
    scene.add(capsuleGroup);

    // Visual ejection impulse effects: Amber retro-thrust pulse + beam
    spawnPulseEffect(scPos, 0xf59e0b, 3.2, 0.65);
    spawnActionBeam(scPos, capsuleGroup.position, 0xfbbf24, 0.5);

    // Build visible 3D Spiral Descent Trajectory Line down to Earth for the capsule
    const curvePoints = [];
    const curveColors = [];
    const steps = 64;
    const targetEntryRadius = CONFIG.earthRadius * 1.04;
    const totalAngleSweep = Math.PI * 1.65 * spacecraftState.direction;

    for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const easeT = t * t * (3 - 2 * t);
        const r = THREE.MathUtils.lerp(ejectRadius, targetEntryRadius, easeT);
        const ang = ejectAngle + totalAngleSweep * t;
        const h = THREE.MathUtils.lerp(ejectHeight, 0, easeT);

        curvePoints.push(new THREE.Vector3(Math.cos(ang) * r, h, Math.sin(ang) * r));

        const col = new THREE.Color().setHSL(0.12 - t * 0.06, 1.0, 0.55);
        curveColors.push(col.r, col.g, col.b);
    }

    const trajGeom = new THREE.BufferGeometry().setFromPoints(curvePoints);
    trajGeom.setAttribute("color", new THREE.Float32BufferAttribute(curveColors, 3));
    const trajMat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.85
    });
    const trajectoryLine = new THREE.Line(trajGeom, trajMat);
    scene.add(trajectoryLine);
    deorbitingTrajectories.push(trajectoryLine);

    activeEjectedCapsules.push({
        mesh: capsuleGroup,
        trajectoryLine,
        progress: 0,
        startRadius: ejectRadius,
        startAngle: ejectAngle,
        startHeight: ejectHeight,
        totalAngleSweep
    });

    // 2. RESET THE SPACECRAFT'S CARGO BAY BACK TO 0 TO STORE DEBRIS AGAIN
    spacecraftState.cargoHold = [];
    spacecraftState.totalStored = 0;
    spacecraftState.storedMassKg = 0;
    spacecraftState.ejectedCapsulesCount++;

    updateSpacecraftHUD();

    setSpacecraftStatus(
        `🚀 CARGO CAPSULE EJECTED: Delivered ${storedCount} debris items (${storedMass} kg) on Earth recovery trajectory! Bay reset to 0/30.`,
        "success"
    );

    return true;

}


// ============================================================
// CONTROL PANEL (Preserves 100% of existing UI + Spacecraft & 5-Orbit Telemetry)
// ============================================================

function createPanel() {

    const panel =
        document.createElement(
            "div"
        );

    panel.id =
        "controlPanel";

    panel.innerHTML = `

        <!-- Sliding drawer handle tab pinned to right edge of panel -->
        <div id="panelToggleTab" title="Toggle Controls Slider Drawer (Key: Tab, H, or M)">
            <span id="panelToggleIcon">◀</span>
            <span id="panelToggleText">CONTROLS</span>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
            <div>
                <h2 style="margin:0 0 3px 0;">🌍 DISHA</h2>
                <div class="subtitle" style="margin:0;">LEO Simulation &amp;Cose Da Vinci Interceptor</div>
            </div>
            <button id="panelCloseBtn" class="drawerCloseBtn" title="Slide Controls Closed (Tab / H)">
                ◀ Hide [Tab]
            </button>
        </div>


        <div class="section" id="secSimulation">

            <div class="accordionHeader">
                <div class="sectionTitle">⚙️ Simulation</div>
                <span class="accordionArrow">▼</span>
            </div>

            <div class="accordionBody">

                <button
                    id="playButton"
                    class="primary">

                    ⏸ Pause

                </button>


                <button id="resetButton">
                    ↻ Reset
                </button>


                <label>

                    Global Speed

                    <span
                        id="globalSpeedValue"
                        class="value">

                        1.00×

                    </span>

                </label>


                <input
                    id="globalSpeed"
                    type="range"
                    min="0"
                    max="5"
                    step="0.01"
                    value="1"
                >


                <label>
                    Global Direction
                </label>


                <select id="globalDirection">

                    <option value="1">
                        Counter-clockwise
                    </option>

                    <option value="-1">
                        Clockwise
                    </option>

                </select>

            </div>

        </div>


        <div class="section" id="secSpacecraft">

            <div class="accordionHeader">
                <div class="sectionTitle">🚀 DISHA Spacecraft (Orbit 3)</div>
                <span class="accordionArrow">▼</span>
            </div>

            <div class="accordionBody">

                <div id="scStatusBanner" style="font-size:11px; line-height:1.4; padding:7px 9px; margin-bottom:8px; border-radius:6px; background:rgba(0,240,255,0.10); border:1px solid rgba(0,240,255,0.3); color:#bae6fd;">
                    ${spacecraftState.statusMessage}
                </div>

                <div style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom:8px;">
                    <button id="btnDetect" class="primary" title="Key: D">
                        📡 [D] Detect
                    </button>
                    <button id="btnCapture" title="Key: C">
                        🧲 [C] Capture
                    </button>
                    <button id="btnDeorbit" class="danger" title="Key: L">
                        ☄️ [L] Deorbit
                    </button>
                    <button id="btnStore" title="Key: R">
                        📦 [R] Store
                    </button>
                    <button id="btnCameraFollow" title="Key: V">
                        🎥 [V] Follow SpaceCraft
                    </button>
                </div>

                <!-- Visible ONLY when cargo bay reaches full capacity (30/30) -->
                <button
                    id="btnEjectCapsule"
                    style="display:none; width:100%; margin:4px 0 10px 0; padding:10px 12px; font-weight:bold; font-size:12px; background:linear-gradient(135deg, #d97706, #b45309); border:1px solid #fbbf24; color:#ffffff; border-radius:7px; cursor:pointer; box-shadow:0 0 12px rgba(251,191,36,0.4);"
                    title="Eject full cargo capsule and reset bay to 0/30 (Key: X)">
                    ⏏️ [X] Eject Full Cargo Capsule (30/30) &amp; Reset Bay to 0
                </button>

                <div class="stats" id="spacecraftTelemetry">
                    Orbit Corridor: <span style="color:#00f0ff;">Orbit 3 (r = 8.0)</span><br>
                    Detected in Range: <span id="scDetectedCount">0</span><br>
                    Locked Target: <span id="scLockedTarget">None</span><br>
                    Target Class: <span id="scTargetClass">—</span><br>
                    Held on Claw: <span id="scGrappledItem">None</span><br>
                    Cargo Bay: <span id="scCargoCount">0 / 30 (0 kg)</span><br>
                    Bay Contents: <span id="scStoredInventory">Empty (0 / 30)</span><br>
                    Mission Totals: <span id="scActionTotals">0 deorbited · 0 capsules ejected</span>
                </div>

            </div>

        </div>


        <!-- ============================================================
             MANAGE ALL DEBRIS (BULK CONTROLS)
             Allows controlling all debris together or filtered by orbit scope
             ============================================================ -->
        <div class="section" id="secBulkDebris">

            <div class="accordionHeader">
                <div class="sectionTitle">🌐 Manage All Debris (Bulk Controls)</div>
                <span class="accordionArrow">▼</span>
            </div>

            <div class="accordionBody">

                <label>
                    Target Orbit Scope
                </label>

                <select id="bulkOrbitScope">
                    <option value="all">All Orbits (All 120+ Debris)</option>
                    <option value="1">Orbit 1 (Low: r = 4.2)</option>
                    <option value="2">Orbit 2 (Dense: r = 6.0)</option>
                    <option value="3">Orbit 3 (Corridor: r = 8.0)</option>
                    <option value="4">Orbit 4 (High: r = 10.5)</option>
                    <option value="5">Orbit 5 (Far: r = 13.2)</option>
                </select>

                <label>
                    Orbital Velocity (Targeted)
                    <span id="allSpeedValue" class="value">
                        1.00
                    </span>
                </label>

                <input
                    id="allSpeed"
                    type="range"
                    min="0"
                    max="5"
                    step="0.01"
                    value="1"
                >

                <label>
                    Spin / Tumbling Rate (Targeted)
                    <span id="allSpinValue" class="value">
                        1.00
                    </span>
                </label>

                <input
                    id="allSpinSpeed"
                    type="range"
                    min="0"
                    max="5"
                    step="0.01"
                    value="1"
                >

                <label>
                    Orbital Direction (Targeted)
                </label>

                <select id="allDirection">
                    <option value="">-- Apply Direction to Targeted --</option>
                    <option value="1">Counter-clockwise (Prograde)</option>
                    <option value="-1">Clockwise (Retrograde)</option>
                    <option value="reverse">Reverse Current Directions</option>
                </select>

                <label>
                    Rotation Axis (Targeted)
                </label>

                <select id="allAxis">
                    <option value="">-- Apply Axis to Targeted --</option>
                    <option value="x">X axis</option>
                    <option value="y">Y axis</option>
                    <option value="z">Z axis</option>
                    <option value="random">Randomize All Axes</option>
                </select>

                <div class="bulkButtonGrid">
                    <button id="allCW">
                        ↻ All CW
                    </button>
                    <button id="allCCW">
                        ↺ All CCW
                    </button>
                    <button id="stopAll">
                        ⏸ Stop All
                    </button>
                    <button id="resumeAll" class="primary">
                        ▶ Resume All
                    </button>
                    <button id="randomizeAll">
                        🎲 Randomize
                    </button>
                    <button id="addDebris">
                        ＋ Add Debris
                    </button>
                    <button id="clearDebris" class="danger">
                        🗑️ Clear Targeted
                    </button>
                    <button id="repopulateOrbits">
                        ↻ Repopulate All
                    </button>
                </div>

            </div>

        </div>


        <div class="section" id="secStats">

            <div class="accordionHeader">
                <div class="sectionTitle">📊 Statistics & 5-Orbit Density</div>
                <span class="accordionArrow">▼</span>
            </div>

            <div class="accordionBody">

                <div class="stats">

                    Active Debris:
                    <span id="debrisCount">
                        ${debrisList.length}
                    </span>

                    <br>

                    Earth Radius:
                    ${CONFIG.earthRadius}

                    <br>

                    Orbits (1–5 Radii):
                    4.2 · 6.0 · <strong style="color:#00f0ff;">8.0</strong> · 10.5 · 13.2

                    <br>

                    Orbit Breakdown:
                    <span id="orbitBreakdownText">
                        O1:10 | O2:36 | O3:44 | O4:22 | O5:8
                    </span>

                    <br>

                    Status:
                    <span id="status">
                        Running
                    </span>

                </div>

            </div>

        </div>
    `;

    document.body.appendChild(panel);

}

createPanel();


// ============================================================
// HELP & ACTIVE KEYBOARD BINDINGS PANEL
// ============================================================

const help =
    document.createElement(
        "div"
    );

help.id = "help";

help.innerHTML = `
    <div style="font-weight:bold; color:#60b4ff; margin-bottom:4px;">
        ⌨️ Spacecraft Controls (Orbit 3), Bulk Manager &amp; Sliding Drawer
    </div>
    <div style="line-height:1.55;">
        <strong>[W / ↑]</strong> Prograde Thrust &nbsp;·&nbsp;
        <strong>[S / ↓]</strong> Retrograde Brake &nbsp;·&nbsp;
        <strong>[A / ←]</strong> Radial In &nbsp;·&nbsp;
        <strong>[E / →]</strong> Radial Out &nbsp;·&nbsp;
        <strong>[Q / Z]</strong> Altitude ±<br>
        <strong>[D]</strong> Detect &amp; Classify &nbsp;·&nbsp;
        <strong>[C]</strong> Capture Target &nbsp;·&nbsp;
        <strong>[L]</strong> Deorbit (Laser Impulse) &nbsp;·&nbsp;
        <strong>[R]</strong> Store in Craft (0–30) &nbsp;·&nbsp;
        <strong>[X]</strong> Eject Capsule (when 30/30)<br>
        <strong>[Tab / H]</strong> Toggle Controls Slider Drawer &nbsp;·&nbsp;
        <strong>[V]</strong> Follow Camera<br>
        <span style="color:#7c8ba1;">Mouse: Left Drag = Rotate · Scroll = Zoom · Right Drag = Pan</span>
    </div>
`;

document.body.appendChild(
    help
);


// ============================================================
// UI REFERENCES (BULK DEBRIS CONTROLS & SLIDING DRAWER)
// ============================================================

const allSpeed =
    document.getElementById(
        "allSpeed"
    );

const allSpeedValue =
    document.getElementById(
        "allSpeedValue"
    );

const allSpinSpeed =
    document.getElementById(
        "allSpinSpeed"
    );

const allSpinValue =
    document.getElementById(
        "allSpinValue"
    );

const allDirection =
    document.getElementById(
        "allDirection"
    );

const allAxis =
    document.getElementById(
        "allAxis"
    );

const bulkOrbitScope =
    document.getElementById(
        "bulkOrbitScope"
    );

const randomizeAll =
    document.getElementById(
        "randomizeAll"
    );

const panelToggleTab =
    document.getElementById(
        "panelToggleTab"
    );

const panelToggleIcon =
    document.getElementById(
        "panelToggleIcon"
    );

const panelToggleText =
    document.getElementById(
        "panelToggleText"
    );

const panelCloseBtn =
    document.getElementById(
        "panelCloseBtn"
    );

function updateSpacecraftHUD() {

    const detEl = document.getElementById("scDetectedCount");
    const lockEl = document.getElementById("scLockedTarget");
    const classEl = document.getElementById("scTargetClass");
    const grappledEl = document.getElementById("scGrappledItem");
    const cargoEl = document.getElementById("scCargoCount");
    const invEl = document.getElementById("scStoredInventory");
    const totalsEl = document.getElementById("scActionTotals");
    const ejectBtn = document.getElementById("btnEjectCapsule");

    const isBayFull =
        spacecraftState.cargoHold.length >= spacecraftState.maxCargoCapacity;

    // Show Eject Capsule option ONLY when the cargo bay is full (30 / 30)
    if (ejectBtn) {
        ejectBtn.style.display = isBayFull ? "block" : "none";
    }

    if (detEl) {
        detEl.textContent =
            `${spacecraftState.detectedList.length} object(s) (< ${spacecraftState.detectionRange}u)`;
    }

    if (lockEl && classEl) {
        if (spacecraftState.lockedTarget) {
            const td = spacecraftState.lockedTarget.userData;
            const dist = td.distanceToSpacecraft ? td.distanceToSpacecraft.toFixed(2) : "—";
            lockEl.innerHTML = `<strong style="color:#00f0ff;">Debris #${td.id}</strong> (${dist}u · O${td.orbitNumber})`;
            classEl.textContent = `${td.classCode}: ${td.classType} (${td.massKg}kg · ${td.threatLevel})`;
        } else {
            lockEl.textContent = "None in range";
            classEl.textContent = "—";
        }
    }

    if (grappledEl) {
        if (spacecraftState.grappledDebris) {
            const gd = spacecraftState.grappledDebris.userData;
            grappledEl.innerHTML = `<strong style="color:#10b981;">#${gd.id} (${gd.classCode}, ${gd.massKg}kg)</strong> — Press [R] to Store`;
        } else {
            grappledEl.textContent = "None";
        }
    }

    if (cargoEl) {
        const storedMass = spacecraftState.cargoHold.reduce((s, item) => s + item.massKg, 0);
        if (isBayFull) {
            cargoEl.innerHTML =
                `<strong style="color:#fbbf24;">${spacecraftState.cargoHold.length} / ${spacecraftState.maxCargoCapacity} FULL (${storedMass} kg) — Eject Capsule [X]</strong>`;
        } else {
            cargoEl.textContent =
                `${spacecraftState.cargoHold.length} / ${spacecraftState.maxCargoCapacity} (${storedMass} kg)`;
        }
    }

    if (invEl) {
        if (spacecraftState.cargoHold.length === 0) {
            invEl.textContent = "Empty (0 / 30)";
        } else {
            invEl.textContent = spacecraftState.cargoHold
                .slice(-5)
                .map(item => `#${item.id}(${item.massKg}kg)`)
                .join(", ");
        }
    }

    if (totalsEl) {
        totalsEl.textContent =
            `${spacecraftState.totalDeorbited} deorbited · ${spacecraftState.ejectedCapsulesCount} capsule(s) ejected`;
    }

}


document
    .getElementById("globalSpeed")
    .addEventListener(

        "input",

        event => {

            state.globalSpeed =
                Number(
                    event.target.value
                );

            document.getElementById(
                "globalSpeedValue"
            ).textContent =
                state.globalSpeed.toFixed(2)
                + "×";

        }

    );

document
    .getElementById("globalDirection")
    .addEventListener(

        "change",

        event => {

            const direction =
                Number(
                    event.target.value
                );

            for (
                let i = 0;
                i < debrisList.length;
                i++
            ) {

                debrisList[i]
                    .userData
                    .direction =
                    direction;

            }

            event.target.blur();

        }

    );

document
    .getElementById("playButton")
    .addEventListener(

        "click",

        event => {

            state.running =
                !state.running;

            event.target.textContent =
                state.running
                    ? "⏸ Pause"
                    : "▶ Play";

            document.getElementById(
                "status"
            ).textContent =
                state.running
                    ? "Running"
                    : "Paused";

            event.target.blur();

        }

    );

document
    .getElementById("resetButton")
    .addEventListener(

        "click",

        event => {

            // Clear any active deorbit trajectories
            while (deorbitingTrajectories.length > 0) {
                const line = deorbitingTrajectories.pop();
                scene.remove(line);
            }

            // Remove remaining debris and repopulate all 5 orbits cleanly
            while (debrisList.length > 0) {
                const m = debrisList.pop();
                scene.remove(m);
            }

            populateInitialOrbits();

            // Clear any active ejected capsules
            while (activeEjectedCapsules.length > 0) {
                const cap = activeEjectedCapsules.pop();
                scene.remove(cap.mesh);
                if (cap.trajectoryLine) scene.remove(cap.trajectoryLine);
            }

            // Clear grappled debris & internal storage on reset
            if (spacecraftState.grappledDebris) {
                spacecraftGroup.remove(spacecraftState.grappledDebris);
                spacecraftState.grappledDebris = null;
            }

            // Reset spacecraft orbital state in 3rd Orbit
            spacecraftState.angle = 0.35;
            spacecraftState.radialOffset = 0;
            spacecraftState.targetRadialOffset = 0;
            spacecraftState.altitudeOffset = 0;
            spacecraftState.targetAltitudeOffset = 0;
            spacecraftState.cargoHold = [];
            spacecraftState.totalStored = 0;
            spacecraftState.storedMassKg = 0;
            spacecraftState.ejectedCapsulesCount = 0;
            updateSpacecraftTransform(1);

            updateCount();
            runDetectionAndClassification(false);
            setSpacecraftStatus("↻ Simulation & 5-Orbit Debris Distribution Reset.", "info");

            event.target.blur();

        }

    );

// ============================================================
// BULK DEBRIS MANAGEMENT & SLIDING DRAWER HANDLERS
// ============================================================

/**
 * Returns the array of debris targeted by the bulk controls (either all orbits or a specific orbit).
 */
function getTargetedDebrisList() {
    if (!bulkOrbitScope) return debrisList;
    const scope = bulkOrbitScope.value;
    if (scope === "all") return debrisList;
    const orbitNum = parseInt(scope, 10);
    return debrisList.filter(d => d.userData.orbitNumber === orbitNum);
}

/**
 * Toggles the control panel sliding drawer open/collapsed.
 */
function toggleControlPanel(forceState) {
    const panel = document.getElementById("controlPanel");
    const icon = document.getElementById("panelToggleIcon");
    const text = document.getElementById("panelToggleText");
    if (!panel) return;
    const shouldCollapse = forceState !== undefined
        ? !forceState
        : !panel.classList.contains("collapsed");
    panel.classList.toggle("collapsed", shouldCollapse);
    if (icon) {
        icon.textContent = shouldCollapse ? "▶" : "◀";
    }
    if (text) {
        text.textContent = shouldCollapse ? "OPEN [TAB]" : "CLOSE";
    }
}

// Side tab handle click listener to slide the control panel in/out
if (panelToggleTab) {
    panelToggleTab.addEventListener("click", () => {
        toggleControlPanel();
    });
}

// Top header button inside drawer to slide closed
if (panelCloseBtn) {
    panelCloseBtn.addEventListener("click", () => {
        toggleControlPanel(false);
    });
}

// Accordion section header click listeners (slides individual sections open/closed)
document.querySelectorAll(".accordionHeader").forEach(header => {
    header.addEventListener("click", () => {
        const sec = header.closest(".section");
        if (sec) {
            sec.classList.toggle("collapsed");
        }
    });
});

// Bulk: Target Orbit Scope change
if (bulkOrbitScope) {
    bulkOrbitScope.addEventListener("change", () => {
        const targets = getTargetedDebrisList();
        if (targets.length > 0 && allSpeed && allSpeedValue) {
            const first = targets[0].userData;
            allSpeed.value = first.speed;
            allSpeedValue.textContent = Number(first.speed).toFixed(2);
            if (allSpinSpeed && allSpinValue) {
                allSpinSpeed.value = first.spinSpeed;
                allSpinValue.textContent = Number(first.spinSpeed).toFixed(2);
            }
        }
        setSpacecraftStatus(`🎯 Target Scope set to ${bulkOrbitScope.options[bulkOrbitScope.selectedIndex].text} (${targets.length} active).`, "info");
    });
}

// Bulk: Orbital Speed slider
if (allSpeed) {
    allSpeed.addEventListener("input", event => {
        const val = Number(event.target.value);
        if (allSpeedValue) {
            allSpeedValue.textContent = val.toFixed(2);
        }
        const targets = getTargetedDebrisList();
        for (let i = 0; i < targets.length; i++) {
            targets[i].userData.speed = val;
        }
    });
}

// Bulk: Spin Speed slider
if (allSpinSpeed) {
    allSpinSpeed.addEventListener("input", event => {
        const val = Number(event.target.value);
        if (allSpinValue) {
            allSpinValue.textContent = val.toFixed(2);
        }
        const targets = getTargetedDebrisList();
        for (let i = 0; i < targets.length; i++) {
            targets[i].userData.spinSpeed = val;
        }
    });
}

// Bulk: Direction dropdown
if (allDirection) {
    allDirection.addEventListener("change", event => {
        const val = event.target.value;
        if (!val) return;
        const targets = getTargetedDebrisList();
        if (val === "reverse") {
            for (let i = 0; i < targets.length; i++) {
                targets[i].userData.direction *= -1;
            }
            setSpacecraftStatus(`🔄 Reversed direction for ${targets.length} targeted debris item(s).`, "info");
        } else {
            const dir = Number(val);
            for (let i = 0; i < targets.length; i++) {
                targets[i].userData.direction = dir;
            }
            setSpacecraftStatus(`Applied ${dir === 1 ? 'Counter-clockwise' : 'Clockwise'} direction to ${targets.length} targeted debris item(s).`, "info");
        }
        event.target.value = "";
        event.target.blur();
    });
}

// Bulk: Rotation Axis dropdown
if (allAxis) {
    allAxis.addEventListener("change", event => {
        const val = event.target.value;
        if (!val) return;
        const targets = getTargetedDebrisList();
        if (val === "random") {
            const axes = ["x", "y", "z"];
            for (let i = 0; i < targets.length; i++) {
                targets[i].userData.axis = axes[Math.floor(Math.random() * axes.length)];
            }
            setSpacecraftStatus(`🎲 Randomized tumbling axes for ${targets.length} targeted debris item(s).`, "info");
        } else {
            for (let i = 0; i < targets.length; i++) {
                targets[i].userData.axis = val;
            }
            setSpacecraftStatus(`Applied ${val.toUpperCase()} tumbling axis to ${targets.length} targeted debris item(s).`, "info");
        }
        event.target.value = "";
        event.target.blur();
    });
}

// Bulk Quick Action: All Clockwise
const btnAllCW = document.getElementById("allCW");
if (btnAllCW) {
    btnAllCW.addEventListener("click", event => {
        const targets = getTargetedDebrisList();
        for (let i = 0; i < targets.length; i++) {
            targets[i].userData.direction = -1;
        }
        setSpacecraftStatus(`↻ Set ${targets.length} targeted debris item(s) to Clockwise.`, "info");
        event.target.blur();
    });
}

// Bulk Quick Action: All Counter-Clockwise
const btnAllCCW = document.getElementById("allCCW");
if (btnAllCCW) {
    btnAllCCW.addEventListener("click", event => {
        const targets = getTargetedDebrisList();
        for (let i = 0; i < targets.length; i++) {
            targets[i].userData.direction = 1;
        }
        setSpacecraftStatus(`↺ Set ${targets.length} targeted debris item(s) to Counter-Clockwise.`, "info");
        event.target.blur();
    });
}

// Bulk Quick Action: Stop All
const btnStopAll = document.getElementById("stopAll");
if (btnStopAll) {
    btnStopAll.addEventListener("click", event => {
        const targets = getTargetedDebrisList();
        for (let i = 0; i < targets.length; i++) {
            targets[i].userData.speed = 0;
        }
        if (allSpeed) allSpeed.value = 0;
        if (allSpeedValue) allSpeedValue.textContent = "0.00";
        setSpacecraftStatus(`⏸ Stopped orbital motion for ${targets.length} targeted debris item(s).`, "warn");
        event.target.blur();
    });
}

// Bulk Quick Action: Resume All
const btnResumeAll = document.getElementById("resumeAll");
if (btnResumeAll) {
    btnResumeAll.addEventListener("click", event => {
        const targets = getTargetedDebrisList();
        for (let i = 0; i < targets.length; i++) {
            const d = targets[i].userData;
            const orbCfg = CONFIG.orbits[d.orbitIndex] || CONFIG.orbits[2];
            d.speed = Number(((0.45 + Math.random() * 1.35) * orbCfg.speedMultiplier).toFixed(2));
        }
        if (allSpeed) allSpeed.value = 1.0;
        if (allSpeedValue) allSpeedValue.textContent = "1.00";
        setSpacecraftStatus(`▶ Resumed orbital motion for ${targets.length} targeted debris item(s).`, "info");
        event.target.blur();
    });
}

// Bulk Quick Action: Randomize Speeds & Spins
if (randomizeAll) {
    randomizeAll.addEventListener("click", event => {
        const targets = getTargetedDebrisList();
        for (let i = 0; i < targets.length; i++) {
            targets[i].userData.speed = Number((0.2 + Math.random() * 2.2).toFixed(2));
            targets[i].userData.spinSpeed = Number((0.3 + Math.random() * 2.5).toFixed(2));
            targets[i].userData.direction = Math.random() > 0.4 ? 1 : -1;
        }
        setSpacecraftStatus(`🎲 Randomized speeds, spins & directions for ${targets.length} targeted debris.`, "info");
        event.target.blur();
    });
}

// Bulk Action: Add Debris
const btnAddDebris = document.getElementById("addDebris");
if (btnAddDebris) {
    btnAddDebris.addEventListener("click", event => {
        let orbitIdx = null;
        if (bulkOrbitScope && bulkOrbitScope.value !== "all") {
            orbitIdx = parseInt(bulkOrbitScope.value, 10) - 1;
        }
        const mesh = createDebris(Math.random() * Math.PI * 2, orbitIdx, false);
        updateCount();
        runDetectionAndClassification(false);
        setSpacecraftStatus(
            `＋ Added Debris #${mesh.userData.id} to Orbit ${mesh.userData.orbitNumber} (${mesh.userData.classCode}). Total: ${debrisList.length}`,
            "info"
        );
        event.target.blur();
    });
}

// Bulk Action: Clear Targeted Debris
const btnClearDebris = document.getElementById("clearDebris");
if (btnClearDebris) {
    btnClearDebris.addEventListener("click", event => {
        const targets = getTargetedDebrisList().slice();
        if (targets.length === 0) {
            setSpacecraftStatus("No debris found in targeted scope to clear.", "warn");
            return;
        }
        for (let i = 0; i < targets.length; i++) {
            const mesh = targets[i];
            if (mesh.userData.trajectoryLine) {
                scene.remove(mesh.userData.trajectoryLine);
                const tIdx = deorbitingTrajectories.indexOf(mesh.userData.trajectoryLine);
                if (tIdx !== -1) deorbitingTrajectories.splice(tIdx, 1);
            }
            scene.remove(mesh);
            const idx = debrisList.indexOf(mesh);
            if (idx !== -1) debrisList.splice(idx, 1);
        }
        updateCount();
        runDetectionAndClassification(false);
        setSpacecraftStatus(`🗑️ Cleared ${targets.length} debris item(s) from targeted scope. Total remaining: ${debrisList.length}`, "warn");
        event.target.blur();
    });
}

// Bulk Action: Repopulate All 5 Orbits
const btnRepopulate = document.getElementById("repopulateOrbits");
if (btnRepopulate) {
    btnRepopulate.addEventListener("click", event => {
        while (debrisList.length > 0) {
            const m = debrisList.pop();
            if (m.userData.trajectoryLine) scene.remove(m.userData.trajectoryLine);
            scene.remove(m);
        }
        populateInitialOrbits();
        updateCount();
        runDetectionAndClassification(false);
        setSpacecraftStatus("↻ Repopulated all 5 orbits with realistic non-uniform distribution (120 debris).", "success");
        event.target.blur();
    });
}

// Spacecraft UI panel action buttons (mirroring keyboard keys D, C, L, R, V)
document.getElementById("btnDetect").addEventListener("click", e => {
    runDetectionAndClassification(true);
    e.target.blur();
});

document.getElementById("btnCapture").addEventListener("click", e => {
    executeCapture(null, false);
    e.target.blur();
});

document.getElementById("btnDeorbit").addEventListener("click", e => {
    executeDeorbit();
    e.target.blur();
});

document.getElementById("btnStore").addEventListener("click", e => {
    executeStoreInSpacecraft();
    e.target.blur();
});

document.getElementById("btnEjectCapsule").addEventListener("click", e => {
    executeEjectCapsule();
    e.target.blur();
});

document.getElementById("btnCameraFollow").addEventListener("click", e => {
    spacecraftState.cameraFollow = !spacecraftState.cameraFollow;
    e.target.textContent = spacecraftState.cameraFollow
        ? "🎥 [V] Free Cam"
        : "🎥 [V] Follow Craft";
    if (!spacecraftState.cameraFollow) {
        controls.target.set(0, 0, 0);
    }
    e.target.blur();
});


// ============================================================
// DEDICATED KEYBOARD CONTROLS (Spacecraft Movement & 4 Core Functions)
// ============================================================

/**
 * Prevents keyboard input conflict when user is actively manipulating
 * a dropdown or slider in the UI panel.
 */
function isUIControlFocused(event) {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName;
    const key = event.key.toLowerCase();
    // Allow Tab, H, or M to command the sliding drawer at all times
    if (key === "tab" || key === "h" || key === "m") {
        if (el.blur) el.blur();
        return false;
    }
    if (tag === "SELECT" || tag === "TEXTAREA") {
        // Allow letter shortcuts to blur the select and run spacecraft action,
        // but keep arrow keys for dropdown navigation if select is focused
        if (event.key.startsWith("Arrow")) return true;
        el.blur();
    }
    if (tag === "INPUT" && el.type === "range") {
        if (event.key.startsWith("Arrow")) return true;
        el.blur();
    }
    return false;
}

window.addEventListener("keydown", event => {

    if (event.ctrlKey || event.altKey || event.metaKey) return;
    if (isUIControlFocused(event)) return;

    const key = event.key.toLowerCase();

    // Toggle Sliding Control Drawer Command (Tab, H, or M)
    if (key === "tab" || key === "h" || key === "m") {
        event.preventDefault();
        toggleControlPanel();
        return;
    }

    // Orbital Position Adjustment (WASD / Arrow Keys / Q & Z)
    if (key === "w" || event.key === "ArrowUp") {
        keyState.forward = true;
        event.preventDefault();
    } else if (key === "s" || event.key === "ArrowDown") {
        keyState.backward = true;
        event.preventDefault();
    } else if (key === "a" || event.key === "ArrowLeft") {
        keyState.left = true;
        event.preventDefault();
    } else if (key === "e" || event.key === "ArrowRight") {
        keyState.right = true;
        event.preventDefault();
    } else if (key === "q") {
        keyState.up = true;
    } else if (key === "z") {
        keyState.down = true;
    }

    // Dedicated Spacecraft Function Keys (Single-trigger on press)
    if (!event.repeat) {
        if (key === "d") {
            // 1. Detection & Classification
            runDetectionAndClassification(true);
        } else if (key === "c") {
            // 2. Capture Targeted Debris onto Grapple Claw
            executeCapture(null, false);
        } else if (key === "l") {
            // 3. Deorbit Targeted Debris
            executeDeorbit();
        } else if (key === "r") {
            // 4. Store Inside Spacecraft (0 - 30 capacity)
            executeStoreInSpacecraft();
        } else if (key === "x") {
            // 5. Eject Full Cargo Capsule (when 30 / 30) & reset bay to 0
            executeEjectCapsule();
        } else if (key === "v") {
            // Toggle Spacecraft Chase Camera
            spacecraftState.cameraFollow = !spacecraftState.cameraFollow;
            const btn = document.getElementById("btnCameraFollow");
            if (btn) {
                btn.textContent = spacecraftState.cameraFollow
                    ? "🎥 [V] Free Cam"
                    : "🎥 [V] Follow Craft";
            }
            if (!spacecraftState.cameraFollow) {
                controls.target.set(0, 0, 0);
            }
            setSpacecraftStatus(
                spacecraftState.cameraFollow
                    ? "🎥 Camera locked to Da Vinci Spacecraft in Orbit 3."
                    : "🎥 Camera returned to Global Earth Orbit view.",
                "info"
            );
        }
    }

});

window.addEventListener("keyup", event => {

    const key = event.key.toLowerCase();

    if (key === "w" || event.key === "ArrowUp") {
        keyState.forward = false;
    } else if (key === "s" || event.key === "ArrowDown") {
        keyState.backward = false;
    } else if (key === "a" || event.key === "ArrowLeft") {
        keyState.left = false;
    } else if (key === "e" || event.key === "ArrowRight") {
        keyState.right = false;
    } else if (key === "q") {
        keyState.up = false;
    } else if (key === "z") {
        keyState.down = false;
    }

});


// ============================================================
// COUNT & PER-ORBIT BREAKDOWN
// ============================================================

function updateCount() {

    const countEl =
        document.getElementById("debrisCount");

    if (countEl) {
        countEl.textContent = debrisList.length;
    }

    const breakdownEl =
        document.getElementById("orbitBreakdownText");

    if (breakdownEl) {
        const counts = [0, 0, 0, 0, 0];
        for (let i = 0; i < debrisList.length; i++) {
            const idx = debrisList[i].userData.orbitIndex;
            if (idx >= 0 && idx < 5) counts[idx]++;
        }
        breakdownEl.innerHTML =
            `O1:${counts[0]} | O2:${counts[1]} | <strong style="color:#00f0ff;">O3:${counts[2]}</strong> | O4:${counts[3]} | O5:${counts[4]}`;
    }

}

updateCount();


// ============================================================
// ANIMATION LOOP (Physics, Orbital Mechanics, Collision & Effects)
// ============================================================

const clock =
    new THREE.Clock();

function animate() {

    requestAnimationFrame(
        animate
    );

    const delta =
        Math.min(clock.getDelta(), 0.1);

    const elapsedTime =
        clock.getElapsedTime();


    // --------------------------------------------------------
    // 1. REALISTIC EARTH & CLOUD ROTATION
    // --------------------------------------------------------

    earth.rotation.y +=
        delta * 0.14;

    if (earthClouds) {
        earthClouds.rotation.y +=
            delta * 0.045;
    }

    earthDetail.rotation.y =
        earth.rotation.y;

    atmosphere.rotation.y =
        earth.rotation.y;


    // --------------------------------------------------------
    // 2. SPACECRAFT ORBITAL MECHANICS & KEYBOARD THRUSTERS (ORBIT 3)
    // --------------------------------------------------------

    let thrustPower = 1.0;

    if (keyState.forward) {
        spacecraftState.angularVelocityBoost = THREE.MathUtils.lerp(
            spacecraftState.angularVelocityBoost,
            1.35,
            delta * 5
        );
        thrustPower = 2.4;
    } else if (keyState.backward) {
        spacecraftState.angularVelocityBoost = THREE.MathUtils.lerp(
            spacecraftState.angularVelocityBoost,
            -1.15,
            delta * 5
        );
        thrustPower = 2.1;
    } else {
        spacecraftState.angularVelocityBoost = THREE.MathUtils.lerp(
            spacecraftState.angularVelocityBoost,
            0,
            delta * 4
        );
    }

    if (keyState.left) {
        spacecraftState.targetRadialOffset = Math.max(
            -1.6,
            spacecraftState.targetRadialOffset - delta * 2.2
        );
        thrustPower = 1.9;
    }
    if (keyState.right) {
        spacecraftState.targetRadialOffset = Math.min(
            1.6,
            spacecraftState.targetRadialOffset + delta * 2.2
        );
        thrustPower = 1.9;
    }
    if (keyState.up) {
        spacecraftState.targetAltitudeOffset = Math.min(
            1.3,
            spacecraftState.targetAltitudeOffset + delta * 1.8
        );
        thrustPower = 1.7;
    }
    if (keyState.down) {
        spacecraftState.targetAltitudeOffset = Math.max(
            -1.3,
            spacecraftState.targetAltitudeOffset - delta * 1.8
        );
        thrustPower = 1.7;
    }

    if (state.running) {
        const effectiveAngularSpeed =
            (spacecraftState.baseAngularSpeed + spacecraftState.angularVelocityBoost) *
            spacecraftState.direction *
            state.globalSpeed *
            0.25;

        spacecraftState.angle += effectiveAngularSpeed * delta;
    }

    updateSpacecraftTransform(delta);

    // Animate spacecraft radar dish & ion thruster plume
    if (spacecraftRadarDish) {
        spacecraftRadarDish.rotation.y += delta * 2.8;
    }
    if (spacecraftThrusterFlame) {
        const flicker = 0.85 + Math.sin(elapsedTime * 28) * 0.18;
        spacecraftThrusterFlame.scale.set(
            1,
            1,
            thrustPower * flicker
        );
    }


    // --------------------------------------------------------
    // 3. DEBRIS ORBITAL MECHANICS, DEORBIT SPIRAL & COLLISION DETECTION
    // --------------------------------------------------------

    if (state.running) {

        for (
            let i = debrisList.length - 1;
            i >= 0;
            i--
        ) {

            const mesh =
                debrisList[i];

            const data =
                mesh.userData;

            if (data.status === "deorbiting") {

                // Spiral descent physics toward Earth's upper atmosphere
                data.deorbitProgress += delta * 0.42 * Math.max(0.4, state.globalSpeed);
                const t = Math.min(1, data.deorbitProgress);
                const easeT = t * t * (3 - 2 * t);

                const targetEntryRadius = CONFIG.earthRadius * 1.04;
                data.radius = THREE.MathUtils.lerp(
                    data.deorbitStartRadius,
                    targetEntryRadius,
                    easeT
                );
                data.angle =
                    data.deorbitStartAngle + data.totalAngleSweep * t;

                const currentHeight = THREE.MathUtils.lerp(
                    data.deorbitStartHeight,
                    0,
                    easeT
                );

                mesh.position.set(
                    Math.cos(data.angle) * data.radius,
                    currentHeight,
                    Math.sin(data.angle) * data.radius
                );

                mesh.rotation.x += delta * 6;
                mesh.rotation.y += delta * 6;

                // Atmospheric burnup upon reaching Earth's atmosphere
                if (t >= 1.0 || data.radius <= CONFIG.earthRadius * 1.06) {
                    spawnPulseEffect(mesh.position, 0xff4500, 2.8, 0.65);

                    if (data.trajectoryLine) {
                        scene.remove(data.trajectoryLine);
                        const tIdx = deorbitingTrajectories.indexOf(data.trajectoryLine);
                        if (tIdx !== -1) deorbitingTrajectories.splice(tIdx, 1);
                    }

                    scene.remove(mesh);
                    debrisList.splice(i, 1);
                    spacecraftState.totalDeorbited++;
                    updateCount();
                    setSpacecraftStatus(
                        `🔥 DEORBIT COMPLETE: Debris #${data.id} disintegrated in Earth's upper atmosphere!`,
                        "success"
                    );
                    continue;
                }

            } else {

                // Standard Keplerian-inspired orbital motion
                data.angle +=
                    data.speed *
                    data.direction *
                    state.globalSpeed *
                    delta *
                    0.25;

                updateDebrisPosition(mesh);

                // Individual axis spin
                const spin =
                    data.spinSpeed *
                    delta;

                if (data.axis === "x") {
                    mesh.rotation.x += spin;
                } else if (data.axis === "y") {
                    mesh.rotation.y += spin;
                } else {
                    mesh.rotation.z += spin;
                }

                // Physical Collision Detection between Spacecraft & Debris
                const distToCraft = spacecraftGroup.position.distanceTo(mesh.position);
                if (
                    distToCraft <= spacecraftState.collisionRadius &&
                    spacecraftState.cargoHold.length < spacecraftState.maxCargoCapacity &&
                    !data.isRecycled
                ) {
                    executeCapture(mesh, true);
                    continue;
                }

            }

        }

        // Animate Ejected Cargo Capsules descending toward Earth
        for (let c = activeEjectedCapsules.length - 1; c >= 0; c--) {
            const cap = activeEjectedCapsules[c];
            cap.progress += delta * 0.38 * Math.max(0.4, state.globalSpeed);
            const t = Math.min(1, cap.progress);
            const easeT = t * t * (3 - 2 * t);
            const targetEntryRadius = CONFIG.earthRadius * 1.04;

            const r = THREE.MathUtils.lerp(cap.startRadius, targetEntryRadius, easeT);
            const ang = cap.startAngle + cap.totalAngleSweep * t;
            const h = THREE.MathUtils.lerp(cap.startHeight, 0, easeT);

            cap.mesh.position.set(Math.cos(ang) * r, h, Math.sin(ang) * r);
            cap.mesh.rotation.y += delta * 3.5;

            if (t >= 1.0 || r <= CONFIG.earthRadius * 1.06) {
                spawnPulseEffect(cap.mesh.position, 0xfbbf24, 3.0, 0.7);
                scene.remove(cap.mesh);
                if (cap.trajectoryLine) {
                    scene.remove(cap.trajectoryLine);
                    const tIdx = deorbitingTrajectories.indexOf(cap.trajectoryLine);
                    if (tIdx !== -1) deorbitingTrajectories.splice(tIdx, 1);
                }
                activeEjectedCapsules.splice(c, 1);
            }
        }

    }

    // Continuous proximity Detection & Classification update
    runDetectionAndClassification(false);

    if (targetReticleGroup && targetReticleGroup.visible) {
        targetReticleGroup.rotation.z += delta * 1.8;
    }


    // --------------------------------------------------------
    // 4. TRANSIENT VISUAL EFFECTS UPDATE
    // --------------------------------------------------------

    for (let i = activeTransientEffects.length - 1; i >= 0; i--) {
        const fx = activeTransientEffects[i];
        fx.age += delta;
        const progress = fx.age / fx.duration;

        if (progress >= 1) {
            scene.remove(fx.mesh);
            if (fx.mesh.geometry) fx.mesh.geometry.dispose();
            if (fx.mesh.material) fx.mesh.material.dispose();
            activeTransientEffects.splice(i, 1);
        } else {
            if (fx.type === "pulse") {
                const s = 1 + progress * fx.maxScale;
                fx.mesh.scale.set(s, s, s);
                fx.mesh.material.opacity = (1 - progress) * 0.9;
            } else if (fx.type === "beam") {
                fx.mesh.material.opacity = 1 - progress;
            }
        }
    }


    // --------------------------------------------------------
    // 5. CAMERA FOLLOW / ORBIT CONTROLS & RENDER
    // --------------------------------------------------------

    if (spacecraftState.cameraFollow) {
        controls.target.lerp(spacecraftGroup.position, Math.min(1, delta * 8));
    }

    controls.update();

    renderer.render(
        scene,
        camera
    );

}


// ============================================================
// RESIZE
// ============================================================

window.addEventListener(

    "resize",

    () => {

        camera.aspect =
            window.innerWidth /
            window.innerHeight;

        camera.updateProjectionMatrix();

        renderer.setSize(
            window.innerWidth,
            window.innerHeight
        );

    }

);


// ============================================================
// START
// ============================================================

animate();
