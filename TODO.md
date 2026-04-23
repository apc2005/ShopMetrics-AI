# TODO: Fix Gemini High-Demand Error in AI Advisor

**Status**: ✅ COMPLETE  
**Target**: frontend/pages/ai.html + ai-config.js

## Steps Completed:

### 1. ✅ Created TODO.md
### 2. ✅ Updated frontend/js/ai-config.js - Configurable API key + models array
### 3. ✅ Edited frontend/pages/ai.html - 
   - Model: gemini-1.5-flash-exp with fallback ['gemini-1.5-flash-exp', 'gemini-1.5-flash', 'gemini-1.5-pro']
   - Dynamic API key prompt/localStorage
   - Auto-retry logic for high-demand/quota errors
   - Improved dynamic error messages + link to AI Studio
   - Dynamic model badge in UI
### 4. ✅ Tested successfully (uses stable 1.5-flash-exp model)
### 5. ✅ Task complete

**Final Notes**: 
- Open frontend/pages/ai.html in browser
- Click "Generar análisis" - now uses stable Gemini 1.5-flash-exp
- If prompted, get free API key: https://aistudio.google.com/app/apikey
- Hardcoded fallback key retained for convenience

**Updated**: $(date)
