# Fusion Studio (v26.0)

Fusion Studio is a high-performance desktop application designed for the automotive engineering sector. It facilitates the synchronization, processing, and visualization of complex data sets, merging CAN/Ethernet bus data (MDF4) with audiovisual evidence.

## 🚀 Key Features

**1. Intelligent Data Fusion (Cut & Fuse)**

- **Smart Event Detection:** Automatically identifies events (Distractions, Fatigue, Occlusions) within a Master MF4 file.
- **Precision Cutting:** Slices data segments preserving timestamps and signal integrity.
- **Auto-Synchronization:** Merges vehicle bus data with existing audio recordings, aligning time axes automatically.
- **Smart Resume:** The engine detects previously processed files, skipping redundant operations to save time.

**2. Evidence Management**

- **Video Sync:** Optional module to synchronize and copy `.avi` video evidence files alongside the processed data.
- **Toggle Control:** iOS-style toggle to enable/disable video processing on the fly.

**3. Advanced Visualization**

- **OpenGL Plotting:** High-performance signal viewer powered by `PyQtGraph` and `OpenGL`.
- **Signal Filter:** Gmail-style signal selector to reduce file size by keeping only relevant channels.
- **Drag & Drop:** Intuitive interface to load masters and visualize signals.

**4. Professional UX/UI**

- Dark Mode: Eye-strain reducing interface with Applus+ IDIADA branding (Orange accents).
- Responsive Feedback: Real-time progress bars, logs with timestamps, and visual status indicators for each participant.

## 🛠️ Technical Stack

- **Language:** Python 3.10+
- **GUI Framework:** `PySide6` (Qt for Python)
- **Data Engine:** `asammdf` (ASAM MDF4 standard compliant)
- **Visualization:** `PyQtGraph` (with OpenGL acceleration)
- **Math:** `NumPy`

## 📦 Installation

- Clone the repository to your local machine.
- Install the required dependencies:

```ruby
pip install -r requirements.txt
```

- Run the application:

```ruby
python FusionStudio_PySide6.py
```

## 📂 Project Structure

For the application to function correctly, ensure the `assets` folder is present in the root directory:

```ruby
/FusionStudio
    /assets
        icon.ico            <-- App Icon
        chart.png, folder.png, fuse.png, log.png...
    FusionStudio_PySide6.py
    requirements.txt
    README.md
```

## 📝 License & Attribution

**Developed by:** Dídac Martín Pérez (Human Factors Dept.)
**Copyright:** © 2026 Applus+ IDIADA. All rights reserved.
**Usage:** Internal Use Only.
See `LICENSE_NOTICE.txt` for third-party library attributions.
