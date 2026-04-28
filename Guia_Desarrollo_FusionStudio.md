# Guía de Arquitectura y Desarrollo de Fusion Studio (v26.0)

¡Hola! Has hecho un trabajo increíble sacando adelante **Fusion Studio** a base de "vibecoding" y prompts. Es normal que ahora quieras dar un paso atrás y entender exactamente cómo está estructurado todo esto. 

El objetivo de este documento es explicarte **de pe a pa**, con un lenguaje claro, cómo funciona el código, por qué está organizado así, y los conceptos teóricos básicos que rigen la aplicación. De este modo, pasarás de ser un "copiador de código" a un desarrollador capaz de entender, modificar y evolucionar tu propio proyecto.

---

## 1. Conceptos Básicos: ¿Qué es una App de Escritorio Moderna?

Cuando programamos una aplicación de escritorio (como Fusion Studio), nuestro mayor enemigo es que la aplicación "se quede congelada" (Not Responding) mientras procesa datos. Para evitar esto, utilizamos una arquitectura que separa lo visual (la interfaz) del trabajo pesado (el motor o lógica).

### 1.1 El Patrón de Separación (UI vs Lógica)
Imagina un restaurante.
- **UI (User Interface)**: Son los camareros, las mesas, el menú. Es lo que el usuario ve y con lo que interactúa. Pide un plato (hace clic en un botón).
- **Core / Lógica**: Es la cocina. Es donde ocurren los cálculos pesados (procesar un archivo `.mf4` gigante).
- **Signals/Slots (Eventos)**: Son las comandas. El camarero envía la comanda a la cocina (Signal). Cuando el chef termina, avisa con una campana al camarero (Signal) de que la comida está lista (Slot) para entregarla al cliente (actualizar la barra de progreso de la pantalla).

### 1.2 PySide6 y la Programación Orientada a Objetos
Estás usando **PySide6** (Qt para Python). Qt define cualquier elemento de la pantalla (un botón, una tabla, toda la ventana) como un **Widget** (`QWidget`).
Para crear la app, utilizamos **Programación Orientada a Objetos (POO)**. Definimos "Clases", que son los planos para construir objetos.
Por ejemplo:
```python
class MainWindow(QMainWindow):
    ...
```
Ahí le estamos diciendo a Python: *"Crea mi ventana principal, y quiero que herede todo lo que sabe hacer una ventana normal (`QMainWindow`), pero le voy a añadir mis propios botones y menús"*.

### 1.3 Concurrencia (Los Hilos o Threads)
Si el camarero (la UI) se pone a cocinar el plato (procesar un `.mf4` de 5GB), nadie más en el restaurante va a ser atendido y la app dirá "No responde".
Para evitarlo, la cocina trabaja en **Hilos de Segundo Plano (`QThread`)**. Mientras el Core procesa el archivo silenciosamente en su propio hilo, la UI queda libre en el hilo principal para actualizar las barras de progreso o dejarte navegar por otras pestañas.

---

## 2. La Arquitectura de Fusion Studio

Tu proyecto tiene una estructura perfectamente profesional. Vamos a abrir el capó y ver qué hay dentro de `src/`:

### 📂 `src/ui/` (La Fachada o Frontend)
Aquí está todo lo que pinta cosas en pantalla.

*   `main_window.py`: Es el jefe visible. Carga la ventana principal (el header con el logo de IDIADA, la barra lateral para cambiar de pestañas, el footer con los créditos). Orquesta a los demás widgets.
*   `analysis_widget.py`, `classification_widget.py`, `reporting_widget.py`: Son las "pantallas" o pestañas que aparecen dentro de la ventana principal. En vez de poner todo el código en el `main_window`, está separado aquí para mantener el orden. Por ejemplo, `analysis_widget` dibuja por sí solo las tablas de reglas ("Gauge Rules") o las gráficas (`PyQtGraph`).
*   `widgets.py`: Aquí has encapsulado componentes visuales pequeños y reusables (Spinners de carga, el `ExpandableSidebar`, los Switches tipo iOS `AnimatedToggle`, etc.).
*   `styles.py`: Contiene el CSS (u hojas de estilo de Qt) global, defininiendo colores como el `IDIADA_ORANGE`.

### 📂 `src/core/` (El Motor o Backend)
Aquí no hay colores ni ventanas, todo son matemáticas, archivos y datos puros.

*   `fusion_worker.py`: El corazón inicial. Lee los `.mf4`, busca eventos (fatiga/distracción), *recorta* los canales, cruza los datos de los diferentes archivos por tiempos, y copia los videos correspondientes (`.avi`). Para no bloquear la UI, hereda de `QThread`.
*   `dsm_processor.py` y `excel_exporter.py`: Extraen reportes, cogen la información procesada y la vuelcan a plantillas Excel estructuradas siguiendo tu lógica.
*   `audio_analysis.py`: Ejecuta tareas de filtrado y detección de picos en audio (`scipy.signal`).
*   `chronos_worker.py` / `chronos_manager.py`: Controlan la gestión y sincronización temporal de ciertos datos del proyecto.
*   `report_builder.py`: Dibuja mediante imágenes `Matplotlib` exportándolas a una vista previa en PNG para la app.

### 📄 `main.py` (El Punto de Partida)
Es extremadamente simple, como tiene que ser. Inicializa el ciclo vital (`QApplication`), ajusta la resolución (`HighDpiScaleFactor`), carga las fuentes personalizadas (Switzer) e invoca a `MainWindow().show()`.

---

## 3. El Flujo de Trabajo (El Viaje del Dato)

Para entenderlo mejor, recorramos cómo viaja el dato cuando un usuario pulsa el botón de "START FUSION":

1.  **La UI registra el Clic:** En `main_window.py`, tienes un botón (`self.btn_run.clicked.connect(self.toggle_fusion_state)`). Esto invoca la función `start_fusion()`.
2.  **Preparativos en el Hilo Principal:** `start_fusion()` recupera de la pantalla los participantes seleccionados, las señales marcadas para filtrar y si hay que sobreescribir. Luego desactiva el botón para que nadie pulse dos veces.
3.  **Encendiendo el Motor:** Se crea el objeto `FusionWorker` (del *core*), pasándole las directrices, y se llama a `self.worker.start()`. ¡Punto Crítico! `start()` envía este trabajador a un hilo paralelo (`QThread`). El hilo principal asume que el trabajo ya está en marcha y sigue a lo suyo.
4.  **Trabajo Pesado (`fusion_worker.py`):**
    *   **Fase 1 (Recortes y Auditoría):** Lee los archivos maestros usando la potente librería `asammdf`. Busca canales tipo `Distraction_type`. Calcula los tiempos de inicio y fin, recorta esos trozos y los guarda temporalmente.
    *   **Fase 2 (Fusión de Satélites):** Si encuentra datos satélite para esos recortes, alinea los "timestamps" (restando el desfase respecto al inicio de la prueba) y agrega (funde) los canales del maestro dentro del archivo del satélite. Para no perder la estructura del satélite original, usa la herramienta `clone_file_metadata`.
    *   **Fase 3 (Videos):** Coge los `.avi` detectados en origen y los reubica en destino.
5.  **Comunicación Continua (Señales):** Mientras la Fase 1, 2 y 3 suceden, el motor grita mensajes: *¡Voy por un 45%! ¡P03 terminado!*. Lo hace definiendo sus Propias Señales (`FusionWorkerSignals`).
    *   Hará cosas como: `self.signals.participant_progress.emit(p_name, 50)`.
    *   Como en la UI definiste: `self.worker.signals.participant_progress.connect(self.on_participant_progress)`, cada vez que el worker grita un número, tu UI actualiza silenciosamente la mini barra verde del participante en el `QTreeWidget`.
6.  **Fin (`fusion_finished`):** Cuando el bucle del `worker` acaba, lanza una señal `finished`. La UI lo detecta, quita la animación del spinner giratorio, y vuelve a poner el botón azul de `START FUSION`.

---

## 4. Analizando y Evolucionando el Código

### La librería ASAMMDF (`from asammdf import MDF`)
Esta librería es vital para la automoción. Extrae señales con `mdf.get("tu_signal")`, y retorna objetos con `timestamps` (un vector de tiempos tipo `[0.0, 0.1, 0.2]`) y `samples` (un vector de valores tipo `[1, 0, 1]`). Las "variables" de coche habitualmente se sincronizan porque comparten sus marcas de tiempo.

### `gc.collect()` (Controlando el Consumo de Memoria)
Verás esto mucho en tus *workers*. Cuando manipulas gigas de datos y extraes recortes de matrices hipermasivas en Python, la memoria RAM puede saturarse. `gc.collect()` llama forzosamente al recolector de basura (*Garbage Collector*) de Python, destruyendo variables temporales que ya no se usan (`del temp_mdf`) y salvando la estabilidad del PC.

### Tu Archivo de Configuración (`assets`/`config`)
Se usa mucho JSON para evitar código fuente muy largo o inentendible. Cosas como `marks.json` o `gauge_rules.json` en tu pestaña de Analysis. `json.load()` transforma un texto puro en un Diccionario de Python (`{"clave": "valor"}`) en microsegundos, para chequear que los participantes cumplen con las condiciones de los test.

## 5. Próximos Pasos para Seguir Aprendiendo

Como ves, aunque has estado prompteando, la estructura resultante es de una calidad excepcional: **arquitectura modular M-V-C** (Modelo-Vista-Controlador encubierto), manejo estricto de hilos de sistema con **Qt**, y procesamiento hiper-eficiente con matrices **Numpy**. 

Si quieres empezar a "entrar de fondo" sin promptear:
- Modifica algún color o animación primero en **`ui/widgets.py`** (por ejemplo, el radio del *FadeNotification*).
- Cambia qué campos loguear de los eventos en **`fusion_worker.py`** (prueba a loguear si `len(vals) > 10000 muestras`).
- Usa muchos *`print(...)`* en los métodos oscuros para ver realmente cómo están estructurados los diccionarios o listas matemáticas cuando se manipulan.
