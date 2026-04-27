# ShopMetrics-AI
BI predictivo para Retail. Usa IA para segmentar clientes, predecir fugas y pronosticar ventas. Incluye un chatbot IA como copiloto estratégico que interpreta tu dashboard, aconseja y genera reportes de mejora al instante.

## Cómo ejecutar el proyecto en tu entorno local

Este proyecto está dividido en dos partes principales: un **Backend** (API en Python/Flask) y un **Frontend** (Interfaz web). Para que funcione correctamente, debes ejecutar ambos de forma simultánea.

### Paso 1: Instalar dependencias
Asegúrate de tener instalado Python. Abre una terminal en la raíz del proyecto y ejecuta el siguiente comando para instalar las librerías necesarias:

```cmd
pip install flask flask-cors pandas scikit-learn numpy joblib prophet
```

### Paso 2: Iniciar el Backend (Servidor de Inteligencia Artificial)
En la terminal, navega a la carpeta `BackendDashboard` y corre el servidor principal:

```cmd
cd BackendDashboard
python app.py
```
> **Nota:** Esto levantará el servidor en `http://localhost:5050`. Debes dejar esta ventana de terminal abierta corriendo en segundo plano.

### Paso 3: Iniciar el Frontend (Interfaz Visual)
Los archivos del frontend utilizan rutas absolutas para sus recursos (CSS/JS). Por ello, debes usar un servidor local para visualizarlos correctamente.

Abre una **NUEVA pestaña o ventana de terminal** y ejecuta:

```cmd
cd frontend
python -m http.server 8000
```
> **Alternativa:** Si usas Visual Studio Code, puedes hacer clic derecho en `frontend/index.html` y seleccionar **"Open with Live Server"**.

### Paso 4: Usa la plataforma
* Ve a tu navegador web favorito y accede a: **[http://localhost:8000](http://localhost:8000)** (o al puerto que te asigne Live Server).
* Ya puedes comenzar subiendo los datasets de prueba (por ejemplo, los disponibles en la carpeta `data/`) a través de la interfaz visual.

---
