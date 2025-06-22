// Enhanced simulation state: Stores all changeable parameters and dynamic elements
let simulationState = {
    surfaceTemp: 25,          // Ground level air temperature (internal Celsius)
    upperTemp: -40,           // Upper atmosphere air temperature (internal Celsius)
    humidity: 70,             // Air moisture content
    windShear: 8,             // Change in wind velocity with height
    surfacePressure: 1013,    // Atmospheric pressure at ground level
    stormMotion: 25,          // General speed of storm movement
    lowLevelJet: 15,          // Strength of low-level winds
    time: 0,                  // Simulation time (frames)
    paused: false,            // Is simulation paused?
    simSpeed: 0.8,              // Multiplier for simulation speed - Default changed to 0.8x
    tornadoes: [],            // Array of active Tornado objects
    storms: [],               // Array of active StormCell objects
    probes: [],               // Array of active Probe objects
    interceptTeams: [],       // Array of active InterceptTeam objects
    selectedTeamForDeployment: null, // Stores the ID of the team selected for deployment
    awaitingTeamTarget: false, // Flag to indicate if user is selecting a tornado target
    statistics: {             // Simulation-wide statistics
        totalTornadoes: 0,
        peakIntensity: 0,     // Max EF rating observed (0-5)
        longestTrack: 0       // Longest path of any tornado in miles (ratio miles now)
    },
    clickToAdd: true,         // Flag to allow spawning storms by clicking
    autoRun: false,           // Flag for auto-run mode
    nextAutoSpawnTime: 0,     // When next auto-spawn event should occur
    nextAutoProbeTime: 0,     // When next auto-probe launch should occur
    autoDeployCooldown: 0,    // Cooldown timer to prevent rapid-fire auto-deployments
    nextRefillTime: 0,        // When the next team refill should occur
    teamPool: {               // Counts for available intercept teams
        'TIV1': {maxCount: 3, currentCount: 3},
        'TIV2': {maxCount: 5, currentCount: 5},
        'DOM1': {maxCount: 2, currentCount: 2},
        'DOM2': {maxCount: 3, currentCount: 3},
        'DOM3': {maxCount: 3, currentCount: 3},
        'TORNADO_ATTACK': {maxCount: 2, currentCount: 2},
        'TITUS': {maxCount: 3, currentCount: 3}
    },
    // New state variables for rain, lightning, and immersive effects
    currentRainIntensity: 0, // 0 to 1, controlling rain density/speed
    lightningFlash: 0,       // 0 to 1, controlling lightning flash brightness
    nextLightningStrikeTime: 0, // When the next lightning strike should occur
    currentWindyIntensity: 0, // 0 to 1, controlling intensity of wind lines
    currentMistyIntensity: 0,  // 0 to 1, controlling intensity of mist overlay
    targetCAPE: 0,           // New: Target CAPE value after a tornado
    capeTransitionStartTime: 0, // New: When CAPE transition started
    initialCAPEDuringTransition: 0, // New: CAPE value at start of transition
    isCAPERandomizing: false, // New: Flag to indicate if CAPE is actively randomizing after a tornado
    capeTransitionDuration: 180, // New: 3 seconds (180 frames) for CAPE transition
    
    // For active tornado display in top-left box
    activeTornadoDisplayIndex: 0, // Index of the tornado currently displayed in the info box
    screenShakeIntensity: 0, // New: intensity of screen shake (0-1)
    currentHailIntensity: 0, // New: intensity of hail (0-1)
    lastStormActivityTime: 0 // Track last time a storm or tornado was active for auto-run
};

// Tornado lifecycle phases: Defined states for a tornado's development
const TORNADO_PHASES = {
    FORMING: 'Forming',
    ORGANIZING: 'Organizing', 
    MATURE: 'Mature',
    SHRINKING: 'Shrinking',
    DECAYING: 'Decaying',
    DISSIPATING: 'Dissipating'
};

// Enhanced Fujita Scale ratings for display
const EF_RATINGS = ["EF0", "EF1", "EF2", "EF3", "EF4", "EF5"];
// Min and Max wind speeds (mph) for each EF rating (User provided ranges)
const EF_WIND_RANGES = [
    { min: 65, max: 85 },   // EF0
    { min: 86, max: 110 },  // EF1
    { min: 111, max: 135 }, // EF2
    { min: 136, max: 165 }, // EF3
    { min: 166, max: 200 }, // EF4
    { min: 201, max: 270 }  // EF5 (>200, cap at 270 for calculation purposes)
];
// Min and Max widths (miles) for each EF rating (User provided ranges)
// These are REAL-WORLD miles. The simulation uses PIXELS_PER_MILE_SCALE for rendering.
const EF_WIDTH_RANGES = [
    { min: 0.05, max: 0.1 },    // EF0 (100-200 yards)
    { min: 0.1, max: 0.2 },     // EF1 (200-400 yards)
    { min: 0.2, max: 0.4 },     // EF2 (400-800 yards)
    { min: 0.4, max: 0.6 },     // EF3 (800-1200 yards)
    { min: 0.6, max: 0.9 },     // EF4 (1200-1800 yards)
    { min: 1.0, max: 1.4 }      // EF5 (1.0-1.4+ miles)
];

// Tornado phase durations in frames (60 frames per second)
const FORMING_DURATION_FRAMES = 13 * 60;
const ORGANIZING_DURATION_FRAMES = 19 * 60;
const MATURE_DURATION_FRAMES = 28 * 60;
const SHRINKING_DURATION_FRAMES = 8 * 60;
const DECAYING_DURATION_FRAMES = 12 * 60;
const DISSIPATING_DURATION_FRAMES = 3 * 60; // This is the forced dissipation time

// Total lifespan for a tornado based on defined phases
const TOTAL_TORNADO_LIFESPAN_FRAMES = FORMING_DURATION_FRAMES + ORGANIZING_DURATION_FRAMES + MATURE_DURATION_FRAMES + SHRINKING_DURATION_FRAMES + DECAYING_DURATION_FRAMES + DISSIPATING_DURATION_FRAMES;


// Intercept Team Data (Realistic values for known vehicles)
const INTERCEPT_TEAMS_DATA = {
    'TIV1': {
        name: 'TIV 1',
        undeployedWindThreshold: 150,
        deployedWindThreshold: 200,
        speed: 5,
        color: '#FF0000',
        deployedColor: '#AA0000',
        baseLocation: {x: 0, y: 0}
    },
    'TIV2': {
        name: 'TIV 2',
        undeployedWindThreshold: 180,
        deployedWindThreshold: 250,
        speed: 4,
        color: '#00FF00',
        deployedColor: '#00AA00',
        baseLocation: {x: 0, y: 0}
    },
    'DOM1': {
        name: 'Dominator 1',
        undeployedWindThreshold: 130,
        deployedWindThreshold: 170,
        speed: 5.5,
        color: '#0000FF',
        deployedColor: '#0000AA',
        baseLocation: {x: 0, y: 0}
    },
    'DOM2': {
        name: 'Dominator 2',
        undeployedWindThreshold: 140,
        deployedWindThreshold: 180,
        speed: 5.2,
        color: '#FFFF00',
        deployedColor: '#AAAA00',
        baseLocation: {x: 0, y: 0}
    },
    'DOM3': {
        name: 'Dominator 3',
        undeployedWindThreshold: 160,
        deployedWindThreshold: 200,
        speed: 4.8,
        color: '#00FFFF',
        deployedColor: '#00AAAA',
        baseLocation: {x: 0, y: 0}
    },
    'TORNADO_ATTACK': {
        name: 'Tornado Attack',
        undeployedWindThreshold: 135,
        deployedWindThreshold: 160,
        speed: 5.3,
        color: '#FF00FF',
        deployedColor: '#AA00AA',
        baseLocation: {x: 0, y: 0}
    },
    'TITUS': {
        name: 'Titus',
        undeployedWindThreshold: 140,
        deployedWindThreshold: 175,
        speed: 5.1,
        color: '#FFA500',
        deployedColor: '#AA7000',
        baseLocation: {x: 0, y: 0}
    }
};

// Sound effects
const SOUNDS = {
    tornadoSiren: new Audio('audio/tornado_siren.mp3'),
    noaaWarning: new Audio('audio/noaa_warning.mp3')
};

// Sound state tracking
let isTornadoSirenPlaying = false;
let isNoaaWarningPlaying = false;
let lastTornadoCount = 0;

// Function to handle tornado warning sounds
function handleTornadoWarningSounds() {
    const activeTornadoes = simulationState.tornadoes.filter(t => t.isActive);
    const currentTornadoCount = activeTornadoes.length;

    // Only play sounds if we transition from 0 to 1+ tornadoes
    if (currentTornadoCount > 0 && lastTornadoCount === 0) {
        // Play tornado siren in background
        SOUNDS.tornadoSiren.volume = 0.68; // Increased from 0.3 to 0.68
        SOUNDS.tornadoSiren.play();
        isTornadoSirenPlaying = true;

        // Play NOAA warning at full volume
        SOUNDS.noaaWarning.volume = 0.68;
        SOUNDS.noaaWarning.play();
        isNoaaWarningPlaying = true;
    }

    // Update last tornado count
    lastTornadoCount = currentTornadoCount;
}

// Canvas element references and contexts - Declared globally, assigned in window.onload
let canvas;
let ctx;
let radarCanvas;
let radarCtx;
let simulationAreaDiv;


// Global scale factor for converting "ratio miles" to pixels for visualization
// 1 "ratio mile" = PIXELS_PER_MILE_SCALE pixels. This is the unit used for display.
let PIXELS_PER_MILE_SCALE = 100; // Default, will be updated by resizeCanvas.

// New constants for rain, lightning, and debris
const RAIN_PARTICLES_BASE = 500; // Base number of raindrops
const HAIL_PARTICLES_BASE = 100; // Base number of hail particles
const LIGHTNING_FLASH_DECAY = 0.05; // How fast lightning flash fades
const LIGHTNING_MIN_INTERVAL_FRAMES = 3 * 60; // 3 seconds * 60 frames/sec
const LIGHTNING_MAX_INTERVAL_FRAMES = 7 * 60; // 7 seconds * 60 frames/sec
const DEBRIS_SIZES = [1, 3, 5]; // Small, medium, large debris particle sizes
const AUTORUN_SPAWN_COOLDOWN_FRAMES = 10 * 60; // 10 seconds of no activity before spawning

// CAPE range as requested by user (0-5000 J/kg)
const MIN_CAPE = 0;
const MAX_CAPE = 5000;

/**
 * Resizes the main simulation canvas to match its parent container's dimensions.
 * Called on window resize and initial load to ensure responsiveness.
 */
function resizeCanvas() {
    // Ensure elements are available before accessing clientWidth/clientHeight
    if (!simulationAreaDiv || !radarCanvas) {
        console.error("Canvas elements not found during resizeCanvas. This should not happen if initialized in window.onload.");
        return;
    }

    canvas.width = simulationAreaDiv.clientWidth;
    canvas.height = simulationAreaDiv.clientHeight;
    radarCanvas.width = document.getElementById('radarOverlay').clientWidth;
    radarCanvas.height = document.getElementById('radarOverlay').clientHeight;
    // Recalculate base locations for intercept teams based on new canvas size
    for (let teamId in INTERCEPT_TEAMS_DATA) {
        INTERCEPT_TEAMS_DATA[teamId].baseLocation = {
            x: canvas.width * 0.1,
            y: canvas.height * (0.1 + (Object.keys(INTERCEPT_TEAMS_DATA).indexOf(teamId) * 0.1))
        };
    }

    // Dynamically adjust PIXELS_PER_MILE_SCALE based on canvas width
    // 1 "ratio mile" = 30% of canvas width.
    PIXELS_PER_MILE_SCALE = canvas.width * 0.3; 
}

// Event listener for window resize to keep canvas responsive
window.addEventListener('resize', resizeCanvas);


/**
 * Converts Fahrenheit to Celsius.
 * @param {number} fahrenheit - Temperature in Fahrenheit.
 * @returns {number} Temperature in Celsius.
 */
function fahrenheitToCelsius(fahrenheit) {
    return (fahrenheit - 32) * 5/9;
}

/**
 * Converts Celsius to Fahrenheit.
 * @param {number} celsius - Temperature in Celsius.
 * @returns {number} Temperature in Fahrenheit.
 */
function celsiusToFahrenheit(celsius) {
    return (celsius * 9/5) + 32;
}

/**
 * Represents a single tornado in the simulation.
 * Handles its lifecycle, movement, intensity, and debris effects.
 */
class Tornado {
    constructor(x, y, initialSizeInfluence = 1.0) { // Added initialSizeInfluence parameter
        this.id = Date.now() + Math.random(); // Unique ID for each tornado
        this.x = x;                         // Current X coordinate
        this.y = y;                         // Current Y coordinate
        this.startX = x;                    // Starting X coordinate for path length
        this.startY = y;                    // Starting Y coordinate for path length
        this.intensity = 0.05;              // Initial intensity (0 to 1, maps to wind speed)
        this.maxIntensityReached = 0;       // Max intensity value reached
        this.windSpeed = EF_WIND_RANGES[0].min;   // Current estimated max wind speed (mph), starts at EF0 min
        this.maxWindSpeed = EF_WIND_RANGES[0].min;// Max wind speed reached during its lifespan
        this.width = 10;                    // Current visual width of the funnel in pixels
        this.maxWidth = 10;                 // Max visual width reached during its lifespan in pixels
        this.currentRealWorldWidthMiles = EF_WIDTH_RANGES[0].min; // Current real-world width in miles (for EF rating)
        this.maxRealWorldWidthMiles = EF_WIDTH_RANGES[0].min; // Max real-world width reached during its lifespan in miles
        this.initialSizeInfluence = initialSizeInfluence; // Influence from parent storm size

        // Set total lifespan based on defined phases
        this.lifespan = TOTAL_TORNADO_LIFESPAN_FRAMES; 
        this.phase = TORNADO_PHASES.FORMING; // Current lifecycle phase
        this.age = 0;                       // Age in simulation frames
        this.direction = Math.random() * Math.PI * 2; // Initial movement direction
        this.speed = simulationState.stormMotion * 0.01; // Base movement speed, influenced by storm motion
        this.pathLength = 0;                // Length of the damage path in "ratio miles"
        this.vorticity = 0;                 // Internal measure of rotation strength
        this.efRating = 0;                  // Enhanced Fujita (EF) scale rating (0-5)
        this.isActive = true;               // Is the tornado still active?
        this.path = [{x: x, y: y, time: simulationState.time}]; // Array of points for the damage path
        this.cycleTimer = 0;                // Timer for intensity fluctuations
        this.intensityTrend = 1;            // Trend for intensity cycles (+1 for growing, -1 for shrinking)
        this.peakWindDuration = 0;          // How long the tornado has been at peak wind speed
        this.peakWindThreshold = 180;       // Frames to hover at peak wind (e.g., 3 seconds)
        this.debris = [];                   // Particles representing airborne debris
        this.pressureDrop = 0;              // Estimated pressure drop in tornado core
        this.teamAssigned = null;           // Stores the ID of the intercept team assigned to this tornado
        this.dissipationStallCounter = 0;   // Timer to track if tornado is stuck in dissipating phase
        this.fadeTimer = 0;                 // Timer for fade-out effect when inactive
        this.lastLoftedTime = 0;            // Stores the time when a team was last lofted by this tornado
        this.capeAtFormation = calculateCAPE(); // Store CAPE at time of formation
        this.statsUpdated = false;          // Flag to ensure statistics are updated only once per tornado.
        this.rotationOffset = Math.random() * Math.PI * 2; // Unique rotation offset for each tornado

        // Calculate target peak wind and width based on CAPE at formation and initial size influence
        const potentialEfRating = this.determinePotentialEfRating(this.capeAtFormation, simulationState.windShear, calculateHelicity());
        // Set the peak target to the max of that potential EF range, or slightly higher for dramatic effect
        this.peakWindSpeedTarget = EF_WIND_RANGES[potentialEfRating].max + Math.random() * 10; 
        this.peakWidthTarget = EF_WIDTH_RANGES[potentialEfRating].max * (1 + (this.initialSizeInfluence - 1) * 0.5) + Math.random() * 0.1; // Add some random variance
        // Cap the peak targets to max EF5 values
        this.peakWindSpeedTarget = Math.min(this.peakWindSpeedTarget, EF_WIND_RANGES[5].max);
        this.peakWidthTarget = Math.min(this.peakWidthTarget, EF_WIDTH_RANGES[5].max * 1.5); // Allow for slightly larger than EF5 max width

        // Initialize debris particles around the tornado with varied sizes
        for (let i = 0; i < 50; i++) {
            this.debris.push({
                x: x + (Math.random() - 0.5) * 100, // Random initial position around tornado
                y: y + (Math.random() - 0.5) * 100,
                vx: (Math.random() - 0.5) * 10,     // Initial horizontal velocity
                vy: (Math.random() - 0.5) * 10,     // Initial vertical velocity
                size: DEBRIS_SIZES[Math.floor(Math.random() * DEBRIS_SIZES.length)], // Random size from predefined options
                life: Math.random() * 100 + 50      // Lifespan of the debris particle
            });
        }
    }

    /**
     * Helper to determine potential EF rating at a given CAPE/shear/helicity.
     * This helps set the *target* intensity for the tornado, before phase adjustments.
     */
    determinePotentialEfRating(cape, shear, helicity) {
        // Adjust scaling based on new CAPE range (0-5000)
        // Assuming max potential is at max CAPE (5000), max shear (20), max helicity (approx 700)
        const normalizedCape = cape / MAX_CAPE; // Scale CAPE to 0-1
        const normalizedShear = shear / 20; // Max shear is 20
        const normalizedHelicity = helicity / 700; // Rough max for helicity from current formula

        // Combine factors. Higher values mean higher potential EF rating.
        // Weight CAPE more heavily as it's a primary driver of storm strength.
        let baseAtmosphericIntensity = (normalizedCape * 0.5 + normalizedShear * 0.3 + normalizedHelicity * 0.2); 
        baseAtmosphericIntensity = Math.min(1.0, Math.max(0, baseAtmosphericIntensity)); // Clamp to 0-1

        let potentialEfRating = 0;
        // Assign EF rating based on proportional intensity
        for (let i = EF_RATINGS.length - 1; i >= 0; i--) {
            // Divide into 6 bands (0-5)
            const intensityThreshold = i / (EF_RATINGS.length - 1); 
            if (baseAtmosphericIntensity >= intensityThreshold) {
                potentialEfRating = i;
                break;
            }
        }
        return potentialEfRating;
    }

    /**
     * Updates the tornado's state for the current frame.
     */
    update() {
        // If tornado is inactive and has no fadeTimer (or fadeTimer <= 0), it should be removed.
        if (!this.isActive && (this.fadeTimer === 0 || this.fadeTimer === undefined || this.fadeTimer <= 0)) {
            // Trigger CAPE randomization once per tornado dissipation, and only if not already randomizing
            // This ensures CAPE changes only when a tornado fully disappears.
            if (!simulationState.isCAPERandomizing) {
                randomizeCAPE();
                simulationState.isCAPERandomizing = true; // Set flag to prevent repeated calls until transition is done
            }
            // Update longest track ONLY when the tornado is fully removed from simulation
            if (!this.statsUpdated) {
                simulationState.statistics.longestTrack = Math.max(simulationState.statistics.longestTrack, this.pathLength);
                this.statsUpdated = true; // Mark stats as updated for this tornado
            }
            this.debris = []; // Ensure debris is cleared
            this.path = [];   // Ensure path is cleared
            return; 
        }

        this.age++;
        this.cycleTimer++;

        // Get current atmospheric conditions
        const cape = calculateCAPE(); 
        const shear = simulationState.windShear;
        const helicity = calculateHelicity();
        
        // Update based on lifecycle and environment
        this.updatePhase();
        this.updateIntensity(cape, shear, helicity); // Pass current environmental values
        this.updateMovement();
        this.updatePath();
        this.updateDebris();

        // Check for forced dissipation if stuck in a low wind speed state
        if (this.phase === TORNADO_PHASES.DISSIPATING || this.windSpeed < EF_WIND_RANGES[0].min * 0.8) { 
            this.dissipationStallCounter += simulationState.simSpeed;
            if (this.dissipationStallCounter >= DISSIPATING_DURATION_FRAMES) { // Use constant for force dissipate time
                this.isActive = false;
                this.fadeTimer = 0; // Force immediate removal
                this.debris = []; 
                this.path = [];   
                // Send back any assigned intercept teams
                const team = simulationState.interceptTeams.find(t => t.targetTornadoId === this.id && t.isActive);
                if (team) {
                    team.state = 'RETURNING';
                    team.targetTornadoId = null;
                    team.isDeployed = false;
                }
                return; // Stop further updates for this tornado
            }
        } else {
            this.dissipationStallCounter = 0; // Reset counter if conditions improve
        }

        // If tornado is in DECAYING phase, check if a team should return
        if (this.phase === TORNADO_PHASES.DECAYING) {
            const team = simulationState.interceptTeams.find(t => t.targetTornadoId === this.id && t.isActive);
            if (team && team.state !== 'RETURNING' && team.state !== 'LOFTED') {
                team.state = 'RETURNING';
                team.targetTornadoId = null; 
                team.isDeployed = false; 
                createAlert('Team Update', `${team.teamData.name} returning to base (Tornado entering decaying phase).`, 'success');
            }
        }

        // If tornado is inactive (windSpeed < EF0.min already triggered it), and fadeTimer is active, decrement it
        if (!this.isActive && this.fadeTimer > 0) {
            this.fadeTimer -= simulationState.simSpeed;
        }
        
        // Update peak intensity statistic (can be updated every frame if it increases)
        simulationState.statistics.peakIntensity = Math.max(simulationState.statistics.peakIntensity, this.efRating);
        
        // Update screen shake intensity based on tornado's current EF rating
        let currentShakeBase = 0;
        if (this.efRating <= 1) { // EF0-EF1 (very light)
            currentShakeBase = 0.02 + (this.windSpeed - EF_WIND_RANGES[0].min) / (EF_WIND_RANGES[1].max - EF_WIND_RANGES[0].min) * 0.00; // 0.02
        } else if (this.efRating <= 3) { // EF2-EF3 (little bit heavier)
            currentShakeBase = 0.03 + (this.windSpeed - EF_WIND_RANGES[2].min) / (EF_WIND_RANGES[3].max - EF_WIND_RANGES[2].min) * 0.00; // 0.03
        } else { // EF4-EF5 (visibly heavier)
            currentShakeBase = 0.04 + (this.windSpeed - EF_WIND_RANGES[4].min) / (EF_WIND_RANGES[5].max - EF_WIND_RANGES[4].min) * 0.00; // 0.04
        }
        // Ensure overall screen shake is driven by the strongest tornado and does not decrease rapidly
        simulationState.screenShakeIntensity = Math.max(simulationState.screenShakeIntensity, currentShakeBase);
    }

    /**
     * Determines the current lifecycle phase based on its age and defined durations.
     */
    updatePhase() {
        if (this.age < FORMING_DURATION_FRAMES) {
            this.phase = TORNADO_PHASES.FORMING;
        } else if (this.age < FORMING_DURATION_FRAMES + ORGANIZING_DURATION_FRAMES) {
            this.phase = TORNADO_PHASES.ORGANIZING;
        } else if (this.age < FORMING_DURATION_FRAMES + ORGANIZING_DURATION_FRAMES + MATURE_DURATION_FRAMES) {
            this.phase = TORNADO_PHASES.MATURE;
        } else if (this.age < FORMING_DURATION_FRAMES + ORGANIZING_DURATION_FRAMES + MATURE_DURATION_FRAMES + SHRINKING_DURATION_FRAMES) {
            this.phase = TORNADO_PHASES.SHRINKING;
        } else if (this.age < FORMING_DURATION_FRAMES + ORGANIZING_DURATION_FRAMES + MATURE_DURATION_FRAMES + SHRINKING_DURATION_FRAMES + DECAYING_DURATION_FRAMES) {
            this.phase = TORNADO_PHASES.DECAYING;
        } else {
            this.phase = TORNADO_PHASES.DISSIPATING;
            // Start fade timer if it hasn't already been set
            if (this.isActive && this.fadeTimer === 0) {
                this.isActive = false;
                this.fadeTimer = DISSIPATING_DURATION_FRAMES; // Set to 3 seconds for explicit fade-out
            }
        }
    }

    /**
     * Updates the tornado's intensity, wind speed, and width based on its lifecycle phase and targets.
     */
    updateIntensity(cape, shear, helicity) {
        let targetWindSpeed;
        let targetWidthMiles; // This variable now refers to real-world miles for EF scale
        const ageInPhase = this.age - (
            this.phase === TORNADO_PHASES.FORMING ? 0 :
            this.phase === TORNADO_PHASES.ORGANIZING ? FORMING_DURATION_FRAMES :
            this.phase === TORNADO_PHASES.MATURE ? FORMING_DURATION_FRAMES + ORGANIZING_DURATION_FRAMES :
            this.phase === TORNADO_PHASES.SHRINKING ? FORMING_DURATION_FRAMES + ORGANIZING_DURATION_FRAMES + MATURE_DURATION_FRAMES :
            this.phase === TORNADO_PHASES.DECAYING ? FORMING_DURATION_FRAMES + ORGANIZING_DURATION_FRAMES + MATURE_DURATION_FRAMES + SHRINKING_DURATION_FRAMES :
            0 // Dissipating phase
        );

        switch (this.phase) {
            case TORNADO_PHASES.FORMING:
                // From EF0 min to about 40% of peak during this phase
                const formingProgress = ageInPhase / FORMING_DURATION_FRAMES;
                targetWindSpeed = EF_WIND_RANGES[0].min + (this.peakWindSpeedTarget * 0.4 - EF_WIND_RANGES[0].min) * formingProgress;
                targetWidthMiles = EF_WIDTH_RANGES[0].min + (this.peakWidthTarget * 0.4 - EF_WIDTH_RANGES[0].min) * formingProgress;
                break;

            case TORNADO_PHASES.ORGANIZING:
                // From 40% of peak to about 90% of peak during this phase
                const organizingProgress = ageInPhase / ORGANIZING_DURATION_FRAMES;
                targetWindSpeed = this.peakWindSpeedTarget * 0.4 + (this.peakWindSpeedTarget * 0.9 - this.peakWindSpeedTarget * 0.4) * organizingProgress;
                targetWidthMiles = this.peakWidthTarget * 0.4 + (this.peakWidthTarget * 0.9 - this.peakWidthTarget * 0.4) * organizingProgress;
                break;

            case TORNADO_PHASES.MATURE:
                // Fluctuate very slightly around the peak target
                targetWindSpeed = this.peakWindSpeedTarget + (Math.random() - 0.5) * 5; // +/- 5 mph
                targetWidthMiles = this.peakWidthTarget + (Math.random() - 0.5) * 0.05; // +/- 0.05 miles
                break;

            case TORNADO_PHASES.SHRINKING:
                // Gradual decrease from peak to about 50% of peak
                const shrinkingProgress = ageInPhase / SHRINKING_DURATION_FRAMES;
                targetWindSpeed = this.peakWindSpeedTarget * (1 - 0.5 * shrinkingProgress); // Decreases to 50% of peak
                targetWidthMiles = this.peakWidthTarget * (1 - 0.5 * shrinkingProgress);
                break;

            case TORNADO_PHASES.DECAYING:
                // Continue decrease from 50% of peak to just above EF0 min
                const decayingProgress = ageInPhase / DECAYING_DURATION_FRAMES;
                const startWindDecay = this.peakWindSpeedTarget * 0.5;
                const endWindDecay = EF_WIND_RANGES[0].min * 1.1; // Ends slightly above EF0 min
                targetWindSpeed = startWindDecay - (startWindDecay - endWindDecay) * decayingProgress;

                const startWidthDecay = this.peakWidthTarget * 0.5;
                const endWidthDecay = EF_WIDTH_RANGES[0].min * 1.1; // Ends slightly above EF0 min
                targetWidthMiles = startWidthDecay - (startWidthDecay - endWidthDecay) * decayingProgress;
                break;

            case TORNADO_PHASES.DISSIPATING:
                // Rapid decay as before, leading to deactivation
                targetWindSpeed = EF_WIND_RANGES[0].min * 0.5; // Target well below EF0 min
                targetWidthMiles = EF_WIDTH_RANGES[0].min * 0.5; // Target well below EF0 min
                // More aggressive decay rate here
                this.windSpeed *= 0.95; 
                this.currentRealWorldWidthMiles *= 0.95;
                break;
        }

        // Smoothly adjust current wind speed and width towards their targets
        // Increased smoothing factor to make EF rating adjustments more immediate
        if (this.phase !== TORNADO_PHASES.DISSIPATING) {
            this.windSpeed += (targetWindSpeed - this.windSpeed) * 0.15 * simulationState.simSpeed; // Faster adjustment
            this.currentRealWorldWidthMiles += (targetWidthMiles - this.currentRealWorldWidthMiles) * 0.15 * simulationState.simSpeed; // Faster adjustment
        }
        
        // Ensure values stay within reasonable bounds (e.g., cannot go below absolute EF0 min)
        this.windSpeed = Math.max(EF_WIND_RANGES[0].min * 0.5, Math.min(EF_WIND_RANGES[5].max * 1.1, this.windSpeed));
        this.currentRealWorldWidthMiles = Math.max(EF_WIDTH_RANGES[0].min * 0.5, Math.min(EF_WIDTH_RANGES[5].max * 1.5, this.currentRealWorldWidthMiles));

        // Update max wind and width reached for stats
        this.maxWindSpeed = Math.max(this.maxWindSpeed, this.windSpeed);
        this.maxRealWorldWidthMiles = Math.max(this.maxRealWorldWidthMiles, this.currentRealWorldWidthMiles);

        // Determine actual EF rating based on current (smoothed) wind and width
        // This logic runs every frame, ensuring the EF rating updates in real-time
        // as the tornado's wind speed and width evolve through all phases.
        this.efRating = 0; 
        for (let i = EF_RATINGS.length - 1; i >= 0; i--) {
            const windMin = EF_WIND_RANGES[i].min;
            const windMax = EF_WIND_RANGES[i].max;
            const widthMin = EF_WIDTH_RANGES[i].min;
            const widthMax = EF_WIDTH_RANGES[i].max;

            // For EF5, wind and width must be >= min. For others, within min-max.
            let windFits = (i === 5) ? (this.windSpeed >= windMin) : (this.windSpeed >= windMin && this.windSpeed <= windMax);
            let widthFits = (i === 5) ? (this.currentRealWorldWidthMiles >= widthMin) : (this.currentRealWorldWidthMiles >= widthMin && this.currentRealWorldWidthMiles <= widthMax);

            // If both wind and width fit the criteria for this EF rating, assign it.
            // Prioritize higher EF ratings.
            if (windFits && widthFits) {
                this.efRating = i;
                break; // Found the highest matching EF rating
            }
            // Special case for EF5: if wind is 201+ AND width is 1.0+, it's EF5
            if (i === 5 && this.windSpeed >= EF_WIND_RANGES[5].min && this.currentRealWorldWidthMiles >= EF_WIDTH_RANGES[5].min) {
                this.efRating = 5;
                break;
            }
            // If only wind speed or width matches a higher category, prioritize higher EF rating
            // This ensures the rating updates as soon as ONE factor reaches a higher category.
            if (windFits || widthFits) {
                this.efRating = Math.max(this.efRating, i); // Take the higher of existing or current category
            }
        }
        
        // Convert real-world miles to pixels for visualization using the global scale
        // The visual width (`this.width`) is a pixel representation of `currentRealWorldWidthMiles`.
        const targetWidthPx = this.currentRealWorldWidthMiles * PIXELS_PER_MILE_SCALE;
        this.width += (targetWidthPx - this.width) * 0.03 * simulationState.simSpeed;
        this.width = Math.max(0, this.width); 
        this.maxWidth = Math.max(this.maxWidth, this.width);

        // Estimate pressure drop (rough inverse relation to intensity/wind speed)
        this.pressureDrop = (this.windSpeed / EF_WIND_RANGES[5].max) * 40 + (this.windSpeed > EF_WIND_RANGES[0].min ? Math.random() * 5 : 0); // Only random variation if active
        this.vorticity = this.intensity; 
    }

    /**
     * Updates the tornado's position based on its direction, speed, and environmental steering.
     */
    updateMovement() {
        // Base movement influenced by overall storm motion
        const stormMotionX = Math.cos(this.direction) * this.speed;
        const stormMotionY = Math.sin(this.direction) * this.speed;
        
        // Add random path deviation (wobble) for realism
        const deviation = (Math.random() - 0.5) * 0.05 * simulationState.simSpeed;
        this.direction += deviation;
        
        // Influence from low-level jet (can pull tornadoes in a certain direction)
        const heightInfluence = (canvas.height - this.y) / canvas.height; // More influence if tornado is lower/closer
        const windInfluence = simulationState.lowLevelJet * 0.0005 * heightInfluence * simulationState.simSpeed;
        
        this.x += (stormMotionX + windInfluence) * simulationState.simSpeed;
        this.y += stormMotionY * simulationState.simSpeed;
        
        // Boundary handling: If hitting an edge, redirect inward
        let redirected = false;
        const edgeBuffer = 20; // Tornado must be within this many pixels from edge to consider redirection

        if (this.x < edgeBuffer) {
            this.x = edgeBuffer;
            // Point towards the center in X, with a random wobble
            this.direction = Math.atan2(Math.sin(this.direction), Math.abs(Math.cos(this.direction))); 
            redirected = true;
        } else if (this.x > canvas.width - edgeBuffer) {
            this.x = canvas.width - edgeBuffer;
            // Point towards the center in X, with a random wobble
            this.direction = Math.atan2(Math.sin(this.direction), -Math.abs(Math.cos(this.direction)));
            redirected = true;
        }

        if (this.y < edgeBuffer) {
            this.y = edgeBuffer;
            // Point towards the center in Y, with a random wobble
            this.direction = Math.atan2(Math.abs(Math.sin(this.direction)), Math.cos(this.direction)); 
            redirected = true;
        } else if (this.y > canvas.height - edgeBuffer) {
            this.y = canvas.height - edgeBuffer;
            // Point towards the center in Y, with a random wobble
            this.direction = Math.atan2(-Math.abs(Math.sin(this.direction)), Math.cos(this.direction));
            redirected = true;
        }

        if (redirected) {
            // Add some random deviation to the redirected path
            this.direction += (Math.random() - 0.5) * Math.PI * 0.4; // Add a significant random wobble +/- 36 degrees
            this.direction = (this.direction + 2 * Math.PI) % (2 * Math.PI); // Normalize angle to keep it within 0 and 2*PI
        }
    }

    /**
     * Records the tornado's path as it moves.
     */
    updatePath() {
        if (this.path.length > 0) {
            const lastPoint = this.path[this.path.length - 1];
            // Calculate distance moved since last path point
            // Only add point if sufficient distance is covered (to prevent excessively dense paths)
            const distancePixels = Math.sqrt(Math.pow(this.x - lastPoint.x, 2) + Math.pow(this.y - lastPoint.y, 2));
            
            if (distancePixels > 5) { // Add a new point to the path every 5 pixels of movement
                this.path.push({x: this.x, y: this.y, time: simulationState.time});
                // Convert pixel distance to "ratio miles" for pathLength update
                this.pathLength += distancePixels / PIXELS_PER_MILE_SCALE; 
            }
        }
    }

    /**
     * Updates the position and lifespan of debris particles.
     */
    updateDebris() {
        // Debris only updates if the tornado is active and debris visualization is enabled
        if (!this.isActive || !document.getElementById('showDebris').checked) return;

        this.debris.forEach(particle => {
            // Calculate force from tornado on debris
            const dx = particle.x - this.x;
            const dy = particle.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < this.width * 2) { // Debris within tornado's influence radius
                const force = (this.width * 2 - distance) / (this.width * 2) * (this.windSpeed / EF_WIND_RANGES[5].max); // Stronger force closer to center based on wind
                const angle = Math.atan2(dy, dx) + Math.PI * 0.5; // Perpendicular to center for rotational force
                particle.vx += Math.cos(angle) * force * 5 * simulationState.simSpeed;
                particle.vy += Math.sin(angle) * force * 5 * simulationState.simSpeed;
                particle.vy -= force * 2 * simulationState.simSpeed; // Upward suction force
            }
            
            // Apply physics to debris
            particle.x += particle.vx * simulationState.simSpeed;
            particle.y += particle.vy * simulationState.simSpeed;
            particle.vy += 0.1 * simulationState.simSpeed; // Gravity
            particle.vx *= 0.98; // Air resistance/damping
            particle.vy *= 0.98;
            particle.life--;
            
            // Respawn debris if its lifespan ends or it goes too far off-screen
            if (particle.life <= 0 || particle.y > canvas.height + 100 || particle.x < -100 || particle.x > canvas.width + 100) {
                particle.x = this.x + (Math.random() - 0.5) * this.width * 0.8; // Respawn near tornado
                particle.y = this.y + (Math.random() - 0.5) * this.width * 0.8;
                particle.vx = (Math.random() - 0.5) * 5;
                particle.vy = (Math.random() - 0.5) * 5;
                particle.life = Math.random() * 100 + 50; // Reset lifespan
                particle.size = DEBRIS_SIZES[Math.floor(Math.random() * DEBRIS_SIZES.length)]; // Reset size
            }
        });
    }

    /**
     * Draws the tornado funnel, condensation, debris, and damage path on the canvas.
     * Also draws a small label above the tornado.
     */
    draw() {
        // If tornado is inactive and has no fadeTimer or fadeTimer is zero or less, do not draw.
        // The filter in `animate` loop will remove it completely if fadeTimer is <= 0.
        if (!this.isActive && (this.fadeTimer === undefined || this.fadeTimer <= 0)) return; 

        // Calculate alpha based on fadeTimer if inactive
        let currentAlpha = Math.min(0.9, (this.windSpeed / EF_WIND_RANGES[5].max) * (this.phase === TORNADO_PHASES.DISSIPATING ? 0.5 : 1));
        if (!this.isActive && this.fadeTimer > 0) {
            currentAlpha *= (this.fadeTimer / DISSIPATING_DURATION_FRAMES); // Fade out over DISSIPATING_DURATION_FRAMES
        }
        if (currentAlpha <= 0) return; // Don't draw if fully transparent (will be removed next frame by filter)

        // Draw tornado funnel as a series of concentric, rotating circles
        const segments = 12; // Number of concentric rings
        
        for (let i = 0; i < segments; i++) {
            // Angle for rotation effect based on time and segment, plus unique offset
            const angle = (simulationState.time * 0.05 + i * Math.PI * 2 / segments) + this.rotationOffset;
            // Radius decreases with height (i) and fluctuates with tornado 'breathing'
            const radius = this.width * (1 - i * 0.08) * (0.8 + Math.sin(this.age * 0.02) * 0.2);
            // Ensure radius is never negative before passing to arc()
            const safeRadius = Math.max(0, radius); 

            const segmentAlpha = currentAlpha * (1 - i * 0.1); // Alpha decreases with height
            
            ctx.strokeStyle = `rgba(120, 120, 120, ${segmentAlpha})`; // Greyish funnel color
            ctx.lineWidth = Math.max(1, safeRadius * 0.1); // Line width proportional to radius
            
            ctx.beginPath();
            // Fix: Ensure radius passed to arc is always non-negative
            ctx.arc(this.x, this.y, safeRadius, angle, angle + Math.PI * 2 / segments); // Draw arc segment
            ctx.stroke();
        }

        // Draw condensation funnel (the visible cloud tube)
        ctx.strokeStyle = `rgba(200, 200, 200, ${currentAlpha * 0.6})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - this.width * 0.5); // Start slightly above ground
        ctx.lineTo(this.x, Math.max(0, this.y - this.width * (1 + (this.windSpeed / EF_WIND_RANGES[5].max) * 10))); // Extend upwards based on wind speed
        ctx.stroke();

        // Draw debris field (dirt brown particles)
        if (document.getElementById('showDebris').checked) {
            this.debris.forEach(particle => {
                const particleAlpha = (particle.life / 100) * currentAlpha * 0.8; // Fade out as life decreases, also affected by tornado fade
                ctx.fillStyle = `rgba(139, 69, 19, ${particleAlpha})`; // Dirt brown color
                ctx.beginPath();
                ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
                ctx.fill();
            });
        }

        // Draw damage path (red dashed line)
        if (document.getElementById('showTornadoPath').checked && this.path.length > 1) {
            ctx.strokeStyle = `rgba(255, 100, 100, ${currentAlpha * 0.4})`; // Light red, affected by tornado fade
            ctx.lineWidth = Math.max(2, this.maxWidth * 0.1); // Path width based on max tornado width
            ctx.beginPath();
            ctx.moveTo(this.path[0].x, this.path[0].y);
            for (let i = 1; i < this.path.length; i++) {
                ctx.lineTo(this.path[i].x, this.path[i].y);
            }
            ctx.stroke();
        }

        // Draw tornado label
        ctx.fillStyle = `rgba(255, 255, 255, ${currentAlpha * 1.0})`; // White label text
        ctx.font = '9px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        // Display only the last 4 digits of the ID for brevity
        const labelText = `Tornado .${this.id.toString().slice(-4)}`;
        ctx.fillText(labelText, this.x, this.y - this.width - 5); // Position above the tornado
    }
}

/**
 * Represents a storm cell (thunderstorm) that can potentially spawn a tornado.
 */
class StormCell {
    constructor(x, y, isSupercell = false) { // Added isSupercell parameter
        this.x = x;                             // X coordinate
        this.y = y;                             // Y coordinate
        this.isSupercell = isSupercell;
        // Influence intensity and size based on CAPE at creation
        const cape = calculateCAPE();

        // Normalize CAPE influence (0 to 1) for the requested range of 0-5000 J/kg
        const capeInfluence = Math.min(1, Math.max(0, (cape - MIN_CAPE) / (MAX_CAPE - MIN_CAPE)));

        this.intensity = isSupercell ? (0.7 + capeInfluence * 0.3) : (0.3 + capeInfluence * 0.4); // Higher initial intensity for supercells, influenced by CAPE
        this.size = isSupercell ? (60 + capeInfluence * 80) : (30 + capeInfluence * 50); // Larger size for supercells, influenced by CAPE
        this.rotation = 0;                      // Visual rotation of the storm
        this.age = 0;                           // Age in simulation frames
        this.lifespan = isSupercell ? (1800 + Math.random() * 1200) : (600 + Math.random() * 1200); // Longer lifespan for supercells
        this.hasTornado = false;                // Does this storm currently have a tornado?
        this.tornadoSpawned = false;            // Has this storm ever spawned a tornado?
        simulationState.lastStormActivityTime = simulationState.time; // Update activity time
        this.detailLevel = 0.5 + Math.random() * 0.5; // For varying cloud detail
    }

    /**
     * Updates the storm cell's state for the current frame.
     */
    update() {
        this.age++;
        this.rotation += 0.02 * this.intensity * simulationState.simSpeed; // Rotate faster with intensity
        
        // Ensure every storm cell produces a tornado after a short delay
        if (!this.tornadoSpawned && !this.hasTornado && this.age > 120) { // After 2 seconds (120 frames)
            this.spawnTornado();
        }
        
        // Storm decay: gradually weakens after its prime lifespan
        if (this.age > this.lifespan) {
            this.intensity *= 0.99; // Gradual decay
        }

        // If the storm is active, update last activity time
        if (this.intensity > 0.01) {
            simulationState.lastStormActivityTime = simulationState.time;
        }
    }

    /**
     * Spawns a new Tornado object at the storm cell's location.
     */
    spawnTornado() {
        // Pass storm size as an influence factor for tornado initial width
        // The `size` of the supercell directly influences the initial width and intensity of the tornado.
        const sizeInfluence = this.size / PIXELS_PER_MILE_SCALE; // Normalize storm size relative to 1 "ratio mile"
        const tornado = new Tornado(this.x, this.y, sizeInfluence);
        simulationState.tornadoes.push(tornado); // Add to active tornadoes list
        simulationState.statistics.totalTornadoes++; // Increment total count
        this.tornadoSpawned = true; // Mark storm as having spawned a tornado
        this.hasTornado = true;     // Mark storm as currently having a tornado (for radar)
        
        // Create an alert message in the UI
        createAlert('TORNADO WARNING', `Tornado touchdown detected! ID: ${tornado.id.toString().slice(-4)}`, 'severe');
        simulationState.lastStormActivityTime = simulationState.time; // Update activity time
    }

    /**
     * Draws the storm cell on the canvas with a more realistic cloud shape.
     */
    draw() {
        const alpha = this.intensity * 0.7; // Overall transparency
        if (alpha <= 0.01) return; // Don't draw if too faint

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation); // Rotate the entire storm

        // Base storm shape (darker gray)
        ctx.fillStyle = `rgba(80, 80, 80, ${alpha})`;
        ctx.beginPath();
        // Use multiple arcs to create an irregular, cloud-like shape
        const segments = 10 + Math.floor(this.detailLevel * 5); // More segments for more detail
        const baseRadius = this.size * (0.8 + Math.sin(this.age * 0.01) * 0.1); // Pulsating effect
        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const fluctuation = (Math.sin(this.age * 0.02 + i * 0.5) * 0.2 + Math.random() * 0.1) * baseRadius;
            const currentRadius = baseRadius + fluctuation;
            if (i === 0) {
                ctx.moveTo(Math.cos(angle) * currentRadius, Math.sin(angle) * currentRadius);
            } else {
                ctx.lineTo(Math.cos(angle) * currentRadius, Math.sin(angle) * currentRadius);
            }
        }
        ctx.closePath();
        ctx.fill();

        // Lighter areas within the storm for detail (light gray)
        ctx.fillStyle = `rgba(150, 150, 150, ${alpha * 0.6})`;
        ctx.beginPath();
        const innerRadius1 = this.size * 0.4 * (0.8 + Math.sin(this.age * 0.03) * 0.2);
        ctx.arc(this.size * 0.2, this.size * 0.1, innerRadius1, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(120, 120, 120, ${alpha * 0.7})`;
        ctx.beginPath();
        const innerRadius2 = this.size * 0.3 * (0.8 + Math.cos(this.age * 0.025) * 0.2);
        ctx.arc(-this.size * 0.1, -this.size * 0.2, innerRadius2, 0, Math.PI * 2);
        ctx.fill();

        // Darker areas within the storm for depth (darker gray)
        ctx.fillStyle = `rgba(50, 50, 50, ${alpha * 0.8})`;
        ctx.beginPath();
        const darkSpotRadius = this.size * 0.2 * (0.8 + Math.sin(this.age * 0.015) * 0.2);
        ctx.arc(-this.size * 0.3, this.size * 0.2, darkSpotRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // Draw rotation indicator (line within the storm), not rotated with the storm for clarity
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        const rotX = this.x + Math.cos(this.rotation) * this.size * 0.7;
        const rotY = this.y + Math.sin(this.rotation) * this.size * 0.7;
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(rotX, rotY);
        ctx.stroke();
    }
}

/**
 * Represents a small weather probe launched to gather data from a tornado.
 */
class Probe {
    constructor(startX, startY, targetTornadoId) {
        this.x = startX;
        this.y = startY;
        this.targetTornadoId = targetTornadoId;
        this.speed = 10; // Pixels per frame
        this.isActive = true;
        this.intercepted = false;
        this.displayDataTimer = 0; // Timer for how long data is shown
    }

    update() {
        if (!this.isActive || this.intercepted) return;

        // Find the target tornado
        // Check if tornado is active OR fading, so probe can still head towards it during fade
        const targetTornado = simulationState.tornadoes.find(t => t.id === this.targetTornadoId && (t.isActive || (t.fadeTimer !== undefined && t.fadeTimer > 0)));

        // If target tornado is gone (or never found), make probe dissipate
        // Check if tornado is fully inactive (not active and fadeTimer <= 0)
        if (!targetTornado || (!targetTornado.isActive && (targetTornado.fadeTimer === undefined || targetTornado.fadeTimer <= 0))) {
            this.isActive = false;
            clearProbeData();
            // Only re-enable launch probe button if not in auto-run mode
            if (!simulationState.autoRun) {
                document.getElementById('launchProbeBtn').disabled = false;
            }
            return;
        } else if (!targetTornado.isActive && targetTornado.fadeTimer > 0) {
            // If target tornado is fading out, probe should also become inactive.
            // It can't collect meaningful data from a dissipating tornado.
            this.isActive = false; 
            clearProbeData();
            if (!simulationState.autoRun) {
                document.getElementById('launchProbeBtn').disabled = false;
            }
            return;
        }

        // Move towards the target tornado
        const dx = targetTornado.x - this.x;
        const dy = targetTornado.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < targetTornado.width * 0.8) { // Intercepted if within tornado's core radius
            this.intercepted = true;
            this.displayDataTimer = 180; // Show data for 3 seconds (180 frames)
            this.sendData(targetTornado); // Transmit data
        } else {
            // Normalize direction vector and move
            const angle = Math.atan2(dy, dx);
            this.x += Math.cos(angle) * this.speed * simulationState.simSpeed;
            this.y += Math.sin(angle) * this.speed * simulationState.simSpeed;
        }
    }

    draw() {
        if (!this.isActive || this.intercepted) return; // Don't draw if intercepted or inactive

        ctx.fillStyle = '#FFEB3B'; // Yellow color for the probe
        ctx.beginPath();
        ctx.arc(this.x, this.y, 5, 0, Math.PI * 2); // Small circle for the probe
        ctx.fill();

        // Draw a small triangle pointing towards the tornado
        const targetTornado = simulationState.tornadoes.find(t => t.id === this.targetTornadoId && t.isActive); // Only draw if target is still active
        if (targetTornado) {
            const angleToTarget = Math.atan2(targetTornado.y - this.y, targetTornado.x - this.x);
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(angleToTarget);
            ctx.beginPath();
            ctx.moveTo(5, 0); // Point
            ctx.lineTo(-5, -3);
            ctx.lineTo(-5, 3);
            ctx.closePath();
            ctx.fillStyle = '#FFEB3B';
            ctx.fill();
            ctx.restore();
        }
    }

    sendData(tornado) {
        // Simulate data collection based on tornado's properties
        document.getElementById('probeStatus').textContent = `Probe ${tornado.id.toString().slice(-4)} Intercepted!`;
        document.getElementById('probeWind').textContent = `Wind Speed: ${tornado.windSpeed.toFixed(0)} mph`;
        document.getElementById('probePressure').textContent = `Pressure Drop: ${tornado.pressureDrop.toFixed(1)} hPa`;
        // Example: max debris velocity related to wind speed
        document.getElementById('probeDebris').textContent = `Max Debris Velocity: ${(tornado.windSpeed * 0.3 + Math.random() * 20).toFixed(0)} mph`;
        createAlert('PROBE DATA', `Probe ${tornado.id.toString().slice(-4)} transmitted critical data!`, 'success');
    }
}

/**
 * Represents an intercept team (e.g., TIV, Dominator).
 * Handles movement, deployment, wind thresholds, and return to base.
 */
class InterceptTeam {
    constructor(teamId, targetTornadoId) {
        this.id = teamId;
        this.teamData = INTERCEPT_TEAMS_DATA[teamId];
        this.x = this.teamData.baseLocation.x;
        this.y = this.teamData.baseLocation.y;
        this.targetTornadoId = targetTornadoId;
        this.targetTornado = null; // Will be set in update
        this.state = 'EN_ROUTE'; // IDLE, EN_ROUTE, DEPLOYING, DEPLOYED, LOFTED, RETURNING
        this.isActive = true; // Is the team currently in the simulation
        this.isDeployed = false;
        this.deploymentTimer = 0; // For deployment animation/delay
        this.currentWindSpeed = 0; // Wind speed experienced by the team
        this.deploymentX = 0; // Fixed X position where team deploys
        this.deploymentY = 0; // Fixed Y position where team deploys
        this.initialDeployPositionSet = false; // Flag to ensure deployment position is set once
        
        // Properties for lofted animation
        this.loftVx = 0;
        this.loftVy = 0;
        this.loftRotationSpeed = 0;
        this.loftRotation = 0;
    }

    update() {
        if (!this.isActive) return;

        // Always try to find the target tornado
        // Consider a tornado still relevant for a returning team even if it's inactive but fading
        this.targetTornado = simulationState.tornadoes.find(t => t.id === this.targetTornadoId && (t.isActive || (t.fadeTimer !== undefined && t.fadeTimer > 0)));

        // If target tornado is gone (or never found), automatically transition to RETURNING state
        if (!this.targetTornado || (!this.targetTornado.isActive && (this.targetTornado.fadeTimer === undefined || this.targetTornado.fadeTimer <= 0))) {
            if (this.state !== 'RETURNING' && this.state !== 'LOFTED') { // Only alert if not already returning or lofted
                createAlert('Team Update', `${this.teamData.name} returning to base (Tornado dissipated or not found).`, 'success');
            }
            this.state = 'RETURNING';
            this.targetTornadoId = null;
            this.isDeployed = false; // Undeploy if tornado vanishes
        } else if (this.targetTornado) {
            // Current wind speed is read from the tornado's properties
            // We can estimate wind speed at vehicle's precise location relative to tornado center
            // For simplicity, let's assume team is always near tornado center for wind speed reading,
            // or for deployed teams, they are at the 'deploymentX/Y' and feel that wind.
            // For now, let's use the tornado's max wind speed as the 'experienced' wind speed.
            this.currentWindSpeed = this.targetTornado.windSpeed; 
        }

        switch (this.state) {
            case 'EN_ROUTE':
                if (this.targetTornado && this.targetTornado.isActive) { // Only move if target is still active
                    // Calculate tornado's predicted position (slightly ahead)
                    const predictionTime = 60 * 3; // Predict 3 seconds ahead (180 frames)
                    const predictedTornadoX = this.targetTornado.x + Math.cos(this.targetTornado.direction) * this.targetTornado.speed * predictionTime;
                    const predictedTornadoY = this.targetTornado.y + Math.sin(this.targetTornado.direction) * this.targetTornado.speed * predictionTime;

                    // Determine an intercept point directly in the tornado's projected path, a bit ahead
                    const interceptDistanceInFront = this.targetTornado.width * 0.8; // Target very close to the edge of the tornado
                    const targetX = predictedTornadoX + Math.cos(this.targetTornado.direction) * interceptDistanceInFront;
                    const targetY = predictedTornadoY + Math.sin(this.targetTornado.direction) * interceptDistanceInFront;
                    
                    const dx_move = targetX - this.x;
                    const dy_move = targetY - this.y;
                    const distanceToInterceptPoint = Math.sqrt(dx_move * dx_move + dy_move * dy_move);

                    // Deployment logic: once close enough to the *intercept point*, deploy.
                    const deploymentProximity = this.teamData.speed * 1; // Deploy within 1 frame of movement to be precise

                    if (distanceToInterceptPoint <= deploymentProximity) {
                        this.state = 'DEPLOYING';
                        this.deploymentTimer = 60; // 1 second (60 frames) to deploy
                        // Set the exact deployment spot to the current location, where they stopped
                        this.deploymentX = this.x; 
                        this.deploymentY = this.y;
                        this.initialDeployPositionSet = true; // Lock the deployment position
                    } else {
                        // Keep moving towards the intercept point
                        const angle = Math.atan2(dy_move, dx_move);
                        this.x += Math.cos(angle) * this.teamData.speed * simulationState.simSpeed;
                        this.y += Math.sin(angle) * this.teamData.speed * simulationState.simSpeed;

                        // Check for lofting even when en route if winds are too high for undeployed state
                        if (this.currentWindSpeed >= this.teamData.undeployedWindThreshold) {
                            this.state = 'LOFTED';
                            this.isDeployed = false;
                            this.loftVx = (Math.random() - 0.5) * 15;
                            this.loftVy = -15 + (Math.random() * -10); 
                            this.loftRotationSpeed = (Math.random() - 0.5) * 0.5;
                            createAlert('Team Critical', `${this.teamData.name} LOFTED while en route! Winds: ${this.currentWindSpeed.toFixed(0)} mph`, 'severe');
                            if (this.targetTornado) { 
                                this.targetTornado.lastLoftedTime = simulationState.time;
                            }
                        }
                    }
                }
                break;

            case 'DEPLOYING':
                // Team is stationary at its deployment spot
                this.x = this.deploymentX;
                this.y = this.deploymentY;

                this.deploymentTimer -= simulationState.simSpeed;
                if (this.deploymentTimer <= 0) {
                    this.isDeployed = true;
                    this.state = 'DEPLOYED';
                    createAlert('Team Update', `${this.teamData.name} successfully deployed at Tornado ${this.targetTornado.id.toString().slice(-4)}!`, 'success');
                } else if (this.currentWindSpeed >= this.teamData.undeployedWindThreshold) {
                     // Can still be lofted during deployment if winds suddenly increase (threshold is undeployed)
                    this.state = 'LOFTED';
                    this.isDeployed = false;
                    this.loftVx = (Math.random() - 0.5) * 15;
                    this.loftVy = -15 + (Math.random() * -10); 
                    this.loftRotationSpeed = (Math.random() - 0.5) * 0.5;
                    createAlert('Team Critical', `${this.teamData.name} LOFTED during deployment! Winds: ${this.currentWindSpeed.toFixed(0)} mph`, 'severe');
                    if (this.targetTornado) { 
                        this.targetTornado.lastLoftedTime = simulationState.time;
                    }
                }
                break;

            case 'DEPLOYED':
                // Team remains stationary at the `deploymentX`, `deploymentY`
                this.x = this.deploymentX;
                this.y = this.deploymentY;

                // Check if wind threshold exceeded while deployed
                if (this.currentWindSpeed >= this.teamData.deployedWindThreshold) {
                    this.state = 'LOFTED';
                    this.isDeployed = false;
                    this.loftVx = (Math.random() - 0.5) * 15;
                    this.loftVy = -15 + (Math.random() * -10);
                    this.loftRotationSpeed = (Math.random() - 0.5) * 0.5;
                    createAlert('Team Critical', `${this.teamData.name} LOFTED from Tornado ${this.targetTornado.id.toString().slice(-4)}! Winds: ${this.currentWindSpeed.toFixed(0)} mph`, 'severe');
                    if (this.targetTornado) { 
                        this.targetTornado.lastLoftedTime = simulationState.time;
                    }
                }
                break;
            
            case 'LOFTED':
                // Apply lofting physics
                this.x += this.loftVx * simulationState.simSpeed;
                this.y += this.loftVy * simulationState.simSpeed;
                this.loftVy += 0.5 * simulationState.simSpeed; // Gravity effect pulling it back down
                this.loftVx *= 0.98; // Air resistance / damping
                this.loftVy *= 0.98;
                this.loftRotation += this.loftRotationSpeed * simulationState.simSpeed; // Apply rotation

                // Deactivate once off screen
                if (this.y > canvas.height + 100 || this.y < -100 || this.x > canvas.width + 100 || this.x < -100) {
                    this.isActive = false; // Off screen, effectively lost
                }
                break;
            
            case 'RETURNING':
                // Move back to base location
                const baseDx = this.teamData.baseLocation.x - this.x;
                const baseDy = this.teamData.baseLocation.y - this.y;
                const baseDistance = Math.sqrt(baseDx * baseDx + baseDy * baseDy);

                if (baseDistance < this.teamData.speed * simulationState.simSpeed) { // Reached base
                    this.x = this.teamData.baseLocation.x;
                    this.y = this.teamData.baseLocation.y;
                    this.isActive = false; // Team is now available and not active in simulation
                    // Add team back to pool if it successfully returned
                    simulationState.teamPool[this.id].currentCount = Math.min(simulationState.teamPool[this.id].maxCount, simulationState.teamPool[this.id].currentCount + 1);
                    createAlert('Team Update', `${this.teamData.name} has returned to base and is available.`, 'success');
                } else {
                    const angle = Math.atan2(baseDy, baseDx);
                    this.x += Math.cos(angle) * this.teamData.speed * simulationState.simSpeed;
                    this.y += Math.sin(angle) * this.teamData.speed * simulationState.simSpeed;
                }
                break;
        }
    }

    draw() {
        // Only draw if the team is active OR in the 'RETURNING' state (so it can be seen moving back)
        if (!this.isActive && this.state !== 'RETURNING' && this.state !== 'LOFTED') return;

        // Make lofted teams blink for visual effect
        if (this.state === 'LOFTED' && !((Math.floor(simulationState.time / 5) % 2) === 0)) return; // Blink every ~5 frames

        ctx.fillStyle = this.isDeployed ? this.teamData.deployedColor : this.teamData.color;
        
        ctx.save(); // Save context before applying rotation for lofted state
        if (this.state === 'LOFTED') {
            ctx.translate(this.x, this.y);
            ctx.rotate(this.loftRotation);
            ctx.beginPath();
            ctx.arc(0, 0, 8, 0, Math.PI * 2); // Draw at (0,0) relative to translated context
            ctx.fill();
            ctx.restore(); // Restore context
        } else {
            // Draw normally (not lofted)
            ctx.beginPath();
            ctx.arc(this.x, this.y, 8, 0, Math.PI * 2); // Circle for vehicle
            ctx.fill();

            // Draw a small arrow indicating direction if moving (en route or returning)
            if (this.state === 'EN_ROUTE' || this.state === 'RETURNING') {
                let targetX = this.x;
                let targetY = this.y;
                if (this.targetTornado && !this.isDeployed) { // If still has a live tornado target (for EN_ROUTE)
                    // Use predicted target for arrow direction (same as in update logic)
                    const lookAheadFrames = 90; 
                    targetX = this.targetTornado.x + Math.cos(this.targetTornado.direction) * this.targetTornado.speed * lookAheadFrames; 
                    targetY = this.targetTornado.y + Math.sin(this.targetTornado.direction) * this.targetTornado.speed * lookAheadFrames;
                } else { // If returning to base or already deployed, point towards base
                    targetX = this.teamData.baseLocation.x;
                    targetY = this.teamData.baseLocation.y;
                }

                const angle = Math.atan2(targetY - this.y, targetX - this.x);

                ctx.save();
                ctx.translate(this.x, this.y);
                ctx.rotate(angle);
                ctx.beginPath();
                ctx.moveTo(8, 0); // Point
                ctx.lineTo(-4, -4);
                ctx.lineTo(-4, 4);
                ctx.closePath();
                ctx.fillStyle = 'white';
                ctx.fill();
                ctx.restore();
            }

            // If deployed, draw a small deployed indicator (cross)
            if (this.isDeployed) {
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(this.x - 10, this.y);
                ctx.lineTo(this.x + 10, this.y);
                ctx.moveTo(this.x, this.y - 10);
                ctx.lineTo(this.x, this.y + 10);
                ctx.stroke();
            }
        }
    }
}


// --- Atmospheric Calculation Functions (Simplified for simulation) ---

/**
 * The current actual CAPE value, taking into account transition.
 * CAPE remains constant during a tornado's life, then transitions to a new random value
 * once the tornado dissipates.
 * @returns {number} Current CAPE value in J/kg.
 */
function calculateCAPE() {
    if (simulationState.isCAPERandomizing) {
        const elapsedFrames = simulationState.time - simulationState.capeTransitionStartTime;
        const progress = Math.min(1, elapsedFrames / simulationState.capeTransitionDuration);
        // Linear interpolation for smooth transition
        const currentCAPE = simulationState.initialCAPEDuringTransition + 
                             (simulationState.targetCAPE - simulationState.initialCAPEDuringTransition) * progress;
        
        if (progress >= 1) {
            simulationState.isCAPERandomizing = false;
            // Once transition is complete, ensure the CAPE value stabilizes at the target.
            // The flag prevents repeated randomization calls until the next tornado dissipates.
            return simulationState.targetCAPE; 
        }
        return currentCAPE;
    } else {
        // When not actively transitioning, return the stable target CAPE value.
        return simulationState.targetCAPE;
    }
}

/**
 * Initiates a CAPE randomization and smooth transition.
 * This function is called when a tornado fully dissipates, ensuring CAPE changes
 * only after each tornado's lifecycle.
 */
function randomizeCAPE() {
    // Get current CAPE to start transition from
    simulationState.initialCAPEDuringTransition = calculateCAPE();
    // Generate new random target CAPE within the allowed range (0-5000 J/kg)
    let newTargetCAPE = MIN_CAPE + Math.random() * (MAX_CAPE - MIN_CAPE);
    // Ensure the new CAPE is sufficiently different from the current one to be noticeable
    while (Math.abs(newTargetCAPE - simulationState.initialCAPEDuringTransition) < (MAX_CAPE - MIN_CAPE) * 0.1) { // Ensure at least 10% change
        newTargetCAPE = MIN_CAPE + Math.random() * (MAX_CAPE - MIN_CAPE);
    }

    simulationState.targetCAPE = newTargetCAPE;
    simulationState.capeTransitionStartTime = simulationState.time;
    simulationState.isCAPERandomizing = true;
    createAlert('CAPE Fluctuation', `Atmospheric CAPE is now changing to ${simulationState.targetCAPE.toFixed(0)} J/kg.`, 'info');
}

/**
 * Calculates Storm-Relative Helicity (SRH).
 * Measures the potential for a storm's updraft to acquire rotation.
 * @returns {number} Helicity value in m²/s².
 */
function calculateHelicity() {
    const shear = simulationState.windShear;
    const jetStrength = simulationState.lowLevelJet;
    return shear * jetStrength * 2; // Directly proportional to shear and low-level jet strength
}

/**
 * Calculates Bulk Shear (0-6km).
 * Represents the change in wind between the surface and 6km altitude.
 * @returns {number} Bulk shear value in m/s.
 */
function calculateBulkShear() {
    return simulationState.windShear * 3.5; // Approximation based on wind shear slider
}

/**
 * Calculates the Supercell Composite Parameter.
 * A composite index indicating the likelihood of supercell formation.
 * @returns {number} Supercell Composite value.
 */
function calculateSupercellComposite() {
    const cape = calculateCAPE(); // Use current CAPE
    const shear = calculateBulkShear();
    // Combination of CAPE and shear, capped at 20 for reasonable range
    // Adjust CAPE scaling for new range: (cape / (MAX_CAPE / 5)) instead of (cape / 1000) for more normalized scaling.
    return Math.min(20, (cape / (MAX_CAPE / 5)) * (shear / 20) * 4); // Divided by 5 to keep influence similar given new max CAPE
}

/**
 * Calculates the Significant Tornado Parameter (STP).
 * An index used to identify environments favorable for significant tornadoes (EF2+).
 * @returns {number} STP value.
 */
function calculateSTP() {
    const cape = calculateCAPE(); // Use current CAPE
    const helicity = calculateHelicity();
    const shear = calculateBulkShear();
    // A more complex combination, values typically range from 0-8 for significant tornadoes
    // Adjust CAPE scaling for new range: (cape / (MAX_CAPE / 3.33)) instead of (cape / 1500)
    return Math.min(8, (cape / (MAX_CAPE / 3.33)) * (helicity / 150) * (shear / 20) * 0.7); // Divided by 3.33 to keep influence similar
}

/**
 * Calculates the Energy Helicity Index (EHI).
 * Combines CAPE and Helicity, reflecting potential for rotating storms.
 * @returns {number} EHI value.
 */
function calculateEHI() {
    const cape = calculateCAPE(); // Use current CAPE
    const helicity = calculateHelicity();
    // Adjust CAPE scaling for new range: (cape / (MAX_CAPE * 0.2)) instead of (cape / 1000)
    return Math.min(5, (cape / (MAX_CAPE / 5)) * (helicity / 100) * 0.5); // Divided by 5 to keep influence similar
}

// --- UI Update Functions ---

/**
 * Updates the text display next to each slider to show its current value.
 */
function updateSliderDisplays() {
    // Read current values from all slider inputs and update simulationState
    // Convert Fahrenheit to Celsius for internal calculations
    simulationState.surfaceTemp = fahrenheitToCelsius(parseFloat(document.getElementById('surfaceTemp').value));
    simulationState.upperTemp = fahrenheitToCelsius(parseFloat(document.getElementById('upperTemp').value));
    simulationState.humidity = parseFloat(document.getElementById('humidity').value);
    simulationState.windShear = parseFloat(document.getElementById('windShear').value);
    simulationState.surfacePressure = parseFloat(document.getElementById('surfacePressure').value);
    simulationState.stormMotion = parseFloat(document.getElementById('stormMotion').value);
    simulationState.lowLevelJet = parseFloat(document.getElementById('lowLevelJet').value);
    simulationState.simSpeed = parseFloat(document.getElementById('simSpeed').value);

    document.getElementById('surfaceTempValue').textContent = `${celsiusToFahrenheit(simulationState.surfaceTemp).toFixed(0)}°F`;
    document.getElementById('upperTempValue').textContent = `${celsiusToFahrenheit(simulationState.upperTemp).toFixed(0)}°F`;
    document.getElementById('humidityValue').textContent = `${simulationState.humidity}%`;
    document.getElementById('windShearValue').textContent = `${simulationState.windShear} m/s/km`;
    document.getElementById('surfacePressureValue').textContent = `${simulationState.surfacePressure} hPa`;
    document.getElementById('stormMotionValue').textContent = `${simulationState.stormMotion} mph`;
    document.getElementById('lowLevelJetValue').textContent = `${simulationState.lowLevelJet} m/s`;
    document.getElementById('simSpeedValue').textContent = `${simulationState.simSpeed}x`;
}

/**
 * Converts an angle in radians to a cardinal/intercardinal compass direction string.
 * 0 = North (up), 0.5PI = East (right), PI = South (down), 1.5PI = West (left).
 * @param {number} angleRad - The angle in radians.
 * @returns {string} The compass direction (N, NE, E, SE, S, SW, W, NW).
 */
function getCompassDirection(angleRad) {
    // Normalize angle to be between 0 and 2*PI
    let normalizedAngle = (angleRad + 2 * Math.PI) % (2 * Math.PI);

    // Convert to degrees, rotating so 0 degrees is North (up)
    // A standard Cartesian angle (0 right, increases counter-clockwise) needs adjustment.
    // Math.atan2(dy, dx) returns angle where dy is positive downwards (South).
    // North is -90deg or 270deg. East is 0deg. South is 90deg. West is 180deg.
    // To align with compass directions (0deg North, 90deg East, 180deg South, 270deg West):
    let angleDeg = normalizedAngle * 180 / Math.PI;
    angleDeg = (angleDeg + 90 + 360) % 360; // Rotate 90 degrees clockwise and ensure positive

    if (angleDeg >= 337.5 || angleDeg < 22.5) return "N";
    if (angleDeg >= 22.5 && angleDeg < 67.5) return "NE";
    if (angleDeg >= 67.5 && angleDeg < 112.5) return "E";
    if (angleDeg >= 112.5 && angleDeg < 157.5) return "SE";
    if (angleDeg >= 157.5 && angleDeg < 202.5) return "S";
    if (angleDeg >= 202.5 && angleDeg < 247.5) return "SW";
    if (angleDeg >= 247.5 && angleDeg < 292.5) return "W";
    if (angleDeg >= 292.5 && angleDeg < 337.5) return "NW";
    return "N/A";
}

/**
 * Updates the data panel with current atmospheric conditions, tornado lists, and storm statistics.
 */
function updateDataPanel() {
    // Update Current Conditions
    document.getElementById('capeValue').textContent = `${calculateCAPE().toFixed(0)} J/kg`;
    document.getElementById('helicityValue').textContent = `${calculateHelicity().toFixed(0)} m²/s²`;
    document.getElementById('bulkShearValue').textContent = `${calculateBulkShear().toFixed(1)} m/s`;
    document.getElementById('supercellValue').textContent = `${calculateSupercellComposite().toFixed(2)}`;
    document.getElementById('stpValue').textContent = `${calculateSTP().toFixed(2)}`;
    document.getElementById('ehiValue').textContent = `${calculateEHI().toFixed(2)}`;

    // Update Storm Statistics
    document.getElementById('totalTornadoes').textContent = simulationState.statistics.totalTornadoes;
    document.getElementById('activeStorms').textContent = simulationState.storms.filter(s => s.intensity > 0.01).length;
    document.getElementById('peakIntensity').textContent = EF_RATINGS[simulationState.statistics.peakIntensity];
    // Longest track stat removed from here

    // Update Active Tornadoes list
    const tornadoListDiv = document.getElementById('tornadoList');
    tornadoListDiv.innerHTML = ''; // Clear previous list
    // Only list tornadoes that are active or still in the fading process for a brief period
    const activeTornadoesForList = simulationState.tornadoes.filter(t => t.isActive || (t.fadeTimer !== undefined && t.fadeTimer > 0));
    if (activeTornadoesForList.length === 0) {
        tornadoListDiv.innerHTML = '<div style="font-size: 12px; color: #b0bec5;">No active tornadoes.</div>';
    } else {
        activeTornadoesForList.forEach(tornado => {
            const tornadoDiv = document.createElement('div');
            tornadoDiv.className = 'data-item';
            let statusText = `${EF_RATINGS[tornado.efRating]} (${tornado.phase})`;
            if (!tornado.isActive) {
                statusText = `Dissipated (${(tornado.fadeTimer / 60).toFixed(1)}s left)`; // Show fade time if dissipating
            }
            tornadoDiv.innerHTML = `
                <span class="data-label">Tornado ${tornado.id.toString().slice(-4)}</span>
                <span class="data-value">${statusText} ${tornado.windSpeed.toFixed(0)} mph</span>
            `;
            tornadoListDiv.appendChild(tornadoDiv);
        });
    }

    // Update detailed tornado info panel
    const activeTornadoes = simulationState.tornadoes.filter(t => t.isActive);
    const tornadoInfoPanel = document.getElementById('tornadoInfo');
    const tornadoInfoTitle = document.getElementById('tornadoInfoTitle');
    const prevTornadoBtn = document.getElementById('prevTornadoBtn');
    const nextTornadoBtn = document.getElementById('nextTornadoBtn');

    if (activeTornadoes.length > 0) {
        tornadoInfoPanel.style.display = 'block';
        // Ensure index is within bounds, looping if necessary
        simulationState.activeTornadoDisplayIndex = simulationState.activeTornadoDisplayIndex % activeTornadoes.length;
        if (simulationState.activeTornadoDisplayIndex < 0) {
            simulationState.activeTornadoDisplayIndex = activeTornadoes.length - 1;
        }

        const displayTornado = activeTornadoes[simulationState.activeTornadoDisplayIndex];

        tornadoInfoTitle.textContent = `Tornado .${displayTornado.id.toString().slice(-4)}`;
        document.getElementById('tornadoStatus').textContent = displayTornado.phase;
        document.getElementById('tornadoDuration').textContent = `${(displayTornado.age / 60).toFixed(1)}s`; // Convert frames to seconds
        document.getElementById('pathLength').textContent = `${displayTornado.pathLength.toFixed(2)} mi`;
        document.getElementById('currentWidth').textContent = `${(displayTornado.currentRealWorldWidthMiles).toFixed(1)} mi`; 
        
        document.getElementById('damageRating').textContent = EF_RATINGS[displayTornado.efRating];
        document.getElementById('tornadoWindSpeed').textContent = `${displayTornado.windSpeed.toFixed(0)} mph`; // Display actual wind speed
        document.getElementById('tornadoDirection').textContent = getCompassDirection(displayTornado.direction); // Display tornado direction

        // Enable/disable navigation buttons based on number of active tornadoes
        prevTornadoBtn.disabled = activeTornadoes.length <= 1;
        nextTornadoBtn.disabled = activeTornadoes.length <= 1;

    } else {
        tornadoInfoPanel.style.display = 'none'; // Hide if no active tornadoes
        simulationState.activeTornadoDisplayIndex = 0; // Reset index when no tornadoes
        prevTornadoBtn.disabled = true;
        nextTornadoBtn.disabled = true;
    }

    // Update Intercept Team Status
    const interceptTeamStatusDiv = document.getElementById('interceptTeamStatus');
    interceptTeamStatusDiv.innerHTML = ''; // Clear previous list
    // Only show teams that are active (deployed, en route, lofted)
    // Teams that are 'RETURNING' are no longer considered 'out' and are removed from this display.
    const teamsToShow = simulationState.interceptTeams.filter(t => t.isActive && t.state !== 'RETURNING');
    if (teamsToShow.length === 0) {
        interceptTeamStatusDiv.innerHTML = '<p>No teams deployed.</p>';
    } else {
        teamsToShow.forEach(team => {
            const teamStatus = document.createElement('div');
            teamStatus.className = 'data-item';
            let statusText = team.state;
            if (team.state === 'EN_ROUTE' && team.targetTornadoId) {
                statusText = `En Route (T${team.targetTornadoId.toString().slice(-4)}) - ${team.currentWindSpeed.toFixed(0)} mph`;
            } else if (team.state === 'DEPLOYED' && team.targetTornadoId) {
                statusText = `Deployed (T${team.targetTornado.id.toString().slice(-4)}) - ${team.currentWindSpeed.toFixed(0)} mph`;
            } else if (team.state === 'LOFTED') {
                 statusText = `LOFTED!`;
            } 
            // Removed 'RETURNING' case from here as they should not be displayed in "teams out"

            teamStatus.innerHTML = `
                <span class="data-label">${team.teamData.name}</span>
                <span class="data-value">${statusText}</span>
            `;
            interceptTeamStatusDiv.appendChild(teamStatus);
        });
    }

    // Update Intercept Team dropdown with current counts
    const teamSelect = document.getElementById('interceptTeamSelect');
    teamSelect.innerHTML = '<option value="" disabled selected>Select Team</option>'; // Clear existing options
    for (const teamId in simulationState.teamPool) {
        const teamInfo = simulationState.teamPool[teamId];
        const option = document.createElement('option');
        option.value = teamId;
        option.textContent = `${INTERCEPT_TEAMS_DATA[teamId].name} (${teamInfo.currentCount}x)`;
        if (teamInfo.currentCount <= 0) {
            option.disabled = true;
        }
        teamSelect.appendChild(option);
    }
    // Re-select the previously selected team if it's still available
    if (simulationState.selectedTeamForDeployment && teamSelect.querySelector(`option[value="${simulationState.selectedTeamForDeployment}"]`)) {
        teamSelect.value = simulationState.selectedTeamForDeployment;
    } else {
        teamSelect.value = ''; // Clear if not available
    }
}

/**
 * Clears the probe data display.
 */
function clearProbeData() {
    document.getElementById('probeStatus').textContent = `No probe launched.`;
    document.getElementById('probeWind').textContent = `Wind Speed: N/A`;
    document.getElementById('probePressure').textContent = `Pressure Drop: N/A`;
    document.getElementById('probeDebris').textContent = `Max Debris Velocity: N/A`;
}

/**
 * Creates and displays a temporary alert message in the data panel.
 * @param {string} title - The title of the alert.
 * @param {string} message - The message content of the alert.
 * @param {string} type - The type of alert ('alert', 'warning', 'severe', 'success', 'info') for styling.
 */
function createAlert(title, message, type) {
    const alertsDiv = document.getElementById('alerts');
    const alert = document.createElement('div');
    alert.className = `alert ${type}`;
    alert.innerHTML = `<strong>${title}:</strong> ${message}`;
    alertsDiv.prepend(alert); // Add new alerts to the top

    // Remove alert after 5 seconds
    setTimeout(() => {
        alert.remove();
    }, 5000);
}

/**
 * Draws the Doppler Radar overlay on the radar canvas.
 */
function drawRadar() {
    radarCtx.clearRect(0, 0, radarCanvas.width, radarCanvas.height); // Clear radar canvas
    
    // Draw outer circle of the radar
    radarCtx.beginPath();
    radarCtx.arc(radarCanvas.width / 2, radarCanvas.height / 2, radarCanvas.width / 2 - 10, 0, Math.PI * 2);
    radarCtx.strokeStyle = 'rgba(79, 195, 247, 0.5)'; // Light blue outline
    radarCtx.lineWidth = 1;
    radarCtx.stroke();

    // Draw radar sweep line
    radarCtx.save(); // Save current canvas state
    radarCtx.translate(radarCanvas.width / 2, radarCanvas.height / 2); // Move origin to center
    radarCtx.rotate(simulationState.time * 0.05); // Rotate based on simulation time

    radarCtx.beginPath();
    radarCtx.moveTo(0, 0);
    radarCtx.lineTo(radarCanvas.width / 2, 0); // Draw sweep line from center to edge
    radarCtx.strokeStyle = 'rgba(79, 195, 247, 0.8)'; // Brighter blue
    radarCtx.stroke();

    radarCtx.restore(); // Restore canvas state (origin and rotation)

    // Draw rain on the radar
    if (simulationState.currentRainIntensity > 0.01) {
        const numRaindrops = RAIN_PARTICLES_BASE * simulationState.currentRainIntensity * 0.2; // Scale for radar
        radarCtx.fillStyle = `rgba(173, 216, 230, ${simulationState.currentRainIntensity * 0.7})`; // Lighter blue for rain
        for (let i = 0; i < numRaindrops; i++) {
            const x = Math.random() * radarCanvas.width;
            const y = Math.random() * radarCanvas.height;
            radarCtx.beginPath();
            radarCtx.arc(x, y, 1, 0, Math.PI * 2); // Small dots
            radarCtx.fill();
        }
    }

    // Draw hail on the radar
    if (simulationState.currentHailIntensity > 0.01) {
        const numHailstones = HAIL_PARTICLES_BASE * simulationState.currentHailIntensity * 0.3; // Scale for radar
        radarCtx.fillStyle = `rgba(255, 255, 255, ${simulationState.currentHailIntensity * 0.7})`; // White for hail
        for (let i = 0; i < numHailstones; i++) {
            const x = Math.random() * radarCanvas.width;
            const y = Math.random() * radarCanvas.height;
            radarCtx.beginPath();
            radarCtx.arc(x, y, 2, 0, Math.PI * 2); // Slightly larger dots
            radarCtx.fill();
        }
    }

    // Draw lightning on the radar
    if (simulationState.lightningFlash > 0.1) { // Only draw if there's a visible flash
        radarCtx.strokeStyle = `rgba(255, 255, 0, ${simulationState.lightningFlash * 0.8})`; // Yellow for lightning
        radarCtx.lineWidth = 2;
        const strikeX = Math.random() * radarCanvas.width;
        const strikeY = Math.random() * radarCanvas.height;
        radarCtx.beginPath();
        radarCtx.moveTo(strikeX, strikeY - 10);
        radarCtx.lineTo(strikeX + (Math.random() - 0.5) * 10, strikeY + (Math.random() - 0.5) * 10);
        radarCtx.lineTo(strikeX + (Math.random() - 0.5) * 10, strikeY + (Math.random() - 0.5) * 10);
        radarCtx.stroke();
    }

    // Draw storm cells on the radar
    simulationState.storms.forEach(storm => {
        // Map storm position from main canvas to radar canvas
        const radarX = (storm.x / canvas.width) * radarCanvas.width;
        const radarY = (storm.y / canvas.height) * radarCanvas.height;
        const radarSize = storm.size * 0.2; // Scale down storm size for radar display
        
        const alpha = Math.min(1, storm.intensity); // Transparency based on storm intensity
        // Dark gray for supercells/storm cells
        radarCtx.fillStyle = `rgba(100, 100, 100, ${alpha})`; 
        // Draw the storm shape on radar, reflecting the main canvas's irregular shape
        radarCtx.beginPath();
        const segments = 10; 
        const baseRadius = radarSize; 
        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const fluctuation = (Math.sin(storm.age * 0.02 + i * 0.5) * 0.2 + Math.random() * 0.1) * baseRadius;
            const currentRadius = baseRadius + fluctuation;
            if (i === 0) {
                radarCtx.moveTo(radarX + Math.cos(angle) * currentRadius, radarY + Math.sin(angle) * currentRadius);
            } else {
                radarCtx.lineTo(radarX + Math.cos(angle) * currentRadius, radarY + Math.sin(angle) * currentRadius);
            }
        }
        radarCtx.closePath();
        radarCtx.fill();


        // Indicate tornadic storms with a distinct outline color
        if (storm.hasTornado && storm.intensity > 0.5) { // Only if storm is strong enough
            radarCtx.strokeStyle = `rgba(255, 0, 0, ${alpha})`; // Red for rotation/tornado
            radarCtx.lineWidth = 2;
            radarCtx.beginPath();
            radarCtx.arc(radarX, radarY, radarSize + 3, 0, Math.PI * 2);
            radarCtx.stroke();
        }
    });

    // Draw active tornadoes on the radar
    simulationState.tornadoes.forEach(tornado => {
        // Only draw if active or still fading. The filter in `animate` will remove it completely when fadeTimer <= 0.
        if (tornado.isActive || (tornado.fadeTimer !== undefined && tornado.fadeTimer > 0)) {
            const radarX = (tornado.x / canvas.width) * radarCanvas.width;
            const radarY = (tornado.y / canvas.height) * radarCanvas.height;
            const tornadoRadarSize = 4; // Smaller size for tornadoes on radar

            let tornadoAlpha = 1;
            if (!tornado.isActive && tornado.fadeTimer !== undefined && tornado.fadeTimer > 0) {
                tornadoAlpha = (tornado.fadeTimer / DISSIPATING_DURATION_FRAMES); // Fade out over DISSIPATING_DURATION_FRAMES
            }
            if (tornadoAlpha <= 0) return; // Don't draw if fully transparent (will be removed next frame by filter)

            radarCtx.fillStyle = `rgba(255, 0, 0, ${tornadoAlpha})`; // Red for tornadoes
            radarCtx.beginPath();
            radarCtx.arc(radarX, radarY, tornadoRadarSize, 0, Math.PI * 2);
            radarCtx.fill();
        }
    });
}

/**
 * Draws wind vectors across the simulation area if enabled.
 */
function drawWindVectors() {
    if (!document.getElementById('showWindVectors').checked) return;

    const gridSize = 50; // Spacing between wind vector arrows
    const arrowLength = 15;
    // Overall wind strength influenced by wind shear and low-level jet
    const windStrength = simulationState.windShear * 0.5 + simulationState.lowLevelJet * 0.1;

    for (let x = 0; x < canvas.width; x += gridSize) {
        for (let y = 0; y < canvas.height; y += gridSize) {
            // Simulate dynamic wind direction based on position and time
            const angle = Math.atan2(simulationState.lowLevelJet * 0.1, simulationState.stormMotion * 0.05) +
                          (Math.sin(x * 0.01 + simulationState.time * 0.005) * 0.3) + // Gentle wave effect
                          (Math.cos(y * 0.01 + simulationState.time * 0.005) * 0.3);
            const strength = Math.min(1, windStrength / 15); // Scale strength to 0-1

            ctx.strokeStyle = `rgba(150, 200, 255, ${strength * 0.6})`; // Increased opacity to 0.6 for better visibility
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + Math.cos(angle) * arrowLength, y + Math.sin(angle) * arrowLength);
            ctx.stroke();

            // Draw arrowhead
            ctx.save();
            ctx.translate(x + Math.cos(angle) * arrowLength, y + Math.sin(angle) * arrowLength);
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(-5, -3);
            ctx.lineTo(-5, 3);
            ctx.closePath();
            ctx.fill(); // Fill arrowhead
            ctx.restore();
        }
    }
}

/**
 * Draws the vorticity (rotational) field around active tornadoes if enabled.
 */
function drawVorticityField() {
    if (!document.getElementById('showVorticity').checked) return;

    const gridSize = 20; // Density of vorticity indicators
    simulationState.tornadoes.forEach(tornado => {
        if (!tornado.isActive) return;

        for (let x = 0; x < canvas.width; x += gridSize) {
            for (let y = 0; y < canvas.height; y += gridSize) {
                const dx = x - tornado.x;
                const dy = y - tornado.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < tornado.width * 4) { // Draw vorticity within 4x tornado width
                    const vorticityInfluence = (tornado.width * 4 - distance) / (tornado.width * 4);
                    const intensityAlpha = (tornado.windSpeed / EF_WIND_RANGES[5].max) * vorticityInfluence; // Stronger closer to tornado
                    
                    ctx.strokeStyle = `rgba(255, 0, 255, ${intensityAlpha * 0.8})`; // Magenta color for vorticity
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.arc(x, y, 2, Math.atan2(dy, dx) + Math.PI / 2, Math.atan2(dy, dx) + Math.PI / 2 + Math.PI * 1.5); // Arc to show rotational tendency
                    ctx.stroke();
                }
            } 
        } 
    }); 
} 

// --- Rain and Lightning Effects ---

/**
 * Draws rain particles on the canvas. The intensity of rain depends on `simulationState.currentRainIntensity`.
 */
function drawRain() {
    if (simulationState.currentRainIntensity <= 0.01) return; // Don't draw if too faint

    const numRaindrops = RAIN_PARTICLES_BASE * simulationState.currentRainIntensity;
    const raindropLength = 10 + simulationState.currentRainIntensity * 20; // Longer, thicker raindrops for stronger rain
    const raindropSpeed = 8 + simulationState.currentRainIntensity * 10; // Faster for stronger rain

    ctx.strokeStyle = `rgba(173, 216, 230, ${simulationState.currentRainIntensity * 0.8})`; // Light blue, fades with intensity
    ctx.lineWidth = 2 + simulationState.currentRainIntensity * 3; // Thicker lines for raindrops

    for (let i = 0; i < numRaindrops; i++) {
        // Persistent raindrops (recycle positions)
        let x = (Math.random() * canvas.width + simulationState.time * raindropSpeed * 0.5) % canvas.width;
        let y = (Math.random() * canvas.height + simulationState.time * raindropSpeed) % canvas.height;

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - raindropLength, y + raindropLength * 2); // Angled rain
        ctx.stroke();
    }
}

/**
 * Draws hail particles on the canvas. The intensity of hail depends on `simulationState.currentHailIntensity`.
 */
function drawHail() {
    if (simulationState.currentHailIntensity <= 0.01) return;

    const numHailstones = HAIL_PARTICLES_BASE * simulationState.currentHailIntensity;
    const hailstoneSize = 3 + simulationState.currentHailIntensity * 5; // Larger hail for stronger intensity
    const hailstoneSpeed = 5 + simulationState.currentHailIntensity * 10; // Faster for stronger intensity

    ctx.fillStyle = `rgba(255, 255, 255, ${simulationState.currentHailIntensity * 0.9})`; // White, slightly opaque
    
    for (let i = 0; i < numHailstones; i++) {
        let x = (Math.random() * canvas.width + simulationState.time * hailstoneSpeed * 0.5) % canvas.width;
        let y = (Math.random() * canvas.height + simulationState.time * hailstoneSpeed) % canvas.height;

        ctx.beginPath();
        ctx.arc(x, y, hailstoneSize, 0, Math.PI * 2); // Draw as circles
        ctx.fill();
    }
}

/**
 * Draws a lightning bolt and applies a full-screen flash effect.
 * @param {number} x - X coordinate of the lightning strike origin.
 * @param {number} y - Y coordinate of the lightning strike origin.
 * @param {number} intensity - Brightness of the flash (0-1).
 */
function drawLightning(x, y, intensity) {
    if (intensity <= 0) return;

    // Full screen flash
    ctx.fillStyle = `rgba(255, 255, 255, ${intensity * 0.7})`; // Brighter white flash
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw lightning bolt
    ctx.strokeStyle = `rgba(255, 255, 0, ${intensity})`; // Yellow for lightning
    ctx.lineWidth = 2 + intensity * 3; // Thicker bolt for stronger flashes
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(x, 0); // Start from top of the screen

    let currentX = x;
    let currentY = 0;

    // Generate jagged path
    while (currentY < y) {
        currentX += (Math.random() - 0.5) * 40 * intensity; // Random horizontal deviation
        currentY += Math.random() * 30 + 10; // Vertical segment length
        
        // Clamp X within canvas bounds to avoid drawing off-screen
        currentX = Math.max(0, Math.min(canvas.width, currentX));

        ctx.lineTo(currentX, currentY);
    }
    ctx.stroke();
}

/**
 * Triggers a lightning strike at a random location related to active tornadoes.
 * Also causes a burst of debris.
 */
function triggerLightningStrike() {
    const activeTornadoes = simulationState.tornadoes.filter(t => t.isActive);
    if (activeTornadoes.length === 0) return;

    // Pick a random active tornado as the focal point for the strike
    const targetTornado = activeTornadoes[Math.floor(Math.random() * activeTornadoes.length)];
    
    // Strike near the tornado, but with some randomness
    const strikeX = targetTornado.x + (Math.random() - 0.5) * targetTornado.width * 5;
    const strikeY = targetTornado.y + (Math.random() - 0.5) * targetTornado.width * 5;

    simulationState.lightningFlash = 1; // Trigger full brightness flash
    // Add an extra boost to screen shake for lightning strikes
    // The screenShakeIntensity is capped at 1.0, ensuring it doesn't go too crazy.
    simulationState.screenShakeIntensity = Math.min(1.0, simulationState.screenShakeIntensity + 0.2); // Increased boost from 0.3 to 0.4 for more visible extra shake

    // Add debris burst at strike location, linked to the closest tornado
    addDebrisBurst(strikeX, strikeY, targetTornado.id);
}

/**
 * Adds a burst of debris particles at a given location.
 * @param {number} x - X coordinate for debris burst.
 * @param {number} y - Y coordinate for debris burst.
 * @param {string} associatedTornadoId - The ID of the tornado to associate debris with.
 */
function addDebrisBurst(x, y, associatedTornadoId) {
    const debrisCount = 15; // Number of debris particles to spawn
    const burstStrength = 20; // How fast particles fly out

    const targetTornado = simulationState.tornadoes.find(t => t.id === associatedTornadoId);
    if (!targetTornado) return; // Must have an active tornado to add debris to its array

    for (let i = 0; i < debrisCount; i++) {
        const angle = Math.random() * Math.PI * 2; // Random direction
        const speed = Math.random() * burstStrength + 5; // Random speed
        targetTornado.debris.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: DEBRIS_SIZES[Math.floor(Math.random() * DEBRIS_SIZES.length)], // Random size
            life: Math.random() * 80 + 70 // Longer life for burst debris
        });
    }
}

/**
 * Draws a subtle windy effect on the canvas, appearing like dirt/dust near tornadoes.
 * The intensity depends on `simulationState.currentWindyIntensity`.
 */
function drawWindyEffect() {
    if (!document.getElementById('showWindyEffect').checked || simulationState.currentWindyIntensity <= 0.01) return;

    const numWindParticles = 200; // Fewer, more distinct particles for dust
    const particleSpeed = 3 + simulationState.currentWindyIntensity * 7; // Speed based on intensity
    const particleLife = 60; // Lifespan of each particle in frames

    ctx.fillStyle = `rgba(139, 69, 19, ${simulationState.currentWindyIntensity * 0.3})`; // Faint dirt color, slightly higher opacity
    
    for (let i = 0; i < numWindParticles; i++) {
        // Determine particle origin based on proximity to a tornado
        let startX, startY;
        const activeTornadoes = simulationState.tornadoes.filter(t => t.isActive);

        if (activeTornadoes.length > 0 && Math.random() < 0.7) { // 70% chance to spawn near a tornado
            const tornado = activeTornadoes[Math.floor(Math.random() * activeTornadoes.length)];
            // Spawn near the tornado base, with random outward velocity
            const angle = Math.random() * Math.PI * 2;
            const offset = Math.random() * tornado.width * 0.5; // Spawn within tornado's radius
            startX = tornado.x + Math.cos(angle) * offset;
            startY = tornado.y + Math.sin(angle) * offset;
        } else { // 30% chance for general background wind
            startX = Math.random() * canvas.width;
            startY = Math.random() * canvas.height;
        }

        // Simulate movement based on wind speed and direction, with jitter
        const windAngle = Math.atan2(simulationState.lowLevelJet, simulationState.stormMotion) + (Math.random() - 0.5) * 0.5;
        const offsetX = Math.cos(windAngle) * ((simulationState.time * particleSpeed) % (canvas.width * 1.5)) - (canvas.width * 0.25);
        const offsetY = Math.sin(windAngle) * ((simulationState.time * particleSpeed) % (canvas.height * 1.5)) - (canvas.height * 1.5); // Adjusted to sweep faster vertically

        ctx.beginPath();
        ctx.arc(startX + offsetX, startY + offsetY, 1 + simulationState.currentWindyIntensity * 1.5, 0, Math.PI * 2); // Small, varying size
        ctx.fill();
    }
}

/**
 * Draws a misty effect on the canvas.
 * The intensity of the mist depends on `simulationState.currentMistyIntensity`.
 */
function drawMistyEffect() {
    if (!document.getElementById('showMistyEffect').checked || simulationState.currentMistyIntensity <= 0.01) return;

    // Make mist similar to weak rain, but more translucent
    const numMistParticles = RAIN_PARTICLES_BASE * 0.5; // Half the base raindrops for mist
    const mistParticleSize = 1; // Small particles
    const mistSpeed = 5; // Slower than rain
    const mistOpacity = simulationState.currentMistyIntensity * 0.002; // Very low opacity (max 0.2%)

    ctx.fillStyle = `rgba(200, 200, 200, ${mistOpacity})`; // Light grey, very transparent
    ctx.filter = `blur(${0.2 + simulationState.currentMistyIntensity * 0.2}px)`; // Gentle blur, even softer

    for (let i = 0; i < numMistParticles; i++) {
        let x = (Math.random() * canvas.width + simulationState.time * mistSpeed * 0.5) % canvas.width;
        let y = (Math.random() * canvas.height + simulationState.time * mistSpeed) % canvas.height;

        ctx.beginPath();
        ctx.arc(x, y, mistParticleSize, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.filter = 'none'; // Reset filter after drawing
}

/**
 * Applies a subtle screen shake effect based on `simulationState.screenShakeIntensity`.
 */
function shakeScreen() {
    const intensity = simulationState.screenShakeIntensity;
    if (intensity === 0) {
        document.body.style.transform = 'translate(0, 0)';
        return;
    }

    const shakeX = (Math.random() - 0.5) * intensity * 20; // Increased multiplier for more visible shake
    const shakeY = (Math.random() - 0.5) * intensity * 20; // Increased multiplier
    document.body.style.transform = `translate(${shakeX}px, ${shakeY}px)`;

    // Gradually reduce shake intensity over time if no new strong tornadoes
    simulationState.screenShakeIntensity = Math.max(0, simulationState.screenShakeIntensity - 0.005); // Faster decay
    
    requestAnimationFrame(shakeScreen); // Continue shaking
}

// --- Simulation Control Functions ---

/**
 * Checks if a specific tornado already has an intercept team assigned, en route, or returning.
 * @param {string} tornadoId - The ID of the tornado to check.
 * @returns {boolean} True if a team is already associated with this tornado, false otherwise.
 */
function isTornadoAlreadyTargeted(tornadoId) {
    return simulationState.interceptTeams.some(team =>
        team.targetTornadoId === tornadoId &&
        (team.isActive || team.state === 'RETURNING' || team.state === 'LOFTED')
    );
}


/**
 * Handles clicks on the simulation area. Spawns storm cells or selects tornado target for intercept teams.
 * @param {MouseEvent} event - The click event object.
 */
function handleSimulationAreaClick(event) {
    // Check if the click originated from within the tornado info box.
    // If so, prevent it from affecting the simulation area.
    if (event.target.closest('.tornado-info')) {
        event.stopPropagation(); // Stop propagation to prevent canvas click handler from firing
        return;
    }

    // If auto-run is active, disable manual clicks to spawn storms.
    if (simulationState.autoRun) {
        createAlert('Operation Restricted', 'Cannot manually spawn storms during auto-run mode.', 'info');
        return;
    }

    const rect = canvas.getBoundingClientRect();
    let clickX = event.clientX - rect.left; // X coordinate relative to canvas
    let clickY = event.clientY - rect.top; // Y coordinate relative to canvas

    if (simulationState.awaitingTeamTarget) {
        // In target selection mode for intercept teams
        const clickedTornado = simulationState.tornadoes.find(t => {
            return t.isActive && Math.sqrt((clickX - t.x)**2 + (clickY - t.y)**2) < t.width * 1.5; // Click within tornado's visual radius
        });

        if (clickedTornado) {
            // Check if this tornado already has a team assigned
            if (isTornadoAlreadyTargeted(clickedTornado.id)) {
                createAlert('Deployment Failed', `Tornado .${clickedTornado.id.toString().slice(-4)} already has an intercept team assigned.`, 'warning');
                cancelTeamTargetSelection(); // Exit selection mode
                return;
            }

            // Check if the selected team type is available in the pool
            const teamId = simulationState.selectedTeamForDeployment;
            if (simulationState.teamPool[teamId].currentCount <= 0) {
                createAlert('Deployment Failed', `No ${INTERCEPT_TEAMS_DATA[teamId].name} teams available.`, 'warning');
                cancelTeamTargetSelection(); // Exit selection mode
                return;
            }

            // Deploy the selected team to this tornado
            simulationState.interceptTeams.push(new InterceptTeam(teamId, clickedTornado.id));
            simulationState.teamPool[teamId].currentCount--; // Decrement team count
            
            cancelTeamTargetSelection(); // Exit target selection mode
            simulationState.autoDeployCooldown = simulationState.time + (120 * simulationState.simSpeed); // Set cooldown after manual deployment
        } else {
            createAlert('No Tornado Selected', 'Please click directly on an active tornado.', 'warning');
        }
    } else if (simulationState.clickToAdd) {
        // Normal mode: add storm cell (not supercell)
        // When manually clicking, CAPE influences spawned storm's size
        const cape = calculateCAPE();
        
        let minSize, maxSize;

        if (cape < 1000) { // Weak instability
            minSize = 20;
            maxSize = 40;
        } else if (cape < 2500) { // Moderate instability
            minSize = 30;
            maxSize = 60;
        } else if (cape < 4000) { // Strong instability
            minSize = 40;
            maxSize = 70;
        } else { // Extreme instability (>4000 J/kg)
            minSize = 50;
            maxSize = 80;
        }
        
        const stormSize = minSize + Math.random() * (maxSize - minSize);

        // Adjust clickX and clickY to ensure storm is within bounds
        clickX = Math.max(stormSize, Math.min(canvas.width - stormSize, clickX));
        clickY = Math.max(stormSize, Math.min(canvas.height - stormSize, clickY));

        const storm = new StormCell(clickX, clickY, false);
        storm.intensity = 0.3 + (cape / MAX_CAPE) * 0.4; // Intensity based on CAPE
        storm.size = stormSize;
        
        simulationState.storms.push(storm); 
        createAlert('New Storm Cell', 'A new storm cell has formed.', 'warning');
        simulationState.lastStormActivityTime = simulationState.time; // Update activity time
    }
}

/**
 * Handles right-clicks (contextmenu) on the simulation area to remove elements.
 * Also added functionality to right-click intercept teams to send them back to base.
 * @param {MouseEvent} event - The right-click event object.
 */
function handleSimulationAreaRightClick(event) {
    // Check if the click originated from within the tornado info box.
    // If so, prevent it from affecting the simulation area.
    if (event.target.closest('.tornado-info')) {
        event.stopPropagation(); // Stop propagation
        return;
    }

    event.preventDefault(); // Prevent default context menu
    if (simulationState.autoRun) {
        createAlert('Operation Restricted', 'Cannot remove elements during auto-run mode.', 'info');
        return;
    }

    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    let interactionHandled = false;

    // Check for intercept teams first (return to base)
    for (let i = 0; i < simulationState.interceptTeams.length; i++) {
        const team = simulationState.interceptTeams[i];
        // Only allow right-click on active teams that are not already returning or lofted
        if (team.isActive && team.state !== 'RETURNING' && team.state !== 'LOFTED') {
            const distance = Math.sqrt((clickX - team.x)**2 + (clickY - team.y)**2);
            if (distance < 15) { // Click within team's visual radius (e.g., 15 pixels)
                team.state = 'RETURNING';
                team.targetTornadoId = null; // Clear target
                team.isDeployed = false; // Undeploy if deployed
                createAlert('Team Action', `${team.teamData.name} manually sent back to base.`, 'info');
                interactionHandled = true;
                break;
            }
        }
    }

    if (interactionHandled) return; // If an intercept team was handled, don't check for tornadoes/storms

    // Check for tornadoes
    for (let i = 0; i < simulationState.tornadoes.length; i++) {
        const t = simulationState.tornadoes[i];
        const distance = Math.sqrt((clickX - t.x)**2 + (clickY - t.y)**2);
        if (distance < t.width * 1.5) { // Click within 1.5x tornado width
            // Send back any assigned intercept teams
            const team = simulationState.interceptTeams.find(tm => tm.targetTornadoId === t.id && tm.isActive);
            if (team) {
                team.state = 'RETURNING';
                team.targetTornadoId = null;
                tm.isDeployed = false; // Undeploy if deployed
                createAlert('Team Update', `${team.teamData.name} returning to base (Tornado removed).`, 'info');
            }
            // When a tornado is manually removed, update its longest track if it hasn't already.
            if (!t.statsUpdated) {
                simulationState.statistics.longestTrack = Math.max(simulationState.statistics.longestTrack, t.pathLength);
                t.statsUpdated = true;
            }
            simulationState.tornadoes.splice(i, 1);
            createAlert('Tornado Removed', `Tornado at (${t.x.toFixed(0)}, ${t.y.toFixed(0)}) removed.`, 'info');
            interactionHandled = true;
            break;
        }
    }

    if (interactionHandled) return; // If a tornado was removed, don't check for storms/cells

    // Check for storm cells
    for (let i = 0; i < simulationState.storms.length; i++) {
        const s = simulationState.storms[i];
        const distance = Math.sqrt((clickX - s.x)**2 + (clickY - s.y)**2);
        if (distance < s.size * 1.5) { // Click within 1.5x storm size
            // If this storm has a tornado, its tornado will be orphaned and dissipate, or handle it as a cascading removal
            // For simplicity, directly remove the storm and its associated tornado if any.
            // This relies on the tornado's own dissipation logic if its parent storm is removed.
            const associatedTornado = simulationState.tornadoes.find(t => t.parentStormId === s.id); // Assuming tornadoes track parent storm
            if (associatedTornado) {
                 associatedTornado.isActive = false; // Force tornado to dissipate
                 associatedTornado.fadeTimer = 0; // Immediate removal
                 // Update longest track for the associated tornado if not already done
                 if (!associatedTornado.statsUpdated) {
                    simulationState.statistics.longestTrack = Math.max(simulationState.statistics.longestTrack, associatedTornado.pathLength);
                    associatedTornado.statsUpdated = true;
                 }
            }
            simulationState.storms.splice(i, 1);
            createAlert('Storm Removed', `Storm cell at (${s.x.toFixed(0)}, ${s.y.toFixed(0)}) removed.`, 'info');
            interactionHandled = true;
            break;
        }
    }
}

/**
 * Handles mouse movement over the simulation area, especially for target selection.
 * @param {MouseEvent} event - The mouse move event object.
 */
function handleSimulationAreaMouseMove(event) {
    // Only update cursor if not in auto-run mode and awaiting target.
    if (!simulationState.autoRun && simulationState.awaitingTeamTarget) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        const hoverTornado = simulationState.tornadoes.find(t => {
            return t.isActive && Math.sqrt((mouseX - t.x)**2 + (mouseY - t.y)**2) < t.width * 1.5;
        });

        if (hoverTornado) {
            simulationAreaDiv.classList.add('hover-tornado');
        } else {
            simulationAreaDiv.classList.remove('hover-tornado');
        }
    } else if (simulationState.autoRun) {
        // If in auto-run mode, always keep default cursor
        simulationAreaDiv.classList.remove('target-mode', 'hover-tornado');
    }
}

/**
 * Handles the change event for the intercept team select dropdown.
 * Updates the selectedTeamForDeployment in the simulation state.
 */
function handleTeamSelectChange() {
    const teamSelect = document.getElementById('interceptTeamSelect');
    simulationState.selectedTeamForDeployment = teamSelect.value;
    // Optionally, you can update the deploy button state here based on selection
    const selectedTeamExists = simulationState.selectedTeamForDeployment !== null && simulationState.selectedTeamForDeployment !== '';
    const selectedTeamAvailable = selectedTeamExists && simulationState.teamPool[simulationState.selectedTeamForDeployment]?.currentCount > 0;
    document.getElementById('deployTeamBtn').disabled = simulationState.autoRun || !selectedTeamAvailable;
    document.getElementById('deployHint').textContent = `Selected: ${INTERCEPT_TEAMS_DATA[simulationState.selectedTeamForDeployment]?.name || 'None'}. Click on a tornado to deploy.`;
    if (simulationState.selectedTeamForDeployment === '') {
        document.getElementById('deployHint').textContent = `Select a team, then click on a tornado to deploy.`;
    }
}

/**
 * Spawns a powerful supercell in the simulation.
 * Supercells have higher intensity, larger size, and longer lifespans.
 */
function spawnSupercell(autoSpawn = false) { // Added autoSpawn flag
    // If auto-run is active and this is not an auto-spawn, do not allow manual spawn.
    if (simulationState.autoRun && !autoSpawn) {
        createAlert('Operation Restricted', 'Cannot manually spawn supercells during auto-run mode.', 'info');
        return;
    }

    const cape = calculateCAPE();
    
    let minSupercellSize, maxSupercellSize;

    // Determine supercell size and intensity based on CAPE levels (0-5000 J/kg)
    // and environmental controls.
    // These ranges now directly influence the initial storm properties.
    if (cape < 1000) { // Weak instability
        minSupercellSize = 50;
        maxSupercellSize = 80;
    } else if (cape < 2500) { // Moderate instability
        minSupercellSize = 80;
        maxSupercellSize = 120;
    }
    else if (cape < 4000) { // Strong instability
        minSupercellSize = 120;
        maxSupercellSize = 160;
    } else { // Extreme instability (>4000 J/kg)
        minSupercellSize = 160;
        maxSupercellSize = 220; // Allow for larger supercells
    }

    const supercellBaseSize = minSupercellSize + Math.random() * (maxSupercellSize - minSupercellSize);

    // Ensure the supercell spawns fully within the canvas bounds
    const buffer = supercellBaseSize + 10; // Add some buffer for visibility
    const x = buffer + Math.random() * (canvas.width - 2 * buffer);
    const y = buffer + Math.random() * (canvas.height - 2 * buffer);
    
    const supercell = new StormCell(x, y, true);
    // Supercell intensity is also influenced by environmental controls
    // Higher wind shear and low-level jet increase intensity
    supercell.intensity = 0.5 + (cape / MAX_CAPE) * 0.5 + 
                          (simulationState.windShear / 20) * 0.1 + // 0 to 0.1
                          (simulationState.lowLevelJet / 35) * 0.1; // 0 to 0.1
    supercell.intensity = Math.min(1.0, supercell.intensity); // Cap at 1.0

    // Calculate size within the dynamically adjusted min/max range
    supercell.size = supercellBaseSize;
    
    simulationState.storms.push(supercell);
    createAlert('SUPERCELL FORMED', `A powerful supercell has formed!`, 'alert'); 
    simulationState.lastStormActivityTime = simulationState.time; // Update activity time
}

/**
 * Triggers a "tornado outbreak" by spawning multiple storm cells in quick succession.
 */
function triggerOutbreak(autoSpawn = false) { // Added autoSpawn flag
    // If auto-run is active and this is not an auto-spawn, do not allow manual outbreak.
    if (simulationState.autoRun && !autoSpawn) {
        createAlert('Operation Restricted', 'Cannot manually trigger outbreaks during auto-run mode.', 'info');
        return;
    }

    const numStorms = 5; 
    for (let i = 0; i < numStorms; i++) { // Spawn 5 storms
        setTimeout(() => {
            const cape = calculateCAPE();
            const isSupercellOutbreak = Math.random() > 0.6; // Higher chance of regular storms in outbreak for variety

            let stormSize;
            let minSize, maxSize;

            if (!isSupercellOutbreak) { // For regular storms in outbreak
                // Regular storm intensity and size based on CAPE and other controls
                const intensity = Math.random() * 0.4 + 0.6 + // Base intensity for outbreak
                                  (cape / MAX_CAPE) * 0.2 +
                                  (simulationState.windShear / 20) * 0.05;

                if (cape < 1000) { minSize = 20; maxSize = 40; }
                else if (cape < 2500) { minSize = 30; maxSize = 60; }
                else if (cape < 4000) { minSize = 40; maxSize = 70; }
                else { minSize = 50; maxSize = 80; }

                stormSize = minSize + Math.random() * (maxSize - minSize);
                
                // Ensure storm spawns fully within the canvas bounds
                const buffer = stormSize + 10;
                const x = buffer + Math.random() * (canvas.width - 2 * buffer);
                const y = buffer + Math.random() * (canvas.height - 2 * buffer);

                const storm = new StormCell(x, y, isSupercellOutbreak);
                storm.intensity = Math.min(1.0, intensity); // Apply calculated intensity
                storm.size = stormSize; // Assign the calculated size
                simulationState.storms.push(storm);
            } else { // For supercells in outbreak (use the same logic as spawnSupercell)
                 let minSupercellSize, maxSupercellSize;
                if (cape < 1000) { minSupercellSize = 50; maxSupercellSize = 80; }
                else if (cape < 2500) { minSupercellSize = 80; maxSupercellSize = 120; }
                else if (cape < 4000) { minSupercellSize = 120; maxSupercellSize = 160; }
                else { minSupercellSize = 160; maxSupercellSize = 220; }

                 const intensity = 0.5 + (cape / MAX_CAPE) * 0.5 + 
                                   (simulationState.windShear / 20) * 0.1 + 
                                   (simulationState.lowLevelJet / 35) * 0.1;

                 stormSize = minSupercellSize + Math.random() * (maxSupercellSize - minSupercellSize); 
                
                 // Ensure storm spawns fully within the canvas bounds
                 const buffer = stormSize + 10;
                 const x = buffer + Math.random() * (canvas.width - 2 * buffer);
                 const y = buffer + Math.random() * (canvas.height - 2 * buffer);

                 const storm = new StormCell(x, y, isSupercellOutbreak);
                 storm.intensity = Math.min(1.0, intensity); // Apply calculated intensity
                 storm.size = stormSize; // Assign the calculated size
                 simulationState.storms.push(storm);
            }
        }, i * 500); // Stagger spawns by 500ms
    }
    createAlert('TORNADO OUTBREAK SIMULATION', 'Multiple storm cells are forming. Be prepared!', 'severe');
    simulationState.lastStormActivityTime = simulationState.time; // Update activity time
}

/**
 * Displays the probe launch options modal.
 */
function showProbeLaunchOptions() {
    // If auto-run is active, do not allow manual probe launch.
    if (simulationState.autoRun) return;

    const activeTornadoes = simulationState.tornadoes.filter(t => t.isActive);
    if (activeTornadoes.length === 0) {
        createAlert('No Tornadoes', 'No active tornadoes to launch a probe into. Spawn one first!', 'warning');
        return;
    }
    
    // Pause simulation when modal is shown
    simulationState.paused = true;
    document.getElementById('pauseBtn').textContent = 'Resume'; // Update pause button text
    document.getElementById('statusDot').className = 'status-dot warning';
    document.getElementById('statusText').textContent = 'Simulation Paused (Modal)';

    // Populate the "Launch from Team" dropdown with deployed teams
    const probeTeamSelect = document.getElementById('probeTeamSelect');
    probeTeamSelect.innerHTML = '<option value="" disabled selected>Select Deployed Team</option>'; // Clear existing
    const deployedTeams = simulationState.interceptTeams.filter(team => team.isDeployed && team.targetTornado);
    deployedTeams.forEach(team => {
        const option = document.createElement('option');
        option.value = team.id;
        option.textContent = `${team.teamData.name} (Tornado ${team.targetTornado.id.toString().slice(-4)})`;
        probeTeamSelect.appendChild(option);
    });

    // Enable/disable "Launch from Team" button based on deployed teams
    document.getElementById('launchFromTeamBtn').disabled = deployedTeams.length === 0;

    showProbeModal(); // Show the modal for probe launch options
}

/**
 * Launches a probe normally (from a random corner).
 */
function launchProbeNormally() {
    // Hide the modal if opened manually
    hideProbeModal();

    if (simulationState.probes.some(p => p.isActive)) {
        createAlert('Probe Busy', 'Another probe is already active. Please wait.', 'warning');
        return;
    }

    const activeTornadoes = simulationState.tornadoes.filter(t => t.isActive);
    if (activeTornadoes.length === 0) {
        createAlert('No Tornadoes', 'No active tornadoes to launch a probe into. Spawn one first!', 'warning');
        return;
    }

    // Pick a random active tornado as the target
    const targetTornado = activeTornadoes[Math.floor(Math.random() * activeTornadoes.length)];

    // Determine random corner for probe launch (0: top-left, 1: top-right, 2: bottom-left, 3: bottom-right)
    const corner = Math.floor(Math.random() * 4);
    let startX, startY;
    const padding = 50; // Padding from corners

    switch (corner) {
        case 0: startX = padding; startY = padding; break;
        case 1: startX = canvas.width - padding; startY = padding; break;
        case 2: startX = padding; startY = canvas.height - padding; break;
        case 3: startX = canvas.width - padding; startY = canvas.height - padding; break;
    }

    // Create and add the new probe to the simulation state
    const newProbe = new Probe(startX, startY, targetTornado.id);
    simulationState.probes.push(newProbe);
    document.getElementById('launchProbeBtn').disabled = true; // Disable button until probe is done
    createAlert('Probe Launched', `Probe launched towards Tornado ${targetTornado.id.toString().slice(-4)}!`, 'info');
}

/**
 * Launches a probe from a selected deployed intercept team.
 * @param {string} [teamId] - The ID of the team to launch from (optional, read from dropdown if not provided)
 * @param {string} [tornadoId] - The ID of the tornado to target (optional, read from team's target if not provided)
 */
function launchProbeFromTeam(teamId = null, tornadoId = null) {
    hideProbeModal(); // Hide the modal

    if (simulationState.probes.some(p => p.isActive)) {
        createAlert('Probe Busy', 'Another probe is already active. Please wait.', 'warning');
        return;
    }

    let selectedTeam;
    if (teamId) {
        selectedTeam = simulationState.interceptTeams.find(t => t.id === teamId);
    } else {
        const selectedTeamId = document.getElementById('probeTeamSelect').value;
        if (!selectedTeamId) {
            createAlert('No Team Selected', 'Please select a deployed team to launch the probe from.', 'warning');
            return;
        }
        selectedTeam = simulationState.interceptTeams.find(t => t.id === selectedTeamId);
    }

    if (!selectedTeam || !selectedTeam.isDeployed || !selectedTeam.targetTornado) {
        createAlert('Deployment Error', 'Selected team is not deployed or has no active target tornado.', 'warning');
        return;
    }

    const targetTornado = selectedTeam.targetTornado;

    // Probe starts from the team's current position
    simulationState.probes.push(new Probe(selectedTeam.x, selectedTeam.y, targetTornado.id));
    document.getElementById('launchProbeBtn').disabled = true; // Disable button until probe is done
    createAlert('Probe Launched', `Probe launched from ${selectedTeam.teamData.name} towards Tornado ${targetTornado.id.toString().slice(-4)}!`, 'info');
}


/**
 * Toggles the simulation between paused and active states.
 */
function togglePause() {
    simulationState.paused = !simulationState.paused;
    const pauseBtn = document.getElementById('pauseBtn');
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');

    if (simulationState.paused) {
        cancelAnimationFrame(animationFrameId); // Stop the animation loop
        pauseBtn.textContent = 'Resume';
        statusDot.className = 'status-dot warning';
        statusText.textContent = 'Simulation Paused';
    } else {
        requestAnimationFrame(animate); // Restart the animation loop
        pauseBtn.textContent = 'Pause';
        statusDot.className = 'status-dot';
        statusText.textContent = 'Simulation Active';
    }
    updateControlButtonsState(); // Update button states on pause/resume
}

/**
 * Resets the entire simulation to its initial state.
 */
function resetSimulation() {
    // Store auto-run state before resetting
    const autoRunBeforeReset = simulationState.autoRun;

    // Reset simulation state
    simulationState.tornadoes = [];
    simulationState.storms = [];
    simulationState.probes = [];
    simulationState.interceptTeams = [];
    simulationState.time = 0;
    simulationState.paused = false;
    simulationState.statistics = {
        totalTornadoes: 0,
        peakIntensity: 0,
        longestTrack: 0
    };

    // Reset all counts in team pool
    for (const teamId in simulationState.teamPool) {
        simulationState.teamPool[teamId].currentCount = simulationState.teamPool[teamId].maxCount;
    }

    // Reset visual effects intensities
    simulationState.currentRainIntensity = 0;
    simulationState.lightningFlash = 0;
    simulationState.nextLightningStrikeTime = 0;
    simulationState.currentWindyIntensity = 0;
    simulationState.currentMistyIntensity = 0;
    simulationState.screenShakeIntensity = 0;
    simulationState.isCAPERandomizing = false;
    simulationState.lastStormActivityTime = simulationState.time; // Reset activity time

    // Re-initialize CAPE to a new random value for a fresh start
    simulationState.targetCAPE = MIN_CAPE + Math.random() * (MAX_CAPE - MIN_CAPE);
    simulationState.initialCAPEDuringTransition = simulationState.targetCAPE; // Start at target for first frame

    // Reset base locations for intercept teams
    // Ensure canvas dimensions are available before setting base locations
    if (canvas && canvas.width > 0 && canvas.height > 0) {
        INTERCEPT_TEAMS_DATA.TIV1.baseLocation = {x: 50, y: 50};
        INTERCEPT_TEAMS_DATA.TIV2.baseLocation = {x: 50, y: canvas.height - 50};
        INTERCEPT_TEAMS_DATA.DOM1.baseLocation = {x: canvas.width - 50, y: 50};
        INTERCEPT_TEAMS_DATA.DOM2.baseLocation = {x: canvas.width - 50, y: canvas.height - 50};
        INTERCEPT_TEAMS_DATA.DOM3.baseLocation = {x: canvas.width / 2, y: canvas.height / 2 + 100};
        INTERCEPT_TEAMS_DATA.TORNADO_ATTACK.baseLocation = {x: canvas.width / 2, y: 50};
        INTERCEPT_TEAMS_DATA.TITUS.baseLocation = {x: canvas.width / 2, y: canvas.height - 50};
    }


    // Restore auto-run state
    simulationState.autoRun = autoRunBeforeReset;

    // Reset UI elements
    document.getElementById('pauseBtn').textContent = 'Pause';
    document.getElementById('statusDot').className = 'status-dot';
    document.getElementById('statusText').textContent = 'Simulation Active';
    document.getElementById('launchProbeBtn').disabled = false;
    
    // Update auto-run button state explicitly
    const autoRunBtn = document.getElementById('autoRunBtn');
    if (simulationState.autoRun) {
        autoRunBtn.classList.add('toggle-on');
        autoRunBtn.textContent = 'Auto-run (ON)';
    } else {
        autoRunBtn.classList.remove('toggle-on');
        autoRunBtn.textContent = 'Auto-run (OFF)';
    }

    // Stop any playing sounds
    if (isTornadoSirenPlaying) {
        SOUNDS.tornadoSiren.pause();
        SOUNDS.tornadoSiren.currentTime = 0;
        isTornadoSirenPlaying = false;
    }
    if (isNoaaWarningPlaying) {
        SOUNDS.noaaWarning.pause();
        SOUNDS.noaaWarning.currentTime = 0;
        isNoaaWarningPlaying = false;
    }
    lastTornadoCount = 0;

    // Restart animation loop
    if (!animationFrameId) {
        requestAnimationFrame(animate);
    }
}

/**
 * Toggles the auto-run mode for storm and team management.
 */
function toggleAutoRun() {
    simulationState.autoRun = !simulationState.autoRun;
    const autoRunBtn = document.getElementById('autoRunBtn');
    if (simulationState.autoRun) {
        autoRunBtn.classList.add('toggle-on');
        autoRunBtn.textContent = 'Auto-run (ON)';
        // Set initial auto-spawn/probe times
        simulationState.nextAutoSpawnTime = simulationState.time + 300; // 5 seconds
        simulationState.nextAutoProbeTime = simulationState.time + 180; // 3 seconds
        simulationState.autoDeployCooldown = 0; // No initial cooldown
        simulationState.lastStormActivityTime = simulationState.time; // Initialize for auto-run start
        createAlert('Auto-run ON', 'Auto-run mode activated! Storms and teams will be managed automatically.', 'info');
    } else {
        autoRunBtn.classList.remove('toggle-on');
        autoRunBtn.textContent = 'Auto-run (OFF)';
        createAlert('Auto-run OFF', 'Auto-run mode deactivated. Manual controls restored.', 'info');
    }
    updateControlButtonsState(); // Update button states when auto-run changes
}

/**
 * Enables/disables control buttons based on current simulation state (paused, auto-run, team selected).
 */
function updateControlButtonsState() {
    const isPaused = simulationState.paused;
    const isAutoRun = simulationState.autoRun;
    const hasSelectedTeam = simulationState.selectedTeamForDeployment !== null && simulationState.selectedTeamForDeployment !== '';
    const selectedTeamAvailable = hasSelectedTeam && simulationState.teamPool[simulationState.selectedTeamForDeployment]?.currentCount > 0;

    document.getElementById('spawnSupercellBtn').disabled = isPaused || isAutoRun;
    document.getElementById('triggerOutbreakBtn').disabled = isPaused || isAutoRun;
    document.getElementById('launchProbeBtn').disabled = isPaused || isAutoRun || simulationState.probes.some(p => p.isActive);

    // Deploy button is enabled only if a team is selected AND available AND not paused AND not in auto-run AND not awaiting target
    document.getElementById('deployTeamBtn').disabled = isPaused || isAutoRun || !selectedTeamAvailable || simulationState.awaitingTeamTarget;

    // Interaction hint text
    const interactionHint = document.getElementById('interactionHint');
    if (isAutoRun) {
        interactionHint.textContent = 'Auto-run active.';
        simulationAreaDiv.classList.remove('target-mode'); // Ensure target mode is off
        simulationAreaDiv.classList.remove('hover-tornado'); // Ensure hover effect is off
    } else if (simulationState.awaitingTeamTarget) {
        interactionHint.textContent = 'Click on an active tornado to deploy team.';
        simulationAreaDiv.classList.add('target-mode');
    } else {
        interactionHint.textContent = 'Click to spawn storm cells. Right-click to remove.';
        simulationAreaDiv.classList.remove('target-mode');
        simulationAreaDiv.classList.remove('hover-tornado');
    }
}

/**
 * Shows the help modal.
 */
function showHelpModal() {
    document.getElementById('helpModal').style.display = 'block';
    // Pause simulation when modal is shown
    simulationState.paused = true;
    document.getElementById('pauseBtn').textContent = 'Resume'; // Update pause button text
    document.getElementById('statusDot').className = 'status-dot warning';
    document.getElementById('statusText').textContent = 'Simulation Paused (Modal)';
}

/**
 * Hides the help modal.
 */
function hideHelpModal() {
    document.getElementById('helpModal').style.display = 'none';
    // Resume simulation when modal is hidden
    simulationState.paused = false;
    document.getElementById('pauseBtn').textContent = 'Pause';
    document.getElementById('statusDot').className = 'status-dot';
    document.getElementById('statusText').textContent = 'Simulation Active';
}

/**
 * Shows the probe launch options modal.
 */
function showProbeModal() {
    document.getElementById('probeModal').style.display = 'block';
    // Pause simulation when modal is shown
    simulationState.paused = true;
    document.getElementById('pauseBtn').textContent = 'Resume'; 
    document.getElementById('statusDot').className = 'status-dot warning';
    document.getElementById('statusText').textContent = 'Simulation Paused (Modal)';

    // Populate the "Launch from Team" dropdown with deployed teams
    const probeTeamSelect = document.getElementById('probeTeamSelect');
    probeTeamSelect.innerHTML = '<option value="" disabled selected>Select Deployed Team</option>'; // Clear existing
    const deployedTeams = simulationState.interceptTeams.filter(team => team.isDeployed && team.targetTornado);
    deployedTeams.forEach(team => {
        const option = document.createElement('option');
        option.value = team.id;
        option.textContent = `${team.teamData.name} (Tornado ${team.targetTornado.id.toString().slice(-4)})`;
        probeTeamSelect.appendChild(option);
    });

    // Enable/disable "Launch from Team" button based on deployed teams
    document.getElementById('launchFromTeamBtn').disabled = deployedTeams.length === 0;

    document.getElementById('probeModal').style.display = 'block'; // Ensure modal is visible
}

/**
 * Hides the probe launch options modal.
 */
function hideProbeModal() {
    document.getElementById('probeModal').style.display = 'none';
    // Resume simulation when modal is hidden
    simulationState.paused = false;
    document.getElementById('pauseBtn').textContent = 'Pause';
    document.getElementById('statusDot').className = 'status-dot';
    document.getElementById('statusText').textContent = 'Simulation Active';
}

/**
 * Shows the full ability list modal.
 */
function showFullAbilityListModal() {
    document.getElementById('fullAbilityListModal').style.display = 'block';
    // Pause simulation when modal is shown
    simulationState.paused = true;
    document.getElementById('pauseBtn').textContent = 'Resume'; // Update pause button text
    document.getElementById('statusDot').className = 'status-dot warning';
    document.getElementById('statusText').textContent = 'Simulation Paused (Modal)';
}

/**
 * Hides the full ability list modal.
 */
function hideFullAbilityListModal() {
    document.getElementById('fullAbilityListModal').style.display = 'none';
    // Resume simulation when modal is hidden
    simulationState.paused = false;
    document.getElementById('pauseBtn').textContent = 'Pause';
    document.getElementById('statusDot').className = 'status-dot';
    document.getElementById('statusText').textContent = 'Simulation Active';
}

/**
 * Initiates the process of deploying an intercept team by setting `awaitingTeamTarget` flag.
 */
function deploySelectedTeam() {
    if (simulationState.selectedTeamForDeployment === null || simulationState.selectedTeamForDeployment === '') {
        createAlert('No Team Selected', 'Please select a team from the dropdown first.', 'warning');
        return;
    }
    if (simulationState.teamPool[simulationState.selectedTeamForDeployment].currentCount <= 0) {
        createAlert('No Teams Available', `All ${INTERCEPT_TEAMS_DATA[simulationState.selectedTeamForDeployment].name} teams are currently deployed or unavailable.`, 'warning');
        return;
    }
    const activeTornadoes = simulationState.tornadoes.filter(t => t.isActive);
    if (activeTornadoes.length === 0) {
        createAlert('No Tornadoes', 'No active tornadoes to deploy to. Spawn one first!', 'warning');
        return;
    }

    simulationState.awaitingTeamTarget = true;
    updateControlButtonsState(); // Update cursor and hint text
}

/**
 * Cancels the intercept team target selection mode.
 */
function cancelTeamTargetSelection() {
    simulationState.awaitingTeamTarget = false;
    updateControlButtonsState(); // Reset cursor and hint text
}

/**
 * Displays the next active tornado's stats in the info box.
 * Loops to the last if at the beginning.
 */
function displayNextTornado() {
    const activeTornadoes = simulationState.tornadoes.filter(t => t.isActive);
    if (activeTornadoes.length === 0) {
        simulationState.activeTornadoDisplayIndex = 0;
        updateDataPanel(); // Hide box if no tornadoes
        return;
    }

    simulationState.activeTornadoDisplayIndex = (simulationState.activeTornadoDisplayIndex + 1) % activeTornadoes.length;
    updateDataPanel(); // Re-render with the new tornado's data
}

/**
 * Displays the previous active tornado's stats in the info box.
 * Loops to the last if at the beginning.
 */
function displayPreviousTornado() {
    const activeTornadoes = simulationState.tornadoes.filter(t => t.isActive);
    if (activeTornadoes.length === 0) {
        simulationState.activeTornadoDisplayIndex = 0;
        updateDataPanel(); // Hide box if no tornadoes
        return;
    }

    simulationState.activeTornadoDisplayIndex = (simulationState.activeTornadoDisplayIndex - 1 + activeTornadoes.length) % activeTornadoes.length;
    updateDataPanel(); // Re-render with the new tornado's data
}

// Add keyboard event listener for arrow keys
document.addEventListener('keydown', (event) => {
    // Check if the event target is inside the tornado info box to prevent double-handling
    // Or if any modal is open, or simulation paused
    if (event.target.closest('.tornado-info') || simulationState.paused || document.getElementById('helpModal').style.display === 'block' || document.getElementById('probeModal').style.display === 'block' || document.getElementById('fullAbilityListModal').style.display === 'block') {
        return; // Do not process keydown if clicking inside info box, or if a modal is open, or paused
    }

    if (event.key === 'ArrowRight') {
        displayNextTornado();
    } else if (event.key === 'ArrowLeft') {
        displayPreviousTornado();
    }
});

// --- Main Simulation Loop ---
let animationFrameId; // Stores the ID of the current animation frame request

/**
 * The main animation loop.
 * Calls update and draw methods for all simulation elements.
 */
function animate() {
    // Set global alpha to 1.0 at the start of each frame to ensure full visibility
    ctx.globalAlpha = 1.0; 

    // Update simulation time
    if (!simulationState.paused) {
        simulationState.time += simulationState.simSpeed;
    }

    // Handle tornado warning sounds
    handleTornadoWarningSounds();

    // Auto-run: Spawn supercells if map is empty for too long
    if (simulationState.autoRun) {
        const activeElementsCount = simulationState.storms.length + simulationState.tornadoes.length;
        if (activeElementsCount === 0 && (simulationState.time - simulationState.lastStormActivityTime) >= AUTORUN_SPAWN_COOLDOWN_FRAMES) {
            spawnSupercell(true); // Spawn supercell in auto-run mode
            simulationState.lastStormActivityTime = simulationState.time; // Reset activity time
        }
    }


    // Auto-deploy teams if enabled
    if (simulationState.autoRun && simulationState.time >= simulationState.autoDeployCooldown) {
        // Filter active tornadoes to only include those not already targeted by a team
        const availableTornadoes = simulationState.tornadoes.filter(t => t.isActive && !isTornadoAlreadyTargeted(t.id));

        if (availableTornadoes.length > 0) {
            const availableTeamIds = Object.keys(simulationState.teamPool).filter(teamId => {
                return simulationState.teamPool[teamId].currentCount > 0;
            });

            if (availableTeamIds.length > 0) {
                const teamToDeployId = availableTeamIds[Math.floor(Math.random() * availableTeamIds.length)];
                const targetTornado = availableTornadoes[Math.floor(Math.random() * availableTornadoes.length)];
                
                // Create and deploy the team
                const newTeam = new InterceptTeam(teamToDeployId, targetTornado.id); // Pass targetTornado.id
                simulationState.interceptTeams.push(newTeam);
                simulationState.teamPool[teamToDeployId].currentCount--; // Decrement count from pool
                
                createAlert('Auto-Deploy', `${INTERCEPT_TEAMS_DATA[teamToDeployId].name} auto-deployed to Tornado ${targetTornado.id.toString().slice(-4)}.`, 'info');
                
                // Set auto-deploy cooldown after a successful auto-deployment (general cooldown)
                simulationState.autoDeployCooldown = simulationState.time + 120; // 2 seconds cooldown for *any* auto-deployment
            }
        }
    }

    // Auto-launch probes
    if (simulationState.autoRun && simulationState.time >= simulationState.nextAutoProbeTime) {
        const hasActiveProbe = simulationState.probes.some(p => p.isActive);
        const hasActiveTornado = simulationState.tornadoes.some(t => t.isActive);

        if (!hasActiveProbe && hasActiveTornado) {
            // First, try to launch from a deployed team
            const deployedTeamsWithTargets = simulationState.interceptTeams.filter(t => t.isDeployed && t.targetTornado && t.targetTornado.isActive);
            if (deployedTeamsWithTargets.length > 0) {
                const teamForProbe = deployedTeamsWithTargets[0]; // Pick the first deployed team
                launchProbeFromTeam(teamForProbe.id, teamForProbe.targetTornado.id);
            } else {
                // Fallback to launching normally from a corner
                launchProbeNormally(); 
            }
            // Set next probe launch time (5-15 seconds in frames)
            simulationState.nextAutoProbeTime = simulationState.time + (300 + Math.random() * 600);
        } else if (!hasActiveTornado) {
             // If no active tornadoes, reset probe timer for next cycle without launching
             simulationState.nextAutoProbeTime = simulationState.time + 300; // Wait 5 seconds
        }
    }

    // Team Refill Logic
    if (simulationState.time >= simulationState.nextRefillTime) {
        for (const teamId in simulationState.teamPool) {
            simulationState.teamPool[teamId].currentCount = simulationState.teamPool[teamId].maxCount;
        }
        createAlert('Team Refill', 'All intercept teams have been replenished to max capacity!', 'info');
        // Set next refill time randomly between 3-5 minutes
        const minRefillFrames = 3 * 60 * 60; // 3 minutes * 60 seconds/min * 60 frames/sec
        const maxRefillFrames = 5 * 60 * 60; // 5 minutes * 60 seconds/min * 60 frames/sec
        simulationState.nextRefillTime = simulationState.time + minRefillFrames + Math.random() * (maxRefillFrames - minRefillFrames);
    }

    // Update immersive effects intensities
    const strongestTornado = simulationState.tornadoes.find(t => t.isActive && t.windSpeed > EF_WIND_RANGES[0].min);
    if (strongestTornado) {
        const targetRainIntensity = strongestTornado.windSpeed / EF_WIND_RANGES[5].max;
        simulationState.currentRainIntensity += (targetRainIntensity - simulationState.currentRainIntensity) * 0.01 * simulationState.simSpeed;
        simulationState.currentRainIntensity = Math.min(1, simulationState.currentRainIntensity);

        const targetHailIntensity = (strongestTornado.phase === TORNADO_PHASES.MATURE && (strongestTornado.efRating >= 4)) ? 
                                     (strongestTornado.windSpeed / EF_WIND_RANGES[5].max) : 0;
        simulationState.currentHailIntensity += (targetHailIntensity - simulationState.currentHailIntensity) * 0.02 * simulationState.simSpeed;
        simulationState.currentHailIntensity = Math.min(1, simulationState.currentHailIntensity);

        const targetWindyIntensity = (strongestTornado.windSpeed / EF_WIND_RANGES[5].max) * 1.5;
        simulationState.currentWindyIntensity += (targetWindyIntensity - simulationState.currentWindyIntensity) * 0.02 * simulationState.simSpeed;
        simulationState.currentWindyIntensity = Math.min(1.0, simulationState.currentWindyIntensity);

        simulationState.currentMistyIntensity = simulationState.currentRainIntensity;
        // Screen shake intensity is updated in the tornado's update method, here we just ensure it fades if no tornado is strong
    } else {
        simulationState.currentRainIntensity *= 0.99;
        simulationState.currentHailIntensity *= 0.98;
        simulationState.currentWindyIntensity *= 0.98;
        simulationState.currentMistyIntensity *= 0.99;
        simulationState.screenShakeIntensity *= 0.95; // Screen shake naturally decays
    }
    simulationState.currentRainIntensity = Math.max(0, simulationState.currentRainIntensity);
    simulationState.currentHailIntensity = Math.max(0, simulationState.currentHailIntensity);
    simulationState.currentWindyIntensity = Math.max(0, simulationState.currentWindyIntensity);
    simulationState.currentMistyIntensity = Math.max(0, simulationState.currentMistyIntensity);
    simulationState.screenShakeIntensity = Math.max(0, simulationState.screenShakeIntensity); // Ensure shake doesn't go below 0

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw immersive effects (order matters for layering)
    drawWindyEffect(); // Draw wind lines first
    drawRain();
    drawHail(); // Draw hail after rain
    drawMistyEffect(); // Draw mist after rain

    // Update and draw storm cells
    simulationState.storms = simulationState.storms.filter(storm => {
        if (storm.intensity > 0.01) {
            return true;
        } else {
            return false;
        }
    });
    simulationState.storms.forEach(storm => {
        storm.update();
        storm.draw();
    });

    // Update and draw tornadoes
    simulationState.tornadoes = simulationState.tornadoes.filter(tornado => {
        if (!tornado.isActive && (tornado.fadeTimer === undefined || tornado.fadeTimer <= 0)) {
            if (!tornado.statsUpdated) {
                simulationState.statistics.longestTrack = Math.max(simulationState.statistics.longestTrack, tornado.pathLength);
                tornado.statsUpdated = true;
            }
            if (!simulationState.isCAPERandomizing) {
                randomizeCAPE();
                simulationState.isCAPERandomizing = true;
            }
            return false;
        }
        return true;
    });
    simulationState.tornadoes.forEach(tornado => {
        tornado.update();
        tornado.draw();
    });

    // Update and draw probes
    simulationState.probes = simulationState.probes.filter(probe => {
        probe.update();
        probe.draw();
        if (probe.intercepted) {
            probe.displayDataTimer--;
            if (probe.displayDataTimer <= 0) {
                if (!simulationState.autoRun) {
                    document.getElementById('launchProbeBtn').disabled = false;
                }
                clearProbeData();
                return false;
            }
        }
        return probe.isActive;
    });

    // Update and draw intercept teams
    // Only keep teams in the array if they are still active (not 'RETURNING' and not completely at base) or 'LOFTED'
    simulationState.interceptTeams = simulationState.interceptTeams.filter(team => {
        team.update();
        team.draw();
        // Remove team from array only when it's isActive is false (meaning it's returned to base or lost)
        return team.isActive; 
    });


    // Lightning update
    const activeTornadoCount = simulationState.tornadoes.filter(t => t.isActive).length;
    if (activeTornadoCount > 0 && simulationState.time >= simulationState.nextLightningStrikeTime) {
        triggerLightningStrike();
        simulationState.nextLightningStrikeTime = simulationState.time + (LIGHTNING_MIN_INTERVAL_FRAMES + Math.random() * (LIGHTNING_MAX_INTERVAL_FRAMES - LIGHTNING_MIN_INTERVAL_FRAMES)) / simulationState.simSpeed;
    }
    if (simulationState.lightningFlash > 0) {
        simulationState.lightningFlash -= LIGHTNING_FLASH_DECAY * simulationState.simSpeed;
        simulationState.lightningFlash = Math.max(0, simulationState.lightningFlash);
    }
    
    if (simulationState.lightningFlash > 0) {
        drawLightning(
            Math.random() * canvas.width,
            Math.random() * canvas.height,
            simulationState.lightningFlash
        );
    }

    // Apply screen shake
    shakeScreen();

    // Draw visualization overlays
    drawWindVectors();
    drawVorticityField();
    drawRadar();

    // Update UI elements
    updateDataPanel();
    updateSliderDisplays();

    // Continue animation loop
    animationFrameId = requestAnimationFrame(animate);
}

/**
 * This function is called when any slider input changes.
 * It updates the `simulationState` and refreshes the UI displays.
 */
function updateSimulation() {
    // Read current values from all slider inputs and update simulationState
    // Convert Fahrenheit to Celsius for internal calculations
    simulationState.surfaceTemp = fahrenheitToCelsius(parseFloat(document.getElementById('surfaceTemp').value));
    simulationState.upperTemp = fahrenheitToCelsius(parseFloat(document.getElementById('upperTemp').value));
    simulationState.humidity = parseFloat(document.getElementById('humidity').value);
    simulationState.windShear = parseFloat(document.getElementById('windShear').value);
    simulationState.surfacePressure = parseFloat(document.getElementById('surfacePressure').value);
    simulationState.stormMotion = parseFloat(document.getElementById('stormMotion').value);
    simulationState.lowLevelJet = parseFloat(document.getElementById('lowLevelJet').value);
    simulationState.simSpeed = parseFloat(document.getElementById('simSpeed').value);

    // Re-adjust tornado movement speed immediately if stormMotion changes
    simulationState.tornadoes.forEach(t => t.speed = simulationState.stormMotion * 0.01);

    updateSliderDisplays(); // Update slider value labels
    updateDataPanel();      // Refresh all data displays
}

// --- Initialization ---
// Ensures the animation loop starts only after the window has fully loaded.
window.onload = function () {
    // Assign elements here, ensuring they are loaded
    canvas = document.getElementById('simulationCanvas');
    ctx = canvas.getContext('2d');
    radarCanvas = document.getElementById('radarCanvas');
    radarCtx = radarCanvas.getContext('2d');
    simulationAreaDiv = document.getElementById('simulationArea');

    // Add event listeners for interaction
    simulationAreaDiv.addEventListener('click', handleSimulationAreaClick);
    simulationAreaDiv.addEventListener('mousemove', handleSimulationAreaMouseMove);
    simulationAreaDiv.addEventListener('contextmenu', handleSimulationAreaRightClick); // Add right-click listener

    resizeCanvas(); // Set initial canvas size and base locations
    
    // Set default checkbox states
    document.getElementById('showWindVectors').checked = true; // Set to checked by default
    document.getElementById('simSpeed').value = 0.8; // Set default simulation speed to 0.8x
    document.getElementById('showMistyEffect').checked = false; // Unchecked by default
    document.getElementById('showVorticity').checked = false; // Set to unchecked by default as requested

    // Set initial refill time for the first refill to happen randomly (3-5 minutes)
    const minRefillFrames = 3 * 60 * 60; // 3 minutes * 60 seconds/min * 60 frames/sec
    const maxRefillFrames = 5 * 60 * 60; // 5 minutes * 60 seconds/min * 60 frames/sec
    simulationState.nextRefillTime = simulationState.time + minRefillFrames + Math.random() * (maxRefillFrames - minRefillFrames);

    // Initialize CAPE on load to a random value within the range (0-5000 J/kg)
    // This ensures the first tornado spawns with a randomized CAPE.
    simulationState.targetCAPE = MIN_CAPE + Math.random() * (MAX_CAPE - MIN_CAPE);
    simulationState.initialCAPEDuringTransition = simulationState.targetCAPE; // Start at target for first frame

    updateSimulation(); // Set initial values and update displays (moved after setting default states and CAPE)
    animate(); // Start the main animation loop
    clearProbeData(); // Initialize probe data display
    updateControlButtonsState(); // Set initial button states
};
