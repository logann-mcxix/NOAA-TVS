## NOAA Tornado Visualizer

This project is a web-based simulation for visualizing tornado dynamics, intercept team deployments, and environmental conditions. It features a real-time canvas display, adjustable meteorological parameters, and interactive controls for spawning supercells and managing intercept teams.

### Features

* **Interactive Simulation:** Control the simulation's progress with pause/play, reset, and speed adjustments.
* **Dynamic Weather Parameters:** Adjust surface temperature, upper atmosphere temperature, humidity, wind shear, surface pressure, storm motion, and low-level jet strength.
* **Tornado and Storm Management:**
    * Spawn individual supercells or trigger a tornado outbreak.
    * Visualize tornado characteristics, including intensity, lifespan, and track length.
    * Convective Available Potential Energy (CAPE) intelligently randomizes and smoothly transitions after each tornado dissipates, simulating changing atmospheric dynamics.
* **Intercept Team Operations:**
    * Deploy teams to target active tornadoes, with distinct wind thresholds for "undeployed" and "deployed" states.
    * Teams can enter a "Lofted" state if wind thresholds are exceeded.
    * **Single Team per Tornado:** Only one intercept team can target a given tornado at any time. If a tornado is already targeted (en route, deployed, lofted, or returning), other teams cannot be assigned to it.
    * Teams automatically return to base when their target tornado dissipates or if manually recalled.
    * Team capacity is replenished over time.
* **Probe Launch Options:**
    * Launch probes from a random corner of the map.
    * Launch probes directly from an already deployed intercept team for close-range data collection.
* **Visualizations:** Toggle visibility of wind vectors and a misty effect.

### How to Run

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/logann-mcxix/NOAA-TVS.git
    ```
2.  **Open `index.html`:** Navigate to the cloned directory and open the `index.html` file in your web browser.

### Technologies Used

* HTML5
* CSS3
* JavaScript (ES6+)

---

### License

**MIT License**

Copyright (c) 2025 NOAA Tornado Visualizer Project Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

**Note on Modifications:**
While the MIT License permits modification, this project's intent is to provide a reference for the NOAA Tornado Visualizer. Users are free to clone and utilize the code. However, it is requested that any redistributed modified versions of this software be clearly distinguished from the original "NOAA Tornado Visualizer" project and its official releases.

---

### `.gitignore`
