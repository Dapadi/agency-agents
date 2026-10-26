# 🎭 Agency Agents Dashboard

Una dashboard web personal para ver, buscar y gestionar todos tus agentes de IA en tiempo real.

## ✨ Características

- 📊 **Vista de todos tus agentes** - Visualiza los 282+ agentes instalados
- 🔍 **Búsqueda avanzada** - Busca por nombre, división o categoría
- 🗂️ **Filtros por división** - Agrupa agentes por categoría (engineering, design, sales, etc.)
- 📋 **Copiar agentes** - Copia el contenido completo del agente al portapapeles
- 📱 **Interfaz responsive** - Funciona en desktop, tablet y móvil
- 📊 **Estadísticas** - Ve cuántos agentes tienes por división
- 🎨 **Diseño moderno** - Interfaz oscura con tema purpura/indigo

## 🚀 Instalación

### Paso 1: Instalar dependencias

```bash
npm install
```

Esto instalará:
- **express** - Servidor web
- **gray-matter** - Parser de frontmatter markdown
- **fs-extra** - Utilidades mejoradas para archivos

### Paso 2: Ejecutar el servidor

```bash
npm start
```

O en modo desarrollo:

```bash
npm run dev
```

### Paso 3: Abrir en el navegador

Abre tu navegador en:
```
http://localhost:3000
```

## 📁 Estructura del Proyecto

```
agency-agents/
├── agents/             # Agentes (.md con frontmatter)
├── api/index.js        # App Express + APIs (también función de Vercel)
├── server.js           # Arranque local
├── package.json        # Dependencias del proyecto
├── public/
│   ├── index.html      # HTML principal
│   ├── styles.css      # Estilos CSS
│   └── app.js          # Lógica del frontend
└── README.md           # Este archivo
```

## 🔌 API Endpoints

### GET `/api/agents`
Obtiene lista de todos los agentes.

**Respuesta:**
```json
[
  {
    "id": "frontend-developer",
    "title": "Frontend Developer",
    "division": "engineering",
    "category": "Development",
    "description": "...",
    "content": "...",
    "fullContent": "..."
  }
]
```

### GET `/api/agents/:id`
Obtiene detalles de un agente específico.

### GET `/api/stats`
Obtiene estadísticas de los agentes.

**Respuesta:**
```json
{
  "totalAgents": 282,
  "divisions": {
    "engineering": 45,
    "design": 32,
    "marketing": 28,
    ...
  }
}
```

## 🎯 Cómo Usar

1. **Buscar un agente**
   - Escribe en la barra de búsqueda
   - Busca por nombre, división o archivo

2. **Filtrar por división**
   - Usa el selector de divisiones
   - Combina con búsqueda para resultados más específicos

3. **Ver detalles**
   - Haz clic en cualquier tarjeta de agente
   - Se abrirá un modal con toda la información

4. **Copiar agente**
   - Haz clic en "Copiar" en la tarjeta
   - O copia el contenido completo desde el modal

## 🛠️ Personalización

### Cambiar puerto
En `server.js`, línea 11:
```javascript
const PORT = 3000; // Cambia aquí
```

### Cambiar estilo
Edita `public/styles.css` para cambiar colores, fuentes, etc.

Las variables CSS principales están al inicio del archivo:
```css
:root {
    --primary: #6366f1;
    --secondary: #8b5cf6;
    --accent: #ec4899;
    ...
}
```

## 📝 Notas

- Los agentes se cargan desde `~/.claude/agents/`
- La dashboard se sincroniza automáticamente cuando agregas nuevos agentes
- Todos los agentes deben ser archivos `.md` en la carpeta especificada

## 🚀 Próximas Mejoras

- [ ] Filtros avanzados (por etiquetas, favoritos)
- [ ] Sincronización automática de cambios
- [ ] Exportar agentes a diferentes formatos
- [ ] Crear agentes nuevos desde la dashboard
- [ ] Sistema de favoritos
- [ ] Modo claro/oscuro

## 📄 Licencia

MIT

---

Hecho con ❤️ para controlar todos tus agentes de IA.
