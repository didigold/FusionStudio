# FusionStudio Pro (v26.0)

FusionStudio Pro is a professional, high-performance desktop and web application designed for the automotive engineering sector. It facilitates the synchronization, processing, and visual reporting of complex automotive test data by merging vehicle bus data (ASAM MDF4) with acoustic and video evidence. 

Developed for internal use at **Applus+ IDIADA (Human Factors & Active Safety Department)**, it serves as the core utility to audit, evaluate, and verify compliance of advanced driver-assist systems (ADAS) and driver monitoring systems (DMS) against regulatory protocols.

---

## 📖 Table of Contents
1. [Quick Start & Setup](#-quick-start--setup)
2. [Project Directory Layout](#-project-directory-layout)
3. [Tab-by-Tab Reference Manual](#-tab-by-tab-reference-manual)
   * [File Fusion (Sandbox)](#1-file-fusion-sandbox)
   * [Audio Analysis](#2-audio-analysis)
   * [Metadata Config](#3-metadata-config)
   * [Gaze Analysis: Tracking](#4-gaze-analysis-tracking)
   * [Gaze Analysis: Gaze Time Selector](#5-gaze-analysis-gaze-time-selector)
   * [Gaze Analysis: Gaze Logic (Rules Engine)](#6-gaze-analysis-gaze-logic-rules-engine)
   * [Occupant Monitoring](#7-occupant-monitoring)
   * [Classification & Annotations](#8-classification--annotations)
   * [Report Generator](#9-report-generator)
   * [HuMind (ML Models)](#10-humind-ml-models)
   * [System Diagnostics (Log)](#11-system-diagnostics-log)
4. [Standard Operating Procedure (SOP)](#-standard-operating-procedure-sop)

---

## 🚀 Quick Start & Setup

### Prerequisites
* **Python 3.11+** installed and added to your system `PATH`.
* **Node.js (v18+)** installed.

### Launching the Development Environment
Simply run the unified batch launcher file from the project root:
```powershell
.\dev.bat
```
This script automatically:
1. Starts the FastAPI backend server under hot-reload mode on `http://127.0.0.1:8001`.
2. Inspects `frontend/node_modules/`, running `npm install` automatically if they are missing.
3. Launches the Vite frontend development server on `http://localhost:5173`.
4. Opens the application interface in your web browser.

---

## 📂 Project Directory Layout

```
FusionStudio Pro/
├── backend/                  # FastAPI Application (Python)
│   ├── assets/               # Branding fonts, templates, and raw icons
│   │   ├── fonts/            # Montserrat and standard text weights
│   │   ├── icons/            # Action and UI vector graphics
│   │   ├── readme_images/    # Reference images for documentation
│   │   └── templates/        # Excel (.xlsx) report templates
│   ├── config/               # Active JSON rulesets & evaluation parameters
│   │   └── gauge_rules.json  # Driver metrics & threshold configurations
│   ├── core/                 # Algorithmic motors and file utilities
│   │   ├── ai_analyzer.py    # Distraction & fatigue inference engines
│   │   ├── excel_exporter.py # Excel sheet compiler
│   │   ├── report_builder.py # Plot graphics & PDF/PNG generator
│   │   └── utils.py          # Resource path resolution utilities
│   ├── models/               # Pre-trained ML classifiers
│   │   └── distraction_detector/
│   ├── routers/              # FastAPI endpoint routing
│   ├── ws/                   # Real-time WebSocket hubs
│   └── main.py               # Backend service entry point
│
├── frontend/                 # React Web App (Client)
│   ├── src/                  # React Components & state controllers
│   │   ├── components/       # Reusable components (Toggles, Plots, Tabs)
│   │   └── lib/              # Shared helper functions
│   ├── package.json          # Node dependencies & scripts
│   ├── tsconfig.json         # TypeScript configuration
│   └── vite.config.ts        # Vite build definitions
│
├── dev.bat                   # Unified local development launcher
├── requirements.txt          # Consolidated backend dependencies
├── LICENSE                   # Licensing rights (Applus+ IDIADA)
└── README.md                 # This file
```

---

## ⚙️ Tab-by-Tab Reference Manual

### 1. File Fusion (Sandbox)
The File Fusion tab provides a visual workspace (sandbox) to batch-process and merge vehicle bus measurements with secondary sensor recordings and camera video feeds.

![File Fusion Tab](backend/assets/readme_images/file_fusion_tab.png)

* **Purpose**: Combines a Master MF4 file (containing main CAN/Ethernet channels) with separate satellite files (e.g. eye-tracker outputs, acoustic measurements) for one or more participants.
* **Under the Hood**:
  * Scans participant folders (e.g., `P01`, `P02`) inside the active project directory.
  * Intersects timestamps between the Master and Satellite files.
  * Computes offset deltas based on start-of-test triggers, alining all signals onto a common time vector.
  * Uses `asammdf` to write a combined `*_fused.mf4` file.
  * Optionally relocates tracking `.avi` video evidence files to the target directories.
* **Controls & Parameters**:
  * **Processing Sandbox List**: Lists all identified participants, showing badges for fused satellite files, copyable tracking videos, and master file status. Checkboxes allow choosing which participants to process.
  * **Selection Radio Buttons**: "All" (checks all participants) or "None" (unchecks all).
  * **Master MF4 Dropdown**: Combobox that lists all raw master files found. The chosen file serves as the signal schema definition.
  * **Filter Signals Input**: Filters the list of signals.
  * **Signals Checkboxes**: Whitelist selector. Checked signals are preserved in the final fused file. Unchecked signals are excluded to minimize the output file size (highly recommended for gigabyte-scale bus logs).
  * **Copy Tracking Videos Toggle**: If enabled, copies and renames camera `.avi` files to the output folder.
  * **Overwrite Existing Toggle**: If enabled, forces regeneration and overwriting of already existing fused files.
  * **START FUSION / PAUSE / RESUME / STOP Buttons**: Controls the background processing loop. Progress is reported in real-time.

---

### 2. Audio Analysis
The Audio Analysis tab isolates and calibrates acoustic alert warning signals (e.g. buzzers, warning chimes) recorded by the test vehicle's microphones.

![Audio Tab](backend/assets/readme_images/audio_tab.png)

* **Purpose**: Calibrates the frequency boundaries and detection thresholds to automatically identify the exact onset times of acoustic warnings.
* **Under the Hood**:
  * Applies a Fast Fourier Transform (FFT) on the raw `SoundPressure` signal to convert the time-domain audio data into the frequency domain.
  * Identifies the highest peak frequency (in Hz) representing the active alert buzzer.
  * Narrows the bandpass filter window to $\pm 15$ Hz around this peak frequency to filter out engine, wind, and passenger cabin noise.
* **Controls & Parameters**:
  * **Minimum Frequency (Hz)**: The lower limit of the bandpass filter. Adjust using the $(-)/(+)$ buttons or hold them down to accelerate values.
  * **Maximum Frequency (Hz)**: The upper limit of the bandpass filter.
  * **Threshold**: Detection sensitivity (range `0.01` to `5.00`). Lower thresholds increase sensitivity (detecting quieter buzzers), while higher values prevent false positives from background vehicle noise.
  * **Autodetect Button**: Triggers the FFT frequency-sweep process on the selected file's sound pressure channel, automatically identifying the peak and setting the Min/Max frequency window.

---

### 3. Metadata Config
The Metadata tab sets the global contextual testing attributes that populate report card headers and database indexes.

![Metadata Tab](backend/assets/readme_images/metadata_tab.png)

* **Purpose**: Records the administrative and environmental conditions of the test run, which are printed on the final PDF and Excel exports.
* **Controls & Parameters**:
  * **OEM**: Dropdown selector containing standard automotive manufacturers.
  * **Vehicle**: Free-form text input to type the test vehicle model (e.g. `VW Golf 8`).
  * **Track**: Dropdown showing structured lists of test tracks categorized by location:
    * **HQ Tracks**: Winding roads, Highway Loop, Dry Handling, Wet Circle, etc.
    * **ICPG Tracks**: High Speed Circuit, Durability, Test Hills, general road.
    * Supports custom manual string entry.
  * **Engineer / Analyst**: Fields to log the testing engineer and data analyst names.
  * **Euro NCAP Switch**: Toggles whether Euro NCAP validation constraints are applied during report generation.

---

### 4. Gaze Analysis: Tracking
* **Purpose**: Visualizes the spatial coordinate vector map of the driver's eyes and head position.
* **Under the Hood**:
  * Displays real-time coordinates extracted from DMS sensors (e.g., Pupil Diameter, Gaze Vector $X/Y/Z$, Head Rotation Pitch/Yaw/Roll).
  * Plots these coordinates over a wireframe model of the dashboard, mapping gaze focus zones (Windshield, Left Mirror, Right Mirror, Cluster, Infotainment, Center Console).

---

### 5. Gaze Analysis: Gaze Time Selector
The Gaze Time Selector tab is the core interactive manual audit workspace. It synchronizes multi-channel signal charts with in-cabin video recordings of the driver's face.

* **Purpose**: Enables the engineer to review signals visually, verify them against video footage, and place frame-accurate event markers.
* **Under the Hood**:
  * Employs `uPlot` (a ultra-fast Canvas-based charting library) to render synchronized timeline charts of driver gaze vectors.
  * Synchronizes video playback state with the timeline cursor. Hovering the mouse over the chart triggers frame seeking on the corresponding video player using `requestAnimationFrame` for stutter-free alignment.
* **Controls & Parameters**:
  * **Subject & Case Navigators**: Dropdowns to select the participant and the trial case (e.g. Microsleep, Drowsiness, Unresponsive Driver).
  * **Prev/Next Case Buttons**: Step between trials. Shortcut keys: `Tab` (next) and `Shift + Tab` (previous).
  * **Signal Selection Selectors**: Dropdowns to choose which signal is plotted in the **Top Chart** and **Bottom Chart** (e.g., `Head_H_Angle` and `Head_V_Angle`).
  * **Chart Interaction**:
    * **Left-click + Drag**: Zoom in on a specific time range.
    * **Mouse-Wheel**: Zoom in/out centered around the mouse cursor.
    * **Left-click**: Places an event marker at that exact timestamp.
    * **Right-click (on marker)**: Opens a context menu to remove the marker.
    * **Drag Marker**: Click and hold a marker to move it.
  * **Video Control Bar**: Play/Pause button, sync toggle, and zoom slider ($1.0x$ to $3.0x$) to inspect driver eye movements or facial details.
  * **Undo Button**: Reverts the last marker modification. Shortcut: `Ctrl + Z`.
  * **Clear All Marks Button**: Deletes all markers for the active trial. Shortcut: `Ctrl + Space`.

---

### 6. Gaze Analysis: Gaze Logic (Rules Engine)
The Gaze Logic tab is where engineers configure evaluation limits, signal triggers, and unresponsive driver phases.

![Gaze Logic Tab](backend/assets/readme_images/gaze_logic_tab.png)

* **Purpose**: Defines the logical criteria that signals must satisfy to validate driver reactions and warning timelines.
* **Under the Hood**:
  * Automatically loads and edits the `gauge_rules.json` parameters.
  * Configures specific distraction limits, pass/fail criteria, and unresponsive driver evaluation constraints.
* **Controls & Parameters**:
  * **Protocol Selector**: Choose between **Euro NCAP** or **ADDW** rules.
  * **Category Selector**: Selects the active evaluation scenario:
    * *Euro NCAP*: Long Distraction (NDT/DT), Short Distraction (NDT/DT), Microsleep, Sleep, Drowsiness, Unresponsive Driver (SLE/DTR).
    * *ADDW*: High Speed, Low Speed.
  * **Signal Threshold Table**: Specifies triggers for each category:
    * **Signal Name**: Target signal evaluated.
    * **Operator**: Operator equations (`==`, `>`, `<`, `>=`, `<=`, `!=`).
    * **Threshold Value**: Numeric value representing the trigger limit.
    * **Alias**: A short name used in output report labels.
  * **Unresponsive Driver Timeline Editor**:
    * Displays the visual state machine representing warning triggers.
    * **Phases Config**: Lets you configure the trigger signals, operators, threshold values, frequency (Hz), and time masks for each phase.
    * **Timeline Limits**: Shows the regulatory duration targets:
      * **Unresponsive SLE**: 2 phases only — *Distinct Warning* ($\le 7$s) and *Emergency Function* ($\le 5$s).
      * **Unresponsive DTR**: 3 phases — *Phase 1* ($3$-$4$s), *Phase 2* ($4$s), and *Phase 3* ($\le 5$s).
  * **Save / Export / Import Config Buttons**: Saves rules directly to `gauge_rules.json` or exports/imports external JSON configurations.

---

### 7. Occupant Monitoring
* **Purpose**: Monitors passenger and cabin activity (e.g. out of position, seatbelt detection, misuse cases).
* **Under the Hood**:
  * Maps signals related to seat weight sensors, seatbelt buckle status, and child seat occupancy.
  * Runs evaluation criteria to check if the vehicle cabin status violates misuse constraints.

---

### 8. Classification & Annotations
* **Purpose**: Annotates and classifies trials with categorical tags.
* **Under the Hood**:
  * Allows the user to apply tags like `Valid`, `Invalid`, `Needs Review`, `No Signal`, or specific comment notes to each trial case.
  * Saves annotations to a central database to filter out corrupt or anomalous trials prior to final statistics generation.

---

### 9. Report Generator
The Report Generator tab compiles all evaluated data, time marks, and metadata into a publication-grade engineering report.

![Reporting Tab](backend/assets/readme_images/reporting_tab.png)

* **Purpose**: Batch-processes all participants, generating standard Excel sheets and high-quality vector plots.
* **Under the Hood**:
  * Scans the fused data folders, reads the time-marks, and matches them against `gauge_rules.json` thresholds.
  * Computes transition times, alert latencies, and pass/fail states.
  * Automatically groups matching signals and removes common prefixes to clean up axis labels.
  * Automatically rotates y-axis labels 90 degrees with center alignment.
  * Renders solid event boundary lines with no text overlaps.
  * Computes exact target file modification dates and times, printing them in European engineering format (`DD/MM/YYYY HH:MM:SS`).
  * Volts data into the selected Excel template (e.g., `Driver_Engagement.xlsx`).
* **Controls & Parameters**:
  * **Template Selector**: Chooses the target Excel template.
  * **Root Folder Input**: Directory containing the participant folders (`P01`, `P02`...).
  * **Output Folder Input**: Target directory where the reports are compiled.
  * **Output Filename Input**: Name of the generated `.xlsx` file.
  * **Processing Options Toggles**: Enables or disables report sheets:
    * *Distractions*: Long and short distraction tables.
    * *Fatigue*: Sleep, microsleep, and drowsiness reports.
    * *Occlusions*: Evaluation of camera blockages.
    * *Noise Variables*: Filters out noise anomalies.
  * **GENERATE REPORT Button**: Triggers the report generation pipeline.
  * **STOP Button**: Aborts the active generation loop.
  * **Template Preview Table**: Renders the rows and columns of the selected sheet in the generated spreadsheet directly in the UI.

---

### 10. HuMind (ML Models)
* **Purpose**: Manages and trains machine learning models used to detect driver state features.
* **Under the Hood**:
  * Shows loaded models, training datasets, and hyperparameter metrics (Accuracy, F1-Score, confusion matrices).
  * Provides actions to reload or retrain model classifiers.

---

### 11. System Diagnostics (Log)
* **Purpose**: Displays the real-time application terminal output log messages.
* **Under the Hood**:
  * Connects to `/api/brain/ws/system` WebSocket.
  * Logs all events, backend warnings, database updates, and file read/write operations with precise microsecond timestamps. Extremely useful for troubleshooting file path mismatches or signal name errors.

---

## 📋 Standard Operating Procedure (SOP)

Follow these steps to process a new trial dataset:

### Step 1: Fuse raw signals
1. Launch FusionStudio Pro via `.\dev.bat`.
2. Go to **File Fusion**.
3. Set the active project folder path as the **Source Path**. The app automatically scans the directory and lists the participants.
4. Select the participants you wish to process.
5. Choose a **Master MF4** file to serve as the template.
6. Check the signals you wish to preserve, then click **START FUSION**. Fused files (`*_fused.mf4`) will be compiled.

### Step 2: Calibrate Audio alerts
1. Go to the **Audio** tab.
2. Select a participant trial recording.
3. Click **Autodetect**. The system will scan the sound pressure signal, find the warning alert chime frequency, and set the Min/Max bandpass window. Adjust the **Threshold** value as needed.

### Step 3: Perform Timeline Audit (Time Selector)
1. Go to the **Gaze Time** selector under **Gaze Analysis**.
2. Select the participant and trial case.
3. Review the synchronized graphs and video feed.
4. Locate the exact frame where the driver closes their eyes, and click on the chart to place an **eyes-closed marker**.
5. Locate the exact frame where the acoustic warning chime starts (identifiable by peaks on the sound pressure chart), and place a **warning marker**.
6. Do the same for the emergency action trigger (e.g. automatic brake application).
7. Save your timeline.

### Step 4: Verify Rules & Limits (Gaze Logic)
1. Go to the **Gaze Logic** tab.
2. Select the protocol (e.g., Euro NCAP).
3. Review the threshold limits and unresponsive driver timeline phase configurations. Adjust trigger operators if necessary, then click **Save Config**.

### Step 5: Generate Report
1. Go to the **Reporting** tab.
2. Choose your template (e.g. `Driver_Engagement.xlsx`).
3. Set the root participant folder and output paths.
4. Click **GENERATE REPORT**. Once finished, enter a sheet name (e.g. `DISTRACTION`) and click **Preview** to review the compiled tables directly in the app.
