// Configuración configurable - Gemini API Key (obtén gratis en https://aistudio.google.com/app/apikey)
// Prioridad: localStorage > hardcoded > prompt user
window.GEMINI_API_KEY = localStorage.getItem('gemini_api_key') || 'AIzaSyAKvAynoXUxTc8OuM5P1zexHBuwcDcQth4';

// Available models (1.5-flash-exp is fastest/free)
// window.MODELS = ['gemini-1.5-flash-exp', 'gemini-1.5-flash', 'gemini-1.5-pro'];

